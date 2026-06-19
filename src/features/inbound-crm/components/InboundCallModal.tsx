// src/features/inbound-crm/components/InboundCallModal.tsx
// FULL-SCREEN inbound-call intake that takes over the screen when a call routes to this agent.
// Rendered inside the authed shell (App.tsx) so it inherits the board theme + ImoContext. Styled to
// match "The Board" / theme-v2 (v2-* classes + accent tints, dense tables like the Policies page).
//
// Layout: a PINNED header (caller identity), an ALWAYS-VISIBLE left context rail (caller summary +
// stat strip + their existing policies + recent call history — the real data an agent needs while
// live on the call), and a 3-tab form on the right (Client · Call Details · Health) so each section
// stays bounded with no vertical scrolling. Non-banking v1 (SSN/bank deferred to encrypted storage).
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, FilePlus2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useInboundCall } from "@/contexts/InboundCallContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  PolicyDialog,
  useCreatePolicy,
  transformFormToCreateData,
} from "@/features/policies";
import type { NewPolicyForm, Policy } from "@/types/policy.types";
import {
  useInboundCallTypes,
  useInboundCarriers,
} from "../hooks/useInboundCallDisposition";
import {
  useInboundClientRecord,
  useInboundCallHistory,
  useSaveInboundIntake,
} from "../hooks/useInboundCallIntake";

const tint = (v: string, pct: number) =>
  `color-mix(in srgb, var(${v}) ${pct}%, transparent)`;

// status -> accent CSS var (mirrors the Policies-page tinted badges)
function statusVar(s?: string | null): string {
  const k = (s ?? "").toLowerCase();
  if (k === "active") return "--green";
  if (k === "pending" || k === "ringing") return "--amber";
  if (k === "lapsed" || k === "cancelled" || k === "ended") return "--red";
  return "--blue";
}
function StatusBadge({ status }: { status?: string | null }) {
  const v = statusVar(status);
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: tint(v, 16),
        color: `var(${v})`,
        border: `1px solid ${tint(v, 30)}`,
      }}
    >
      {status ?? "—"}
    </span>
  );
}

// ── reusable, on-brand field pieces ──────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted">
      {children}
    </label>
  );
}
function TextField({
  label,
  value,
  onChange,
  type = "text",
  className,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm"
      />
    </div>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 self-end pb-1.5 text-sm text-v2-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--blue)]"
      />
      {label}
    </label>
  );
}
function Panel({
  title,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border border-v2-ring bg-v2-card shadow-board-panel ${className}`}
    >
      <div className="border-b border-v2-ring px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-v2-accent">
        {title}
      </div>
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

// ── rail summary line ─────────────────────────────────────────────────────────
function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm text-v2-ink">
        {value || "—"}
      </span>
    </div>
  );
}

interface ClientIntake {
  title?: string;
  wantsMoreCoverageLater?: boolean;
  writingAgent?: string;
  lastReceivedAgent?: string;
  reasonForCalling?: string;
  currentCoverageAmount?: string;
  spanishCall?: boolean;
  majorHealthConditions?: string;
  majorConditionsDetails?: string;
  height?: string;
  weight?: string;
  nicotineUser?: boolean;
  birthCountry?: string;
  birthState?: string;
  shipping?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}
// Raw policy row shape (getWithPolicies casts the Supabase rows without camel-mapping, so these are
// the on-the-wire snake_case columns + the nested carrier join).
interface PolicyRow {
  id: string;
  product?: string | null;
  monthly_premium?: number | null;
  annual_premium?: number | null;
  effective_date?: string | null;
  lifecycle_status?: string | null;
  status?: string | null;
  policy_number?: string | null;
  carrier?: { name?: string | null } | null;
}
const blankForm = {
  name: "",
  email: "",
  phone: "",
  dob: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  title: "",
  wantsMoreCoverageLater: false,
  writingAgent: "",
  lastReceivedAgent: "",
  callTypeId: "",
  currentCarrierId: "",
  reasonForCalling: "",
  currentCoverageAmount: "",
  spanishCall: false,
  notes: "",
  majorHealthConditions: "",
  majorConditionsDetails: "",
  height: "",
  weight: "",
  nicotineUser: false,
  birthCountry: "",
  birthState: "",
  shipStreet: "",
  shipCity: "",
  shipState: "",
  shipZip: "",
};
function parseJson<T>(s?: string | null): Partial<T> {
  if (!s) return {};
  try {
    const o = JSON.parse(s) as Partial<T>;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}
const money = (n?: number | null) =>
  n == null ? "—" : `$${Number(n).toLocaleString()}`;
// Parse a value as a LOCAL date. A bare `YYYY-MM-DD` (date-only column like date_of_birth) must NOT
// go through `new Date(str)` — that treats it as UTC midnight and shifts a day in negative offsets
// (the rail showed 4/11 while the field showed 04/12). Build it in local time instead.
function toLocalDate(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
const fmtDate = (d?: string | null) => {
  const dt = toLocalDate(d);
  return dt ? dt.toLocaleDateString() : "—";
};
const fmtPhone = (raw?: string | null) => {
  if (!raw) return "";
  const m = raw.replace(/[^\d]/g, "").match(/^1?(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : raw;
};
function ageFromDob(dob?: string | null): string {
  const d = toLocalDate(dob);
  if (!d) return "";
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? `${a} yrs` : "";
}
const fmtDuration = (s?: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m ? `${m}m ${sec}s` : `${sec}s`;
};

export function InboundCallModal() {
  const { activeCall, dismiss } = useInboundCall();
  const clientId = activeCall?.client_id ?? null;

  const { data: record } = useInboundClientRecord(clientId);
  const { data: history = [] } = useInboundCallHistory(
    clientId,
    activeCall?.id ?? null,
  );
  const { data: callTypes = [] } = useInboundCallTypes(
    activeCall?.imo_id ?? null,
  );
  const { data: carriers = [] } = useInboundCarriers(
    activeCall?.imo_id ?? null,
  );
  const saveMut = useSaveInboundIntake();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createPolicy = useCreatePolicy();
  const [policyOpen, setPolicyOpen] = useState(false);

  const [form, setForm] = useState(blankForm);
  const set = <K extends keyof typeof blankForm>(
    k: K,
    v: (typeof blankForm)[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!activeCall) return;
    const addr = parseJson<{
      street: string;
      city: string;
      state: string;
      zipCode: string;
    }>(record?.address);
    const intake =
      (record as unknown as { intake?: ClientIntake })?.intake ?? {};
    const ship = intake.shipping ?? {};
    setForm({
      name: record?.name ?? "",
      email: record?.email ?? "",
      phone: record?.phone ?? activeCall.ani ?? "",
      dob: record?.date_of_birth ?? "",
      street: addr.street ?? "",
      city: addr.city ?? "",
      state: addr.state ?? activeCall.state ?? "",
      zip: addr.zipCode ?? "",
      title: intake.title ?? "",
      wantsMoreCoverageLater: !!intake.wantsMoreCoverageLater,
      writingAgent: intake.writingAgent ?? "",
      lastReceivedAgent: intake.lastReceivedAgent ?? "",
      callTypeId: activeCall.call_type_id ?? "",
      currentCarrierId: activeCall.inquiry_carrier_id ?? "",
      reasonForCalling: intake.reasonForCalling ?? "",
      currentCoverageAmount: intake.currentCoverageAmount ?? "",
      spanishCall: !!intake.spanishCall,
      notes: activeCall.notes ?? "",
      majorHealthConditions: intake.majorHealthConditions ?? "",
      majorConditionsDetails: intake.majorConditionsDetails ?? "",
      height: intake.height ?? "",
      weight: intake.weight ?? "",
      nicotineUser: !!intake.nicotineUser,
      birthCountry: intake.birthCountry ?? "",
      birthState: intake.birthState ?? "",
      shipStreet: ship.street ?? "",
      shipCity: ship.city ?? "",
      shipState: ship.state ?? "",
      shipZip: ship.zipCode ?? "",
    });
  }, [activeCall, record]);

  const policies = useMemo(
    () => (record?.policies ?? []) as unknown as PolicyRow[],
    [record],
  );
  const stats = useMemo(() => {
    const active = policies.filter(
      (p) => (p.lifecycle_status ?? p.status ?? "").toLowerCase() === "active",
    ).length;
    const annual = policies.reduce((s, p) => s + (p.annual_premium ?? 0), 0);
    return { total: policies.length, active, annual };
  }, [policies]);

  const save = () => {
    saveMut.mutate(
      {
        clientId,
        requestTag: activeCall!.request_tag,
        identity: {
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          date_of_birth: form.dob || undefined,
          address: JSON.stringify({
            street: form.street,
            city: form.city,
            state: form.state,
            zipCode: form.zip,
          }),
        },
        intake: {
          title: form.title,
          wantsMoreCoverageLater: form.wantsMoreCoverageLater,
          writingAgent: form.writingAgent,
          lastReceivedAgent: form.lastReceivedAgent,
          reasonForCalling: form.reasonForCalling,
          currentCoverageAmount: form.currentCoverageAmount,
          spanishCall: form.spanishCall,
          majorHealthConditions: form.majorHealthConditions,
          majorConditionsDetails: form.majorConditionsDetails,
          height: form.height,
          weight: form.weight,
          nicotineUser: form.nicotineUser,
          birthCountry: form.birthCountry,
          birthState: form.birthState,
          shipping: {
            street: form.shipStreet,
            city: form.shipCity,
            state: form.shipState,
            zipCode: form.shipZip,
          },
        },
        callTypeId: form.callTypeId || null,
        inquiryCarrierId: form.currentCarrierId || null,
        notes: form.notes.trim() || null,
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
    // Refresh the context rail so the new pending policy shows immediately.
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
  const badge = isExisting
    ? `Existing · ${stats.total} ${stats.total === 1 ? "policy" : "policies"}`
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
            {/* LEFT — always-visible caller context (real data) */}
            <aside
              className="flex w-[360px] shrink-0 flex-col gap-3 overflow-y-auto p-4"
              style={{
                background: "var(--surface-2)",
                borderRight: "1px solid var(--line)",
              }}
            >
              <Panel title="Caller">
                <SummaryRow label="Phone" value={fmtPhone(form.phone)} />
                <SummaryRow label="Email" value={form.email} />
                <SummaryRow
                  label="DOB"
                  value={
                    form.dob
                      ? `${fmtDate(form.dob)}${
                          ageFromDob(form.dob)
                            ? ` · ${ageFromDob(form.dob)}`
                            : ""
                        }`
                      : ""
                  }
                />
                <SummaryRow
                  label="Location"
                  value={[form.city, form.state].filter(Boolean).join(", ")}
                />
                <SummaryRow
                  label="Program"
                  value={activeCall.call_program ?? activeCall.offer_id}
                />
              </Panel>

              {/* stat strip — mirrors the Policies-page metric row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: "Policies", v: String(stats.total), c: "--blue" },
                  { k: "Active", v: String(stats.active), c: "--green" },
                  { k: "Premium", v: money(stats.annual), c: "--violet" },
                ].map((s) => (
                  <div
                    key={s.k}
                    className="rounded-lg border border-v2-ring bg-v2-card px-3 py-2"
                  >
                    <div
                      className="font-display text-lg font-extrabold leading-none"
                      style={{ color: `var(${s.c})` }}
                    >
                      {s.v}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-v2-ink-muted">
                      {s.k}
                    </div>
                  </div>
                ))}
              </div>

              <Panel title="Existing Policies" bodyClassName="p-0">
                {policies.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-v2-ink-subtle">
                    No policies on file.
                  </div>
                ) : (
                  <ul className="divide-y divide-v2-ring">
                    {policies.map((p) => (
                      <li key={p.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-v2-ink">
                            {p.carrier?.name ?? "—"}
                          </span>
                          <StatusBadge
                            status={p.lifecycle_status ?? p.status}
                          />
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-v2-ink-muted">
                          <span className="truncate capitalize">
                            {String(p.product ?? "—").replace(/_/g, " ")}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {money(p.monthly_premium)}/mo
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Recent Calls"
                bodyClassName="p-0"
                className="flex-1"
              >
                {history.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-v2-ink-subtle">
                    No prior calls.
                  </div>
                ) : (
                  <ul className="divide-y divide-v2-ring">
                    {history.map((h) => (
                      <li key={h.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-v2-ink">
                            {h.call_start
                              ? fmtDate(h.call_start)
                              : "In progress"}
                          </span>
                          <StatusBadge status={h.status} />
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-v2-ink-muted">
                          <span className="truncate">
                            {h.call_program ?? "—"}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {fmtDuration(h.duration)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </aside>

            {/* RIGHT — tabbed form (no vertical scroll within a tab) */}
            <Tabs
              defaultValue="client"
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList
                className="w-full justify-start gap-1 px-6"
                style={{
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <TabsTrigger
                  value="client"
                  className="data-[state=active]:bg-v2-card"
                >
                  Client
                </TabsTrigger>
                <TabsTrigger
                  value="call"
                  className="data-[state=active]:bg-v2-card"
                >
                  Call Details
                </TabsTrigger>
                <TabsTrigger
                  value="health"
                  className="data-[state=active]:bg-v2-card"
                >
                  Health
                </TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {/* CLIENT */}
                <TabsContent value="client" className="mt-0 h-full">
                  <div className="grid h-full gap-4 xl:grid-cols-2 xl:[grid-template-rows:auto_1fr]">
                    <Panel title="Identity">
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          label="Name"
                          value={form.name}
                          onChange={(v) => set("name", v)}
                        />
                        <TextField
                          label="Title"
                          value={form.title}
                          onChange={(v) => set("title", v)}
                          placeholder="Mr. / Mrs. / Ms."
                        />
                        <TextField
                          label="Phone"
                          value={form.phone}
                          onChange={(v) => set("phone", v)}
                        />
                        <TextField
                          label="Email"
                          value={form.email}
                          onChange={(v) => set("email", v)}
                        />
                        <TextField
                          label="Date of birth"
                          type="date"
                          value={form.dob}
                          onChange={(v) => set("dob", v)}
                        />
                        <CheckField
                          label="Wants more coverage later"
                          checked={form.wantsMoreCoverageLater}
                          onChange={(v) => set("wantsMoreCoverageLater", v)}
                        />
                      </div>
                    </Panel>
                    <Panel title="Servicing">
                      <div className="grid gap-3">
                        <TextField
                          label="Writing agent"
                          value={form.writingAgent}
                          onChange={(v) => set("writingAgent", v)}
                        />
                        <TextField
                          label="Last received agent"
                          value={form.lastReceivedAgent}
                          onChange={(v) => set("lastReceivedAgent", v)}
                        />
                      </div>
                    </Panel>
                    <Panel title="Billing Address">
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          label="Street"
                          value={form.street}
                          onChange={(v) => set("street", v)}
                          className="col-span-2"
                        />
                        <TextField
                          label="City"
                          value={form.city}
                          onChange={(v) => set("city", v)}
                        />
                        <TextField
                          label="State"
                          value={form.state}
                          onChange={(v) => set("state", v)}
                        />
                        <TextField
                          label="ZIP"
                          value={form.zip}
                          onChange={(v) => set("zip", v)}
                        />
                      </div>
                    </Panel>
                    <Panel title="Shipping Address">
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          label="Street"
                          value={form.shipStreet}
                          onChange={(v) => set("shipStreet", v)}
                          className="col-span-2"
                        />
                        <TextField
                          label="City"
                          value={form.shipCity}
                          onChange={(v) => set("shipCity", v)}
                        />
                        <TextField
                          label="State"
                          value={form.shipState}
                          onChange={(v) => set("shipState", v)}
                        />
                        <TextField
                          label="ZIP"
                          value={form.shipZip}
                          onChange={(v) => set("shipZip", v)}
                        />
                      </div>
                    </Panel>
                  </div>
                </TabsContent>

                {/* CALL */}
                <TabsContent value="call" className="mt-0 h-full">
                  <div className="grid h-full gap-4 xl:grid-cols-2">
                    <Panel title="Initial Call Details">
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField
                          label="Call type"
                          value={form.callTypeId}
                          onChange={(v) => set("callTypeId", v)}
                          options={callTypes}
                        />
                        <SelectField
                          label="Current carrier"
                          value={form.currentCarrierId}
                          onChange={(v) => set("currentCarrierId", v)}
                          options={carriers}
                        />
                        <TextField
                          label="Current coverage amount"
                          value={form.currentCoverageAmount}
                          onChange={(v) => set("currentCoverageAmount", v)}
                        />
                        <CheckField
                          label="Spanish call?"
                          checked={form.spanishCall}
                          onChange={(v) => set("spanishCall", v)}
                        />
                        <div className="col-span-2">
                          <FieldLabel>Reason for calling</FieldLabel>
                          <Textarea
                            value={form.reasonForCalling}
                            onChange={(e) =>
                              set("reasonForCalling", e.target.value)
                            }
                            placeholder="Cash surrender, consolidation, more coverage…"
                            className="min-h-[120px] text-sm"
                          />
                        </div>
                      </div>
                    </Panel>
                    <Panel title="Notes" bodyClassName="flex flex-1 flex-col">
                      <FieldLabel>Call notes</FieldLabel>
                      <Textarea
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                        placeholder="What the client said, objections, follow-ups…"
                        className="min-h-[220px] flex-1 text-sm"
                      />
                    </Panel>
                  </div>
                </TabsContent>

                {/* HEALTH */}
                <TabsContent value="health" className="mt-0 h-full">
                  <div className="grid h-full gap-4 xl:grid-cols-2">
                    <Panel title="Health Details">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <FieldLabel>Major health conditions</FieldLabel>
                          <Textarea
                            value={form.majorHealthConditions}
                            onChange={(e) =>
                              set("majorHealthConditions", e.target.value)
                            }
                            placeholder="Diabetes, heart, cancer, COPD…"
                            className="min-h-[80px] text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <FieldLabel>
                            Conditions details / date of dx
                          </FieldLabel>
                          <Textarea
                            value={form.majorConditionsDetails}
                            onChange={(e) =>
                              set("majorConditionsDetails", e.target.value)
                            }
                            placeholder="Diagnosis dates, medications, severity…"
                            className="min-h-[80px] text-sm"
                          />
                        </div>
                        <TextField
                          label="Height"
                          value={form.height}
                          onChange={(v) => set("height", v)}
                          placeholder={`5' 10"`}
                        />
                        <TextField
                          label="Weight"
                          value={form.weight}
                          onChange={(v) => set("weight", v)}
                          placeholder="lbs"
                        />
                        <CheckField
                          label="Nicotine user"
                          checked={form.nicotineUser}
                          onChange={(v) => set("nicotineUser", v)}
                        />
                      </div>
                    </Panel>
                    <Panel title="Birthplace & Tobacco">
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          label="Birth country"
                          value={form.birthCountry}
                          onChange={(v) => set("birthCountry", v)}
                          placeholder="United States"
                        />
                        <TextField
                          label="Birth state"
                          value={form.birthState}
                          onChange={(v) => set("birthState", v)}
                        />
                      </div>
                    </Panel>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
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
