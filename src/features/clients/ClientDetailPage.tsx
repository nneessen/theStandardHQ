// src/features/clients/ClientDetailPage.tsx
// The full, EDITABLE client record — exact parity with the inbound-call intake. It renders the SAME
// context rail (ClientRecordRail) + the SAME 4-tab form (ClientFormTabs) the screen-pop uses, so an
// agent sees and edits all the same data here (identity, current coverage, beneficiaries, health,
// medications, existing policies). Saves identity + the rich intake jsonb (no call disposition —
// there's no live call). "New application" starts a pending policy bound to this client.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  PolicyDialog,
  useCreatePolicy,
  transformFormToCreateData,
} from "@/features/policies";
import type { NewPolicyForm, Policy } from "@/types/policy.types";
import { useCarriers } from "@/hooks/carriers";
import {
  useInboundClientRecord,
  useInboundCallHistory,
  useClientIntakeForm,
  useSaveClientRecord,
  ClientFormTabs,
  ClientRecordRail,
  type PolicyRow,
} from "@/features/inbound-crm";
import { StatusBadge } from "./components/clientUi";

export function ClientDetailPage({ clientId }: { clientId: string }) {
  const {
    data: record,
    isLoading,
    isError,
    error,
  } = useInboundClientRecord(clientId);
  const { data: history = [] } = useInboundCallHistory(clientId);
  const { data: carriers = [] } = useCarriers();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const saveMut = useSaveClientRecord();
  const createPolicy = useCreatePolicy();
  const [policyOpen, setPolicyOpen] = useState(false);

  const {
    form,
    set,
    coverage,
    setCoverage,
    beneficiaries,
    setBeneficiaries,
    medications,
    setMedications,
    buildIdentity,
    buildIntake,
  } = useClientIntakeForm(record);

  const policies = useMemo(
    () => (record?.policies ?? []) as unknown as PolicyRow[],
    [record],
  );

  const save = () => {
    saveMut.mutate(
      {
        clientId,
        identity: buildIdentity(),
        intake: buildIntake() as unknown as Record<string, unknown>,
      },
      {
        onSuccess: () => {
          toast.success("Client saved");
          queryClient.invalidateQueries({
            queryKey: ["inbound-call", "record", clientId],
          });
          // Reflect edited name/contact in the My Book list right away (it caches ~5min).
          queryClient.invalidateQueries({ queryKey: ["clients", "own"] });
        },
        onError: (e: Error) => toast.error(e.message || "Could not save"),
      },
    );
  };

  // Start a new application (pending) bound to this exact client. Mirrors the modal's path.
  const onSavePolicy = async (fd: NewPolicyForm): Promise<Policy | null> => {
    if (!user?.id) throw new Error("Not signed in");
    const createData = transformFormToCreateData(fd, clientId, user.id);
    const result = await createPolicy.mutateAsync(createData);
    toast.success(
      `Application started — pending${
        result.policyNumber ? ` (${result.policyNumber})` : ""
      }`,
    );
    queryClient.invalidateQueries({
      queryKey: ["inbound-call", "record", clientId],
    });
    return result;
  };

  const policyPrefill: Partial<NewPolicyForm> = {
    clientName: form.name,
    clientEmail: form.email,
    clientPhone: form.phone,
    clientState: form.state,
    clientDOB: form.dob,
    clientStreet: form.street,
    clientCity: form.city,
    clientZipCode: form.zip,
  };

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          <Link
            to="/clients"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-v2-ink-muted hover:text-v2-ink"
          >
            <ArrowLeft size={15} /> All clients
          </Link>

          {isLoading ? (
            <div className="py-16 text-center text-v2-ink-subtle">
              Loading client…
            </div>
          ) : isError || !record ? (
            <div className="py-16 text-center" style={{ color: "var(--red)" }}>
              {(error as Error)?.message ?? "Client not found."}
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <Cap>CLIENT RECORD</Cap>
                    <h1
                      style={{
                        font: `800 26px ${T.disp}`,
                        color: T.ink,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        margin: 0,
                      }}
                    >
                      {form.name || "Unnamed client"}
                    </h1>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPolicyOpen(true)}
                    className="gap-1.5"
                  >
                    <FilePlus2 size={15} />
                    New application
                  </Button>
                  <Button
                    onClick={save}
                    disabled={saveMut.isPending}
                    style={{ background: "var(--blue)", color: "#0c1322" }}
                  >
                    {saveMut.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </header>

              {/* Same rail + same tabbed form as the inbound intake — full parity, editable. */}
              <div className="grid items-start gap-4 lg:grid-cols-[360px_1fr]">
                <ClientRecordRail
                  contactTitle="Contact"
                  phone={form.phone}
                  email={form.email}
                  dob={form.dob}
                  location={[form.city, form.state].filter(Boolean).join(", ")}
                  policies={policies}
                  history={history}
                />

                <div className="overflow-hidden rounded-lg border border-v2-ring bg-v2-card shadow-board-panel">
                  <ClientFormTabs
                    form={form}
                    set={set}
                    coverage={coverage}
                    setCoverage={setCoverage}
                    beneficiaries={beneficiaries}
                    setBeneficiaries={setBeneficiaries}
                    medications={medications}
                    setMedications={setMedications}
                    carriers={carriers}
                    callPanelTitle="Call Details"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <PolicyDialog
        open={policyOpen}
        onOpenChange={setPolicyOpen}
        onSave={onSavePolicy}
        isPending={createPolicy.isPending}
        defaultFormData={policyPrefill}
      />
    </SectionShell>
  );
}
