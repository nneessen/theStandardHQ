// src/features/clients/ClientsPage.tsx
// The signed-in agent's own-book client list. Dense, board-styled table (matches the Policies page);
// each row opens the client detail page. Real data only via useClients (RLS-scoped to the agent).
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/clients";
import { StatusBadge, money } from "./components/clientUi";

export function ClientsPage() {
  const { data: clients = [], isLoading, isError, error } = useClients();
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? clients.filter(
          (c) =>
            c.name?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.phone?.includes(term),
        )
      : clients;
    return [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [clients, q]);

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>MY BOOK</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Clients
              </h1>
            </div>
            <div className="relative w-full max-w-xs">
              <Search
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-v2-ink-subtle"
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, email…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </header>

          <div className="min-w-0 overflow-hidden rounded-lg border border-v2-ring bg-v2-card shadow-board-panel">
            <table className="w-full text-sm">
              <thead
                className="text-[11px] uppercase tracking-wide text-v2-ink-muted"
                style={{ background: "var(--surface-3)" }}
              >
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Phone</th>
                  <th className="px-4 py-2.5 text-left font-semibold">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Policies
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Active
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Premium / yr
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-v2-ink-subtle"
                    >
                      Loading clients…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center"
                      style={{ color: "var(--red)" }}
                    >
                      {(error as Error)?.message ?? "Failed to load clients."}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-v2-ink-subtle"
                    >
                      {q
                        ? "No clients match your search."
                        : "No clients on your book yet."}
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() =>
                        navigate({
                          to: "/clients/$clientId",
                          params: { clientId: c.id },
                        })
                      }
                      className="cursor-pointer border-t border-v2-ring transition-colors hover:bg-[var(--surface-4)]"
                    >
                      <td className="px-4 py-2.5 font-semibold text-v2-ink">
                        {c.name || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-v2-ink-muted">
                        {c.phone || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-v2-ink">
                        {c.policy_count}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-v2-ink">
                        {c.active_policy_count}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-v2-ink">
                        {money(c.total_premium)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
