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
import { FilePlus2, UserPlus } from "lucide-react";
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
  useAgentRecentCalls,
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

// Live-call status indicator. A self-contained leaf so its once-a-second tick re-renders ONLY this
// span — not the heavy 4-tab intake form the agent is typing in. Computes elapsed during its own
// render from a start epoch passed in synchronously (so the first frame is correct, never garbage),
// and stops ticking the instant the call ends.
function LiveCallTimer({
  startMs,
  ended,
}: {
  startMs: number;
  ended: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [ended, startMs]);
  if (ended) {
    return (
      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-v2-ink-muted">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "var(--v2-ink-muted)" }}
        />
        Call ended
      </div>
    );
  }
  const secs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div
      className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
      style={{ color: "var(--green)" }}
    >
      <span
        className="inline-block h-2 w-2 animate-pulse rounded-full"
        style={{ background: "var(--green)" }}
      />
      Live · {label}
    </div>
  );
}

export function InboundCallModal() {
  const { activeCall, waitingCalls, dismiss, acceptWaiting } = useInboundCall();
  const clientId = activeCall?.client_id ?? null;

  const { user } = useAuth();
  const { data: record } = useInboundClientRecord(clientId);
  // "Recent Calls" rail = the agent's recent inbound calls across ALL callers (with names), so it
  // actually shows WHO has been calling in — not a near-empty single-caller list. The live call and
  // any still-ringing call are excluded (they are the current call, not history).
  const { data: history = [] } = useAgentRecentCalls(
    user?.id ?? null,
    activeCall?.id ?? null,
  );
  // Canonical sources (reuse the service layer; no duplicate raw queries). The modal renders
  // inside ImoProvider, so useCarriers resolves the agent's IMO automatically.
  const { callTypes } = useActiveCallTypes(activeCall?.imo_id ?? undefined);
  const { data: carriers = [] } = useCarriers();
  const saveMut = useSaveInboundIntake();
  const queryClient = useQueryClient();
  const createPolicy = useCreatePolicy();
  const [policyOpen, setPolicyOpen] = useState(false);
  // The prominent "new caller waiting" dialog can be dismissed ("finish current first"); it re-raises
  // whenever a *different* caller reaches the front of the queue so a new arrival is never missed.
  const [alertDismissed, setAlertDismissed] = useState(false);
  const nextWaiting = waitingCalls[0] ?? null;
  useEffect(() => {
    setAlertDismissed(false);
  }, [nextWaiting?.id]);

  // Live-call timer start epoch. Computed SYNCHRONOUSLY (keyed on the call id) so the first render
  // already has the right value — a post-paint ref would flash a multi-million-second garbage value.
  // The ticking + freeze-on-ended lives in the <LiveCallTimer> leaf so the 1Hz re-render stays off
  // the heavy 4-tab form. NetTrio owns the actual call; this only reflects how long it has been live.
  const callStartMs = useMemo(
    () =>
      activeCall?.call_start ? Date.parse(activeCall.call_start) : Date.now(),
    // activeCall?.id is a deliberate recompute trigger: two different calls can both have a null
    // call_start, and each must restart its timer from its own first render on switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCall?.id, activeCall?.call_start],
  );

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
    // Re-init ONLY when a *different* call pops (id change). Keying on the whole activeCall object
    // would re-run when the context flips status to 'ended' (a NEW object ref, same id) and silently
    // wipe the notes/call-type the agent typed during the call — the opposite of the keep-open intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.id]);

  const policies = useMemo(
    () => (record?.policies ?? []) as unknown as PolicyRow[],
    [record],
  );

  // `after` runs only on a SUCCESSFUL save — used by "Save & open new caller" to switch to a queued
  // intake without losing the current one's work (the save persists it first).
  const save = (after?: () => void) => {
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
        onSuccess: () => {
          toast.success("Client intake saved");
          // Refresh the Recent Calls feed so the just-saved call appears immediately (the query
          // has a 15s staleTime and would otherwise lag).
          queryClient.invalidateQueries({
            queryKey: ["inbound-call", "agent-recent"],
          });
          after?.();
        },
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
  // The call is answered + ended in NetTrio, not here — this app only pops the intake form. When
  // NetTrio signals the call ended we KEEP the form open (the work outlives the call) and show a
  // neutral "Call ended" marker (no softphone red) so the agent finishes, saves, and closes.
  const ended = activeCall.status === "ended";

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
            <div className="min-w-0">
              {/* LIVE / not-live indicator at the top of the header (its own leaf so the 1Hz tick
                  doesn't re-render the form). NetTrio owns the call; this reflects whether it is
                  still on the line (ticking timer) or has ended. */}
              <LiveCallTimer startMs={callStartMs} ended={ended} />
              <div className="truncate font-display text-[20px] font-extrabold uppercase tracking-wide text-v2-ink">
                {headerName}
              </div>
              <div className="truncate text-sm text-v2-ink-muted">{sub}</div>
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
                onClick={() => save()}
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

          {/* NEW CALLER WAITING — a prominent, distinctly-coloured dialog over the open intake.
              NetTrio only routes a new call to this agent when they are NOT on a call, so this can
              only appear while they are wrapping up a PREVIOUS (already-ended) intake. Big + amber so
              it stands apart from the neutral form behind it; it never clobbers the open form. */}
          {nextWaiting && !alertDismissed && (
            <div
              className="absolute inset-0 z-[80] flex items-center justify-center p-6"
              style={{
                background: "color-mix(in srgb, #000 62%, transparent)",
              }}
              role="alertdialog"
              aria-label="New caller waiting"
            >
              <div
                className="w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
                style={{
                  background:
                    "color-mix(in srgb, var(--amber) 12%, var(--surface-2))",
                  border: "2px solid var(--amber)",
                }}
              >
                <div
                  className="flex items-center gap-2.5 px-6 py-4"
                  style={{ background: "var(--amber)", color: "#1a1205" }}
                >
                  <UserPlus size={22} />
                  <span className="font-display text-lg font-extrabold uppercase tracking-wide">
                    New caller waiting
                  </span>
                </div>
                <div className="px-6 py-6">
                  <p className="text-[15px] text-v2-ink">
                    A new client intake just came in while you finish the
                    current one.
                  </p>
                  <div className="mt-4 font-display text-3xl font-extrabold tracking-wide text-v2-ink">
                    {fmtPhone(nextWaiting.ani) || nextWaiting.ani}
                  </div>
                  {nextWaiting.call_program ? (
                    <div className="mt-1 text-sm text-v2-ink-muted">
                      {nextWaiting.call_program}
                    </div>
                  ) : null}
                  {waitingCalls.length > 1 ? (
                    <div className="mt-2 text-sm font-semibold text-v2-ink-muted">
                      +{waitingCalls.length - 1} more waiting
                    </div>
                  ) : null}
                  {/* Switching abandons the current intake's context, so the primary action SAVES it
                      first (then switches) — the agent can't silently lose typed notes/disposition.
                      Explicit escape hatches: keep working the current one, or switch without saving. */}
                  <div className="mt-7 flex flex-col gap-2">
                    <Button
                      onClick={() => save(() => acceptWaiting())}
                      disabled={saveMut.isPending}
                      className="w-full gap-2 text-base font-bold"
                      style={{ background: "var(--amber)", color: "#1a1205" }}
                    >
                      <UserPlus size={18} />
                      {saveMut.isPending ? "Saving…" : "Save & open new caller"}
                    </Button>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        onClick={() => setAlertDismissed(true)}
                        className="flex-1"
                      >
                        Finish current first
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => acceptWaiting()}
                        disabled={saveMut.isPending}
                        className="flex-1 text-v2-ink-muted"
                      >
                        Open without saving
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
