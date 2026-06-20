// src/features/clients/ClientsPage.tsx
// The signed-in agent's own-book client list. Dense, board-styled table (matches the Policies page)
// with search, pagination, and user-customizable columns (persisted per the app's localStorage
// UI-pref convention). Each row opens the client detail page. Real data only via useClients.
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClients } from "@/hooks/clients";
import { usePagination, useLocalStorage } from "@/hooks/base";
import { formatDate } from "@/lib/format";
import type { ClientWithStats } from "@/types/client.types";
import { StatusBadge, money } from "./components/clientUi";

interface Column {
  id: string;
  label: string;
  always?: boolean;
  align?: "right";
  render: (c: ClientWithStats) => React.ReactNode;
}

const COLUMNS: Column[] = [
  {
    id: "name",
    label: "Name",
    always: true,
    render: (c) => (
      <span className="font-semibold text-v2-ink">{c.name || "—"}</span>
    ),
  },
  { id: "email", label: "Email", render: (c) => c.email || "—" },
  { id: "phone", label: "Phone", render: (c) => c.phone || "—" },
  {
    id: "policies",
    label: "Policies",
    align: "right",
    render: (c) => c.policy_count,
  },
  {
    id: "active",
    label: "Active",
    align: "right",
    render: (c) => c.active_policy_count,
  },
  {
    id: "premium",
    label: "Premium / yr",
    align: "right",
    render: (c) => money(c.total_premium),
  },
  {
    id: "avgPremium",
    label: "Avg premium",
    align: "right",
    render: (c) => money(c.avg_premium),
  },
  {
    id: "lastPolicy",
    label: "Last policy",
    render: (c) => (c.last_policy_date ? formatDate(c.last_policy_date) : "—"),
  },
  {
    id: "created",
    label: "Added",
    render: (c) => (c.created_at ? formatDate(c.created_at) : "—"),
  },
  {
    id: "status",
    label: "Status",
    render: (c) => <StatusBadge status={c.status} />,
  },
];

// Default visible set. Status is OFF (every client is 'active' → noise); avg/last/added off to
// keep the default view tight — all toggleable via the column picker.
const DEFAULT_VISIBILITY: Record<string, boolean> = {
  name: true,
  email: true,
  phone: true,
  policies: true,
  active: true,
  premium: true,
  avgPremium: false,
  lastPolicy: false,
  created: false,
  status: false,
};

export function ClientsPage() {
  const { data: clients = [], isLoading, isError, error } = useClients();
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useLocalStorage<Record<string, boolean>>(
    "clients-table-columns-v1",
    DEFAULT_VISIBILITY,
  );
  const navigate = useNavigate();

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => c.always || visibility[c.id]),
    [visibility],
  );

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

  const { paginatedData, pagination, nextPage, previousPage, setPageSize } =
    usePagination(rows, { initialPageSize: 25 });

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
            <div className="flex items-center gap-2">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 gap-1.5 text-sm">
                    <SlidersHorizontal size={15} />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  {COLUMNS.filter((c) => !c.always).map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={!!visibility[c.id]}
                      onCheckedChange={(checked) =>
                        setVisibility({ ...visibility, [c.id]: !!checked })
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      {c.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="min-w-0 overflow-hidden rounded-lg border border-v2-ring bg-v2-card shadow-board-panel">
            <table className="w-full text-sm">
              <thead
                className="text-[11px] uppercase tracking-wide text-v2-ink-muted"
                style={{ background: "var(--surface-3)" }}
              >
                <tr>
                  {visibleColumns.map((c) => (
                    <th
                      key={c.id}
                      className={`px-4 py-2.5 font-semibold ${
                        c.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      className="px-4 py-10 text-center text-v2-ink-subtle"
                    >
                      Loading clients…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      className="px-4 py-10 text-center"
                      style={{ color: "var(--red)" }}
                    >
                      {(error as Error)?.message ?? "Failed to load clients."}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      className="px-4 py-10 text-center text-v2-ink-subtle"
                    >
                      {q
                        ? "No clients match your search."
                        : "No clients on your book yet."}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((c) => (
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
                      {visibleColumns.map((col) => (
                        <td
                          key={col.id}
                          className={`px-4 py-2.5 ${
                            col.align === "right"
                              ? "text-right tabular-nums text-v2-ink"
                              : "text-v2-ink-muted"
                          }`}
                        >
                          {col.render(c)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* pagination */}
            {!isLoading && !isError && rows.length > 0 && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t border-v2-ring px-4 py-2.5 text-xs text-v2-ink-muted"
                style={{ background: "var(--surface-2)" }}
              >
                <span>
                  {pagination.startIndex + 1}–{pagination.endIndex} of{" "}
                  {pagination.totalItems}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>Rows</span>
                    <Select
                      value={String(pagination.pageSize)}
                      onValueChange={(v) => setPageSize(Number(v))}
                    >
                      <SelectTrigger className="h-7 w-[68px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 25, 50, 100].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span>
                    Page {pagination.currentPage} of{" "}
                    {pagination.totalPages || 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={previousPage}
                      disabled={pagination.currentPage <= 1}
                    >
                      <ChevronLeft size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={nextPage}
                      disabled={pagination.currentPage >= pagination.totalPages}
                    >
                      <ChevronRight size={15} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
