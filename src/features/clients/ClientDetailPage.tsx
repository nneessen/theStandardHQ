// src/features/clients/ClientDetailPage.tsx
// Read view of one own-book client: identity, policy stats, their policies, and inbound-call history.
// Reuses clientService.getWithPolicies (via useClientDetail) + the inbound-crm call-history hook.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { useInboundCallHistory } from "@/features/inbound-crm";
import { formatDate } from "@/lib/format";
import { useClientDetail } from "./hooks/useClientDetail";
import { StatusBadge, Panel, money } from "./components/clientUi";

// Raw policy row shape (getWithPolicies casts rows without camel-mapping → snake_case + carrier join).
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

const fmtDuration = (s?: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
};
function parseAddr(s?: string | null) {
  if (!s) return "";
  try {
    const o = JSON.parse(s) as {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
    return [o.street, o.city, o.state, o.zipCode].filter(Boolean).join(", ");
  } catch {
    return s;
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
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

export function ClientDetailPage({ clientId }: { clientId: string }) {
  const { data: client, isLoading, isError, error } = useClientDetail(clientId);
  const { data: history = [] } = useInboundCallHistory(clientId);

  const policies = useMemo(
    () => (client?.policies ?? []) as unknown as PolicyRow[],
    [client],
  );
  const stats = useMemo(() => {
    const active = policies.filter(
      (p) => (p.lifecycle_status ?? p.status ?? "").toLowerCase() === "active",
    ).length;
    const annual = policies.reduce((s, p) => s + (p.annual_premium ?? 0), 0);
    return { total: policies.length, active, annual };
  }, [policies]);

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
          ) : isError || !client ? (
            <div className="py-16 text-center" style={{ color: "var(--red)" }}>
              {(error as Error)?.message ?? "Client not found."}
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-end justify-between gap-3">
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
                    {client.name || "Unnamed client"}
                  </h1>
                </div>
                <StatusBadge status={client.status} />
              </header>

              {/* stat strip */}
              <div className="grid max-w-md grid-cols-3 gap-2">
                {[
                  { k: "Policies", v: String(stats.total), c: "--blue" },
                  { k: "Active", v: String(stats.active), c: "--green" },
                  { k: "Premium / yr", v: money(stats.annual), c: "--violet" },
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

              <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                {/* left: identity + call history */}
                <div className="flex flex-col gap-4">
                  <Panel title="Contact">
                    <Row label="Phone" value={client.phone} />
                    <Row label="Email" value={client.email} />
                    <Row
                      label="DOB"
                      value={
                        client.date_of_birth
                          ? formatDate(client.date_of_birth)
                          : ""
                      }
                    />
                    <Row label="Address" value={parseAddr(client.address)} />
                  </Panel>

                  <Panel title="Call History" bodyClassName="p-0">
                    {history.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-v2-ink-subtle">
                        No inbound calls on record.
                      </div>
                    ) : (
                      <ul className="divide-y divide-v2-ring">
                        {history.map((h) => (
                          <li key={h.id} className="px-4 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-v2-ink">
                                {h.call_start
                                  ? formatDate(h.call_start)
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
                </div>

                {/* right: policies */}
                <Panel title="Policies" bodyClassName="p-0">
                  {policies.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-v2-ink-subtle">
                      No policies on file.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead
                        className="text-[11px] uppercase tracking-wide text-v2-ink-muted"
                        style={{ background: "var(--surface-3)" }}
                      >
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Carrier
                          </th>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Product
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            Premium
                          </th>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Effective
                          </th>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-v2-ring text-v2-ink"
                          >
                            <td className="px-4 py-2.5">
                              {p.carrier?.name ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 capitalize">
                              {String(p.product ?? "—").replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {money(p.monthly_premium)}/mo
                            </td>
                            <td className="px-4 py-2.5">
                              {p.effective_date
                                ? formatDate(p.effective_date)
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge
                                status={p.lifecycle_status ?? p.status}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </div>
            </>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
