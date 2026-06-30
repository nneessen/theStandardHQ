// src/features/clients/ClientsPage.tsx
// The signed-in agent's own-book client list. Built with the EXACT same chrome and table styling
// as the Policies page (src/features/policies/PolicyList.tsx) so the two tables are visually
// identical: BoardListHeader + SoftCard, the shared @/components/ui/table primitives with the same
// header/row/cell classes, clickable sortable headers (toggleSort + ChevronUp/ChevronDown), and the
// same numbered pagination footer. Search + user-customizable columns (persisted via localStorage).
// Each row opens the client detail page. Real data only via useClients.
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Users,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
} from "lucide-react";
import { SectionShell, SoftCard, PillButton } from "@/components/v2";
import { BoardListHeader } from "@/components/board";
import { LogoSpinner } from "@/components/ui/logo-spinner";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
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
  emphasis?: "strong" | "muted";
  // Value used for sorting. Strings sort case-insensitively; numbers numerically.
  sortValue: (c: ClientWithStats) => string | number;
  render: (c: ClientWithStats) => React.ReactNode;
}

const COLUMNS: Column[] = [
  {
    id: "name",
    label: "Name",
    always: true,
    emphasis: "strong",
    sortValue: (c) => (c.name ?? "").toLowerCase(),
    render: (c) => c.name || "—",
  },
  {
    id: "email",
    label: "Email",
    emphasis: "muted",
    sortValue: (c) => (c.email ?? "").toLowerCase(),
    render: (c) => c.email || "—",
  },
  {
    id: "phone",
    label: "Phone",
    emphasis: "muted",
    sortValue: (c) => c.phone ?? "",
    render: (c) => c.phone || "—",
  },
  {
    id: "policies",
    label: "Policies",
    align: "right",
    sortValue: (c) => c.policy_count,
    render: (c) => c.policy_count,
  },
  {
    id: "active",
    label: "Active",
    align: "right",
    sortValue: (c) => c.active_policy_count,
    render: (c) => c.active_policy_count,
  },
  {
    id: "premium",
    label: "Premium / yr",
    align: "right",
    sortValue: (c) => c.total_premium ?? 0,
    render: (c) => money(c.total_premium),
  },
  {
    id: "avgPremium",
    label: "Avg premium",
    align: "right",
    sortValue: (c) => c.avg_premium ?? 0,
    render: (c) => money(c.avg_premium),
  },
  {
    id: "lastPolicy",
    label: "Last policy",
    emphasis: "muted",
    sortValue: (c) => c.last_policy_date ?? "",
    render: (c) => (c.last_policy_date ? formatDate(c.last_policy_date) : "—"),
  },
  {
    id: "created",
    label: "Added",
    emphasis: "muted",
    sortValue: (c) => c.created_at ?? "",
    render: (c) => (c.created_at ? formatDate(c.created_at) : "—"),
  },
  {
    id: "status",
    label: "Status",
    sortValue: (c) => c.status ?? "",
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

type SortDir = "asc" | "desc";

export function ClientsPage() {
  const { data: clients = [], isLoading, isError, error } = useClients();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });
  const [visibility, setVisibility] = useLocalStorage<Record<string, boolean>>(
    "clients-table-columns-v1",
    DEFAULT_VISIBILITY,
  );
  const navigate = useNavigate();

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => c.always || visibility[c.id]),
    [visibility],
  );

  // Compact metric strip for the board header (mirrors the Policies page stats).
  const totals = useMemo(() => {
    let policies = 0;
    let active = 0;
    let premium = 0;
    for (const c of clients) {
      policies += c.policy_count ?? 0;
      active += c.active_policy_count ?? 0;
      premium += c.total_premium ?? 0;
    }
    return { clients: clients.length, policies, active, premium };
  }, [clients]);

  // Click a header to sort by it; click again to flip direction (same pattern as PolicyList).
  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
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

    const col = COLUMNS.find((c) => c.id === sort.key) ?? COLUMNS[0];
    return [...list].sort((a, b) => {
      const av = col.sortValue(a);
      const bv = col.sortValue(b);
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [clients, q, sort]);

  const {
    paginatedData,
    pagination,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
  } = usePagination(rows, { initialPageSize: 25 });

  const {
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageSize,
  } = pagination;

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto flex w-full max-w-[2400px] flex-col gap-5 px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-2">
          <BoardListHeader
            icon={<Users className="h-4 w-4 text-foreground" />}
            title="Clients"
            stats={
              clients.length ? (
                <div className="flex items-center gap-x-2 gap-y-0.5 text-[15px] text-muted-foreground flex-wrap leading-tight">
                  <span>
                    <span className="text-foreground font-semibold">
                      {totals.clients.toLocaleString()}
                    </span>{" "}
                    clients
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    <span className="text-foreground font-semibold">
                      {totals.active.toLocaleString()}
                    </span>{" "}
                    active
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span>
                    <span className="text-foreground font-semibold">
                      {totals.policies.toLocaleString()}
                    </span>{" "}
                    policies
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span>
                    <span className="text-foreground font-semibold">
                      ${(totals.premium / 1000).toFixed(1)}k
                    </span>{" "}
                    premium
                  </span>
                </div>
              ) : undefined
            }
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <PillButton
                    tone="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                  >
                    <SlidersHorizontal size={11} />
                    Columns
                  </PillButton>
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
            }
          />

          {/* Table card */}
          <SoftCard
            padding="none"
            lift
            className="overflow-hidden flex flex-col"
          >
            {/* Search (compact, single row) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-v2-card-tinted">
              <div className="flex-1 relative flex items-center min-w-0">
                <Search
                  size={12}
                  className="absolute left-2.5 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Search by name, phone, or email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-7 pl-7 text-[11px] bg-card border-border rounded-v2-pill focus-visible:ring-accent"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="h-8 border-b border-border dark:border-border hover:bg-transparent">
                    {visibleColumns.map((c) => (
                      <TableHead
                        key={c.id}
                        onClick={() => toggleSort(c.id)}
                        className={cn(
                          "text-[12px] font-semibold text-muted-foreground dark:text-muted-foreground px-2 cursor-pointer hover:text-foreground dark:hover:text-background transition-colors",
                          c.align === "right" && "text-right",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            c.align === "right" && "justify-end",
                          )}
                        >
                          {c.label}
                          {sort.key === c.id &&
                            (sort.dir === "asc" ? (
                              <ChevronUp size={12} />
                            ) : (
                              <ChevronDown size={12} />
                            ))}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length}
                        className="text-center py-12"
                      >
                        <LogoSpinner size="xl" className="mr-2" />
                        Your clients are loading...
                      </TableCell>
                    </TableRow>
                  ) : isError ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length}
                        className="text-center py-12"
                      >
                        <span className="text-[11px] text-destructive">
                          {(error as Error)?.message ??
                            "Failed to load clients."}
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length}
                        className="text-center py-12"
                      >
                        <div className="flex flex-col items-center justify-center p-4">
                          <Users className="h-8 w-8 text-muted-foreground dark:text-muted-foreground mb-2" />
                          <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                            {q
                              ? "No clients match your search"
                              : "No clients on your book yet"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((c) => (
                      <TableRow
                        key={c.id}
                        onClick={() =>
                          navigate({
                            to: "/clients/$clientId",
                            params: { clientId: c.id },
                          })
                        }
                        className="h-9 border-b border-border dark:border-border/50 hover:bg-background dark:hover:bg-v2-card-tinted/50 transition-colors cursor-pointer"
                      >
                        {visibleColumns.map((col) => (
                          <TableCell
                            key={col.id}
                            className={cn(
                              "text-[14px] py-1.5 px-2",
                              col.align === "right" &&
                                "text-right tabular-nums",
                              col.emphasis === "strong" &&
                                "text-foreground dark:text-foreground font-medium",
                              col.emphasis === "muted" &&
                                "text-muted-foreground dark:text-muted-foreground",
                            )}
                          >
                            {col.render(c)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {!isLoading && !isError && totalItems > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-border dark:border-border flex-shrink-0">
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="text-muted-foreground dark:text-muted-foreground">
                    <span className="font-medium text-foreground dark:text-foreground">
                      {startIndex + 1}
                    </span>
                    -
                    <span className="font-medium text-foreground dark:text-foreground">
                      {endIndex}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-foreground dark:text-foreground">
                      {totalItems}
                    </span>
                  </span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => setPageSize(Number(value))}
                  >
                    <SelectTrigger className="h-6 w-[80px] text-[13px] bg-card border-border dark:border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="25">25 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                      <SelectItem value="100">100 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-background"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    onClick={previousPage}
                    disabled={currentPage === 1}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-background"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>

                  <div className="hidden sm:flex items-center gap-0.5">
                    {(() => {
                      const pages = [];
                      const maxVisible = 5;
                      let start = Math.max(
                        1,
                        currentPage - Math.floor(maxVisible / 2),
                      );
                      const end = Math.min(totalPages, start + maxVisible - 1);

                      if (end - start < maxVisible - 1) {
                        start = Math.max(1, end - maxVisible + 1);
                      }

                      if (start > 1) {
                        pages.push(
                          <Button
                            key={1}
                            onClick={() => goToPage(1)}
                            variant="ghost"
                            size="sm"
                            className="h-6 min-w-6 px-1.5 text-[13px] text-muted-foreground dark:text-muted-foreground"
                          >
                            1
                          </Button>,
                        );
                        if (start > 2) {
                          pages.push(
                            <span
                              key="dots1"
                              className="px-0.5 text-muted-foreground dark:text-muted-foreground text-[13px]"
                            >
                              ...
                            </span>,
                          );
                        }
                      }

                      for (let i = start; i <= end; i++) {
                        pages.push(
                          <Button
                            key={i}
                            onClick={() => goToPage(i)}
                            variant={currentPage === i ? "default" : "ghost"}
                            size="sm"
                            className={cn(
                              "h-6 min-w-6 px-1.5 text-[13px]",
                              currentPage !== i &&
                                "text-muted-foreground dark:text-muted-foreground",
                            )}
                          >
                            {i}
                          </Button>,
                        );
                      }

                      if (end < totalPages) {
                        if (end < totalPages - 1) {
                          pages.push(
                            <span
                              key="dots2"
                              className="px-0.5 text-muted-foreground dark:text-muted-foreground text-[13px]"
                            >
                              ...
                            </span>,
                          );
                        }
                        pages.push(
                          <Button
                            key={totalPages}
                            onClick={() => goToPage(totalPages)}
                            variant="ghost"
                            size="sm"
                            className="h-6 min-w-6 px-1.5 text-[13px] text-muted-foreground dark:text-muted-foreground"
                          >
                            {totalPages}
                          </Button>,
                        );
                      }

                      return pages;
                    })()}
                  </div>

                  <Button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-background"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-background"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </SoftCard>
        </div>
      </div>
    </SectionShell>
  );
}
