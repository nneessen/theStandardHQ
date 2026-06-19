// src/features/inbound-crm/components/clientForm/ClientRecordRail.tsx
// The always-visible caller/client context rail: contact summary, a 3-up stat strip, the client's
// existing policies, and recent inbound-call history. Props-driven (no live-call coupling) so it
// renders identically in the full-screen inbound modal and on the Clients detail page.
import { useMemo } from "react";
import { Panel, SummaryRow, StatusBadge } from "./primitives";
import { money, fmtDate, fmtPhone, ageFromDob, fmtDuration } from "./format";
import type { InboundCallHistoryRow } from "../../hooks/useInboundCallIntake";

// Raw policy row shape (getWithPolicies casts rows without camel-mapping → snake_case + carrier join).
export interface PolicyRow {
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

function railStats(policies: PolicyRow[]) {
  const active = policies.filter(
    (p) => (p.lifecycle_status ?? p.status ?? "").toLowerCase() === "active",
  ).length;
  const annual = policies.reduce((s, p) => s + (p.annual_premium ?? 0), 0);
  return { total: policies.length, active, annual };
}

export function ClientRecordRail({
  phone,
  email,
  dob,
  location,
  program,
  policies,
  history,
  className = "",
  style,
  contactTitle = "Caller",
}: {
  phone?: string | null;
  email?: string | null;
  dob?: string | null;
  location?: string | null;
  program?: string | null;
  policies: PolicyRow[];
  history: InboundCallHistoryRow[];
  className?: string;
  style?: React.CSSProperties;
  contactTitle?: string;
}) {
  const stats = useMemo(() => railStats(policies), [policies]);

  return (
    <aside className={`flex flex-col gap-3 ${className}`} style={style}>
      <Panel title={contactTitle}>
        <SummaryRow label="Phone" value={fmtPhone(phone)} />
        <SummaryRow label="Email" value={email} />
        <SummaryRow
          label="DOB"
          value={
            dob
              ? `${fmtDate(dob)}${ageFromDob(dob) ? ` · ${ageFromDob(dob)}` : ""}`
              : ""
          }
        />
        <SummaryRow label="Location" value={location} />
        {program ? <SummaryRow label="Program" value={program} /> : null}
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
                  <StatusBadge status={p.lifecycle_status ?? p.status} />
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

      <Panel title="Recent Calls" bodyClassName="p-0" className="flex-1">
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
                    {h.call_start ? fmtDate(h.call_start) : "In progress"}
                  </span>
                  <StatusBadge status={h.status} />
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-v2-ink-muted">
                  <span className="truncate">{h.call_program ?? "—"}</span>
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
  );
}
