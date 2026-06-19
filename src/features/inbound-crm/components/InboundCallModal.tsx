// src/features/inbound-crm/components/InboundCallModal.tsx
// FULL-SCREEN inbound-call intake that takes over the screen when a call routes to this agent.
// Rendered inside the authed shell (App.tsx) so it inherits the board theme + ImoContext. Styled to
// match "The Board" / theme-v2.
//
// Layout: a PINNED header (caller identity), an ALWAYS-VISIBLE left context rail (ClientRecordRail),
// and the shared 4-tab client form (ClientFormTabs) on the right. The form + rail are the SAME
// components the Clients detail page renders, so the live-call intake and the saved client record
// stay in exact parity. The ONLY call-specific additions here are the live-call header and the call
// disposition (call type / carrier / call notes → inbound_calls), injected via the tab slots.
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, FilePlus2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useInboundCall } from "@/contexts/InboundCallContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  PolicyDialog,
  useCreatePolicy,
  transformFormToCreateData,
} from "@/features/policies";
import type { NewPolicyForm, Policy } from "@/types/policy.types";
import { useActiveCallTypes } from "@/features/kpi";
import { useCarriers } from "@/hooks/carriers";
import {
  useInboundClientRecord,
  useInboundCallHistory,
  useSaveInboundIntake,
} from "../hooks/useInboundCallIntake";
import { useClientIntakeForm } from "./clientForm/useClientIntakeForm";
import { ClientFormTabs } from "./clientForm/ClientFormTabs";
import {
  ClientRecordRail,
  type PolicyRow,
} from "./clientForm/ClientRecordRail";
import { FieldLabel, SelectField, Panel, tint } from "./clientForm/primitives";
import { fmtPhone } from "./clientForm/format";

export function InboundCallModal() {
  const { activeCall, dismiss } = useInboundCall();
  const clientId = activeCall?.client_id ?? null;

  const { data: record } = useInboundClientRecord(clientId);
  const { data: history = [] } = useInboundCallHistory(
    clientId,
    activeCall?.id ?? null,
  );
  // Canonical sources (reuse the service layer; no duplicate raw queries). The modal renders
  // inside ImoProvider, so useCarriers resolves the agent's IMO automatically.
  const { callTypes } = useActiveCallTypes(activeCall?.imo_id ?? undefined);
  const { data: carriers = [] } = useCarriers();
  const saveMut = useSaveInboundIntake();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createPolicy = useCreatePolicy();
  const [policyOpen, setPolicyOpen] = useState(false);

  // Shared client-level form state (identity + intake jsonb). Falls back to the live call's ANI /
  // state / inquiry carrier when the client row hasn't captured them yet.
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
  } = useClientIntakeForm(record, {
    fallbackPhone: activeCall?.ani ?? undefined,
    fallbackState: activeCall?.state ?? undefined,
    fallbackCarrierId: activeCall?.inquiry_carrier_id ?? undefined,
  });

  // Call disposition (call type + call notes → inbound_calls) — call-specific, NOT part of the
  // shared client form. inquiry_carrier_id rides on the shared form's currentCarrierId.
  const [callTypeId, setCallTypeId] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!activeCall) return;
    setCallTypeId(activeCall.call_type_id ?? "");
    setNotes(activeCall.notes ?? "");
  }, [activeCall]);

  const policies = useMemo(
    () => (record?.policies ?? []) as unknown as PolicyRow[],
    [record],
  );

  const save = () => {
    saveMut.mutate(
      {
        clientId,
        requestTag: activeCall!.request_tag,
        identity: buildIdentity(),
        intake: buildIntake() as unknown as Record<string, unknown>,
        callTypeId: callTypeId || null,
        inquiryCarrierId: form.currentCarrierId || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => toast.success("Client intake saved"),
        onError: (e: Error) => toast.error(e.message || "Could not save"),
      },
    );
  };

  // Start a new application (status: 'pending') for the popped client, reusing the standard
  // PolicyForm. Binds to the KNOWN clientId (not name-based createOrFind) so it attaches to this
  // exact caller. Throws on failure so PolicyForm keeps the dialog open + surfaces the error.
  const onSavePolicy = async (fd: NewPolicyForm): Promise<Policy | null> => {
    if (!user?.id || !clientId) {
      throw new Error("No client on this call to attach a policy to");
    }
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

  if (!activeCall) return null;

  // Prefill the policy form's client fields from the intake so validation passes and the agent
  // sees who the application is for; the policy still binds by clientId in onSavePolicy.
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

  const isExisting = !!clientId;
  const headerName =
    form.name || (isExisting ? "Unnamed client" : "New caller");
  const sub = [
    fmtPhone(form.phone),
    form.state,
    activeCall.call_program ?? activeCall.offer_id,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const total = policies.length;
  const badge = isExisting
    ? `Existing · ${total} ${total === 1 ? "policy" : "policies"}`
    : "New caller";
  const badgeVar = isExisting ? "--blue" : "--amber";

  return (
    <>
      <Dialog open={!!activeCall} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent
          hideCloseButton
          className="left-0 top-0 flex h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 text-v2-ink"
          style={{ background: "var(--surface-1)" }}
        >
          {/* ── header ─────────────────────────────────────────────────────── */}
          <div
            className="flex shrink-0 items-center justify-between gap-4 px-6 py-3"
            style={{
              background: "var(--surface-3)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: tint("--green", 15),
                  color: "var(--green)",
                }}
              >
                <Phone size={20} />
              </span>
              <div className="min-w-0">
                <div
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "var(--green)" }}
                >
                  Incoming call
                </div>
                <div className="truncate font-display text-[20px] font-extrabold uppercase tracking-wide text-v2-ink">
                  {headerName}
                </div>
                <div className="truncate text-sm text-v2-ink-muted">{sub}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className="rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide"
                style={{
                  background: tint(badgeVar, 14),
                  color: `var(${badgeVar})`,
                  border: `1px solid ${tint(badgeVar, 30)}`,
                }}
              >
                {badge}
              </span>
              {isExisting && (
                <Button
                  variant="outline"
                  onClick={() => setPolicyOpen(true)}
                  className="gap-1.5"
                >
                  <FilePlus2 size={15} />
                  New application
                </Button>
              )}
              <Button variant="ghost" onClick={dismiss}>
                Close
              </Button>
              <Button
                onClick={save}
                disabled={saveMut.isPending}
                style={{ background: "var(--blue)", color: "#0c1322" }}
              >
                {saveMut.isPending ? "Saving…" : "Save intake"}
              </Button>
            </div>
          </div>

          {/* ── body: context rail + tabbed form ───────────────────────────── */}
          <div className="flex min-h-0 flex-1">
            <ClientRecordRail
              className="w-[360px] shrink-0 overflow-y-auto p-4"
              style={{
                background: "var(--surface-2)",
                borderRight: "1px solid var(--line)",
              }}
              phone={form.phone}
              email={form.email}
              dob={form.dob}
              location={[form.city, form.state].filter(Boolean).join(", ")}
              program={activeCall.call_program ?? activeCall.offer_id}
              policies={policies}
              history={history}
            />

            <ClientFormTabs
              fill
              form={form}
              set={set}
              coverage={coverage}
              setCoverage={setCoverage}
              beneficiaries={beneficiaries}
              setBeneficiaries={setBeneficiaries}
              medications={medications}
              setMedications={setMedications}
              carriers={carriers}
              callTypeSlot={
                <SelectField
                  label="Call type"
                  value={callTypeId}
                  onChange={setCallTypeId}
                  options={callTypes}
                />
              }
              callNotesSlot={
                <Panel title="Notes" bodyClassName="flex flex-1 flex-col">
                  <FieldLabel>Call notes</FieldLabel>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What the client said, objections, follow-ups…"
                    className="min-h-[220px] flex-1 text-sm"
                  />
                </Panel>
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Start a new application for this caller (pending). Reuses the standard policy form;
          binds to the known clientId. Only offered for an existing client. */}
      {isExisting && (
        <PolicyDialog
          open={policyOpen}
          onOpenChange={setPolicyOpen}
          onSave={onSavePolicy}
          isPending={createPolicy.isPending}
          defaultFormData={policyPrefill}
        />
      )}
    </>
  );
}
