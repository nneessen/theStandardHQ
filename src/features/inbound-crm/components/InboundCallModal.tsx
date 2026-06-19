// src/features/inbound-crm/components/InboundCallModal.tsx
// FULL-SCREEN client intake that takes over the screen when an inbound call routes to the agent.
// Rendered inside the authed shell (App.tsx) so it inherits the board theme + ImoContext + router.
// Driven by the realtime `activeCall` from InboundCallProvider. Models the owner's Salesforce client
// record (non-banking): Client Information, Initial Call Details, Health Details, Address, Existing
// Policies. Identity persists via clientService.update; the rich fields via crm_set_client_intake
// (clients.intake jsonb); the call disposition via crm_set_call_disposition. Banking/SSN is deferred.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useInboundCall } from "@/contexts/InboundCallContext";
import {
  useInboundCallTypes,
  useInboundCarriers,
} from "../hooks/useInboundCallDisposition";
import {
  useInboundClientRecord,
  useSaveInboundIntake,
} from "../hooks/useInboundCallIntake";

// ── small field helpers ──────────────────────────────────────────────────────
function Txt({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9"
      />
    </div>
  );
}
function Sel({
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
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-9">
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
function Chk({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 pt-5 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-emerald-500"
      />
      {label}
    </label>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/60 bg-[var(--surface-3,var(--card))] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface ClientIntake {
  title?: string;
  recordType?: string;
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
interface PolicyRow {
  id: string;
  product?: string | null;
  monthlyPremium?: number | null;
  effectiveDate?: string | null;
  status?: string | null;
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
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

export function InboundCallModal() {
  const { activeCall, dismiss } = useInboundCall();
  const clientId = activeCall?.client_id ?? null;

  const { data: record } = useInboundClientRecord(clientId);
  const { data: callTypes = [] } = useInboundCallTypes(
    activeCall?.imo_id ?? null,
  );
  const { data: carriers = [] } = useInboundCarriers(
    activeCall?.imo_id ?? null,
  );

  const [form, setForm] = useState(blankForm);
  const set = <K extends keyof typeof blankForm>(
    k: K,
    v: (typeof blankForm)[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  // (re)initialize the form whenever a new call pops or the client record loads
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

  const saveMut = useSaveInboundIntake();
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

  if (!activeCall) return null;

  const policies = (record?.policies ?? []) as unknown as PolicyRow[];
  const headerName = form.name || "New caller";
  const sub = [
    form.phone,
    form.state,
    activeCall.call_program ?? activeCall.offer_id,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog
      open={!!activeCall}
      onOpenChange={(o) => {
        if (!o) dismiss();
      }}
    >
      <DialogContent
        className="left-0 top-0 flex h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0"
        hideCloseButton
      >
        {/* header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-[var(--surface-6,var(--card))] px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Phone size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                Incoming call
              </div>
              <div className="truncate text-lg font-semibold text-foreground">
                {headerName}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {sub}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {clientId
                ? `${policies.length} ${policies.length === 1 ? "policy" : "policies"} on file`
                : "Not in your book yet"}
            </span>
            <Button variant="outline" onClick={dismiss}>
              Close
            </Button>
            <Button onClick={save} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-2">
            <Section title="Client Information">
              <div className="grid grid-cols-2 gap-3">
                <Txt
                  label="Name"
                  value={form.name}
                  onChange={(v) => set("name", v)}
                />
                <Txt
                  label="Title"
                  value={form.title}
                  onChange={(v) => set("title", v)}
                />
                <Txt
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => set("phone", v)}
                />
                <Txt
                  label="Email"
                  value={form.email}
                  onChange={(v) => set("email", v)}
                />
                <Txt
                  label="Date of birth"
                  type="date"
                  value={form.dob}
                  onChange={(v) => set("dob", v)}
                />
                <Chk
                  label="Wants more coverage later"
                  checked={form.wantsMoreCoverageLater}
                  onChange={(v) => set("wantsMoreCoverageLater", v)}
                />
                <Txt
                  label="Writing agent"
                  value={form.writingAgent}
                  onChange={(v) => set("writingAgent", v)}
                />
                <Txt
                  label="Last received agent"
                  value={form.lastReceivedAgent}
                  onChange={(v) => set("lastReceivedAgent", v)}
                />
              </div>
            </Section>

            <Section title="Initial Call Details">
              <div className="grid grid-cols-2 gap-3">
                <Sel
                  label="Call type"
                  value={form.callTypeId}
                  onChange={(v) => set("callTypeId", v)}
                  options={callTypes}
                />
                <Sel
                  label="Current carrier"
                  value={form.currentCarrierId}
                  onChange={(v) => set("currentCarrierId", v)}
                  options={carriers}
                />
                <Txt
                  label="Reason for calling"
                  value={form.reasonForCalling}
                  onChange={(v) => set("reasonForCalling", v)}
                />
                <Txt
                  label="Current coverage amount"
                  value={form.currentCoverageAmount}
                  onChange={(v) => set("currentCoverageAmount", v)}
                />
                <Chk
                  label="Spanish call?"
                  checked={form.spanishCall}
                  onChange={(v) => set("spanishCall", v)}
                />
                <div className="col-span-2">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Notes
                  </Label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Reason for calling, details…"
                  />
                </div>
              </div>
            </Section>

            <Section title="Health Details">
              <div className="grid grid-cols-2 gap-3">
                <Txt
                  label="Major health conditions"
                  value={form.majorHealthConditions}
                  onChange={(v) => set("majorHealthConditions", v)}
                />
                <Txt
                  label="Conditions details / date of dx"
                  value={form.majorConditionsDetails}
                  onChange={(v) => set("majorConditionsDetails", v)}
                />
                <Txt
                  label="Height"
                  value={form.height}
                  onChange={(v) => set("height", v)}
                />
                <Txt
                  label="Weight"
                  value={form.weight}
                  onChange={(v) => set("weight", v)}
                />
                <Chk
                  label="Nicotine user"
                  checked={form.nicotineUser}
                  onChange={(v) => set("nicotineUser", v)}
                />
                <div />
                <Txt
                  label="Birth country"
                  value={form.birthCountry}
                  onChange={(v) => set("birthCountry", v)}
                />
                <Txt
                  label="Birth state"
                  value={form.birthState}
                  onChange={(v) => set("birthState", v)}
                />
              </div>
            </Section>

            <Section title="Address">
              <div className="grid grid-cols-2 gap-3">
                <Txt
                  label="Billing street"
                  value={form.street}
                  onChange={(v) => set("street", v)}
                />
                <Txt
                  label="Billing city"
                  value={form.city}
                  onChange={(v) => set("city", v)}
                />
                <Txt
                  label="Billing state"
                  value={form.state}
                  onChange={(v) => set("state", v)}
                />
                <Txt
                  label="Billing ZIP"
                  value={form.zip}
                  onChange={(v) => set("zip", v)}
                />
                <Txt
                  label="Shipping street"
                  value={form.shipStreet}
                  onChange={(v) => set("shipStreet", v)}
                />
                <Txt
                  label="Shipping city"
                  value={form.shipCity}
                  onChange={(v) => set("shipCity", v)}
                />
                <Txt
                  label="Shipping state"
                  value={form.shipState}
                  onChange={(v) => set("shipState", v)}
                />
                <Txt
                  label="Shipping ZIP"
                  value={form.shipZip}
                  onChange={(v) => set("shipZip", v)}
                />
              </div>
            </Section>

            <section className="rounded-lg border border-border/60 bg-[var(--surface-3,var(--card))] p-4 lg:col-span-2">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Existing policies
              </h3>
              {policies.length === 0 ? (
                <div className="rounded-md border border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                  No policies on file.
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Carrier
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Product
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Premium
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Effective
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {policies.map((p) => (
                        <tr key={p.id} className="border-t border-border/40">
                          <td className="px-3 py-2">
                            {p.carrier?.name ?? "—"}
                          </td>
                          <td className="px-3 py-2 capitalize">
                            {String(p.product ?? "—").replace(/_/g, " ")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {money(p.monthlyPremium)}/mo
                          </td>
                          <td className="px-3 py-2">
                            {fmtDate(p.effectiveDate)}
                          </td>
                          <td className="px-3 py-2 capitalize">
                            {p.status ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="text-xs text-muted-foreground lg:col-span-2">
              Banking &amp; sensitive info (SSN / bank / card) is deferred — it
              needs encrypted storage + access approval, tracked separately.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
