// src/features/policies/PolicyList.tsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import {
  Edit,
  Trash2,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  XCircle,
  Plus,
  FileText,
  Link2Off,
  Link2,
  Download,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateForDB, parseLocalDate } from "@/lib/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillButton, SoftCard } from "@/components/v2";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCarriers } from "../../hooks/carriers";
import { useCommissions } from "../../hooks/commissions/useCommissions";
import { useUpdateCommissionStatus } from "../../hooks/commissions/useUpdateCommissionStatus";
import {
  useUpdatePolicy,
  useDeletePolicy,
  usePoliciesPaginated,
  useCheckSharedClient,
} from "../../hooks/policies";
import type { SortConfig } from "./hooks/usePolicies";
import {
  Policy,
  PolicyFilters,
  PolicyStatus,
  PolicyLifecycleStatus,
} from "../../types/policy.types";
import { ProductType } from "../../types/product.types";
import { formatCurrency, formatDate } from "../../lib/format";
import { LeadPurchaseLinkDialog } from "./components/LeadPurchaseLinkDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { policyQueries } from "./queries";
import { toast } from "sonner";
import {
  flattenPoliciesForExport,
  exportPoliciesToCSV,
  exportPoliciesToExcel,
} from "./utils/policyExport";
import type { Commission } from "@/types/commission.types";
import { useFeatureAccess } from "@/hooks/subscription";

interface PolicyListProps {
  onEditPolicy: (policyId: string) => void;
  onNewPolicy: () => void;
}

const PRODUCT_ABBREV: Record<string, string> = {
  whole_life: "Whole",
  term_life: "Term",
  universal_life: "UL",
  indexed_universal_life: "IUL",
  variable_life: "VL",
  variable_universal_life: "VUL",
  final_expense: "Final",
  accidental: "AD&D",
  health: "Health",
  disability: "Disability",
  annuity: "Ann",
};

type DateColumnType = "effective" | "submit";

export const PolicyList: React.FC<PolicyListProps> = ({
  onEditPolicy,
  onNewPolicy,
}) => {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(10);
  const [filters, setFiltersState] = useState<PolicyFilters>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "created_at",
    direction: "desc",
  });

  // Date column type state with localStorage persistence
  const [dateColumnType, setDateColumnType] = useState<DateColumnType>(() => {
    const stored = localStorage.getItem("policies-date-column-type");
    return stored === "effective" ? "effective" : "submit"; // Default: submit
  });

  useEffect(() => {
    localStorage.setItem("policies-date-column-type", dateColumnType);
  }, [dateColumnType]);

  // Helper to get the sort field dynamically based on date column type
  const getDateSortField = () =>
    dateColumnType === "effective" ? "effective_date" : "submit_date";

  // Thread dateColumnType into the filters so the custom date range picker
  // filters on whichever column the user is currently viewing. Memoized so
  // the query hook's cache key only changes when something meaningful flips.
  const queryFilters = useMemo<PolicyFilters>(
    () => ({
      ...filters,
      dateField:
        dateColumnType === "effective" ? "effective_date" : "submit_date",
    }),
    [filters, dateColumnType],
  );

  const {
    policies,
    isLoading,
    error,
    totalCount: totalItems,
    totalPages,
    metrics,
    refetch: refresh,
  } = usePoliciesPaginated({
    page: currentPage,
    pageSize,
    filters: queryFilters,
    sortConfig,
  });

  // Pagination helpers
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) setCurrentPage(page);
    },
    [totalPages],
  );
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1);
  }, [currentPage, totalPages]);
  const previousPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  }, [currentPage]);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);
  const setFilters = useCallback((newFilters: PolicyFilters) => {
    setFiltersState(newFilters);
    setCurrentPage(1);
  }, []);
  const clearFilters = useCallback(() => {
    setFiltersState({});
    setCurrentPage(1);
  }, []);
  const toggleSort = useCallback((field: string) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  }, []);
  const filterCount = Object.entries(filters).filter(
    ([_, value]) => value !== undefined && value !== null && value !== "",
  ).length;

  const queryClient = useQueryClient();
  const { data: carriers = [] } = useCarriers();
  const { data: commissions = [] } = useCommissions();
  const { mutate: updateCommissionStatus } = useUpdateCommissionStatus();
  const { mutate: updatePolicy } = useUpdatePolicy();
  const { mutate: deletePolicy, isPending: isDeleting } = useDeletePolicy();
  const { mutateAsync: checkSharedClient } = useCheckSharedClient();
  const getCarrierById = (id: string) => carriers.find((c) => c.id === id);

  // Commission amounts are a Pro feature; status tracking is available to all tiers
  const { hasAccess: canViewCommissions } = useFeatureAccess("dashboard");

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [policyToLink, setPolicyToLink] = useState<Policy | null>(null);
  const [exporting, setExporting] = useState(false);

  // Create a map of policy_id -> commission for quick lookup
  // Priority: active/earned/pending commissions over cancelled ones
  // If multiple active commissions exist, keep the one with the highest amount
  const commissionsByPolicy = commissions.reduce(
    (acc, commission) => {
      if (!commission.policyId) return acc;

      const existing = acc[commission.policyId];
      const isActiveStatus = (status: string) =>
        status !== "cancelled" && status !== "chargedback";

      if (!existing) {
        // No commission for this policy yet, add it
        acc[commission.policyId] = commission;
      } else {
        // Compare: prefer active over cancelled, then prefer higher amount
        const existingIsActive = isActiveStatus(existing.status);
        const currentIsActive = isActiveStatus(commission.status);

        if (currentIsActive && !existingIsActive) {
          // Current is active, existing is cancelled - use current
          acc[commission.policyId] = commission;
        } else if (currentIsActive && existingIsActive) {
          // Both active - use the one with higher amount
          if ((commission.amount || 0) > (existing.amount || 0)) {
            acc[commission.policyId] = commission;
          }
        }
        // If existing is active and current is cancelled, keep existing (do nothing)
      }
      return acc;
    },
    {} as Record<string, (typeof commissions)[0]>,
  );

  // When filters are active, fetch all matching policy IDs to scope commission metrics
  const hasActiveFilters = filterCount > 0;
  const { data: allFilteredPolicies } = useQuery({
    ...policyQueries.list(filters),
    enabled: hasActiveFilters,
  });

  // Scope commissions to filtered policies when filters are active
  const filteredPolicyIds =
    hasActiveFilters && allFilteredPolicies
      ? new Set(allFilteredPolicies.map((p) => p.id))
      : null;
  const commissionsForMetrics = filteredPolicyIds
    ? commissions.filter((c) => c.policyId && filteredPolicyIds.has(c.policyId))
    : commissions;

  // Commission metrics scoped to current filter selection
  // Only count commissions that have actually been paid out (advanced to agent)
  const paidCommissions = commissionsForMetrics.filter(
    (c) => c.status === "paid",
  );
  const earnedCommission = paidCommissions.reduce(
    (sum, c) => sum + (c.earnedAmount || 0),
    0,
  );
  const pendingCommission = commissionsForMetrics
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const _totalAdvances = paidCommissions.reduce(
    (sum, c) => sum + (c.amount || 0),
    0,
  );

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltersState((prev) => ({ ...prev, searchTerm }));
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleDeletePolicy = async (policyId: string, clientName: string) => {
    // Check if client is shared with other policies first
    try {
      const { isShared, otherPoliciesCount } =
        await checkSharedClient(policyId);

      let message = "Are you sure you want to delete this policy?";
      if (isShared) {
        message = `This client "${clientName}" has ${otherPoliciesCount} other ${otherPoliciesCount === 1 ? "policy" : "policies"}. Only this policy will be deleted. Continue?`;
      } else {
        message = `Are you sure you want to delete this policy? The client "${clientName}" will also be removed since this is their only policy.`;
      }

      if (window.confirm(message)) {
        deletePolicy(policyId);
      }
    } catch {
      // If check fails, fall back to simple confirmation
      if (window.confirm("Are you sure you want to delete this policy?")) {
        deletePolicy(policyId);
      }
    }
  };

  const handleStatusChange = (
    commission: { id: string },
    newStatus: string,
    policy: Policy,
  ) => {
    updateCommissionStatus(
      {
        commissionId: commission.id,
        status: newStatus as "pending" | "unpaid" | "paid" | "charged_back",
        policyId: policy.id,
      },
      {
        onError: (error) => {
          alert(`Failed to update status: ${error.message}`);
        },
      },
    );
  };

  const handleCancelPolicy = (policyId: string) => {
    if (!window.confirm("Are you sure you want to cancel this policy?")) {
      return;
    }

    updatePolicy(
      {
        id: policyId,
        lifecycleStatus: "cancelled",
        reason: "Manually cancelled by user",
        cancelDate: new Date(),
      },
      {
        onSuccess: () => {
          alert("Policy cancelled successfully.");
        },
        onError: (error) => {
          alert(`Failed to cancel policy: ${error.message}`);
        },
      },
    );
  };

  const handleLapsePolicy = (policyId: string) => {
    if (!window.confirm("Mark this policy as lapsed?")) {
      return;
    }

    updatePolicy(
      {
        id: policyId,
        lifecycleStatus: "lapsed",
        lapseDate: new Date(),
        reason: "Client stopped paying premiums",
      },
      {
        onSuccess: () => {
          alert("Policy marked as lapsed.");
        },
        onError: (error) => {
          alert(`Failed to mark policy as lapsed: ${error.message}`);
        },
      },
    );
  };

  const handleReinstatePolicy = (
    policyId: string,
    currentLifecycleStatus: "cancelled" | "lapsed",
  ) => {
    const reason = window.prompt(
      "Please provide a reason for reinstating this policy:",
    );
    if (!reason) return;

    updatePolicy(
      {
        id: policyId,
        lifecycleStatus: "active",
        previousLifecycleStatus: currentLifecycleStatus,
        reason,
      },
      {
        onSuccess: () => {
          alert("Policy reinstated successfully.");
        },
        onError: (error) => {
          alert(`Failed to reinstate policy: ${error.message}`);
        },
      },
    );
  };

  const handleExport = async (format: "csv" | "excel") => {
    setExporting(true);
    try {
      const allPolicies = await queryClient.fetchQuery(
        policyQueries.list(filters),
      );
      const carrierMap: Record<string, string> = Object.fromEntries(
        carriers.map((c) => [c.id, c.name]),
      );
      const commissionMap: Record<string, Commission> = {};
      for (const c of commissions) {
        if (c.policyId && !commissionMap[c.policyId]) {
          commissionMap[c.policyId] = c;
        }
      }
      const rows = flattenPoliciesForExport(
        allPolicies,
        carrierMap,
        commissionMap,
      );
      if (format === "csv") {
        exportPoliciesToCSV(rows);
      } else {
        await exportPoliciesToExcel(rows);
      }
      toast.success(`Exported ${rows.length} policies`);
    } catch (err) {
      toast.error(
        `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Compact header: title + inline metric chips + actions in ONE row */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <FileText className="h-4 w-4 text-foreground" />
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              Policies
            </h1>
          </div>
          {metrics && (
            <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground flex-wrap leading-tight">
              <span>
                <span className="text-foreground font-semibold">
                  {metrics.totalPolicies.toLocaleString()}
                </span>{" "}
                total
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-foreground font-semibold">
                  {metrics.activePolicies.toLocaleString()}
                </span>{" "}
                active
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-foreground font-semibold">
                  {metrics.pendingPolicies.toLocaleString()}
                </span>{" "}
                pending
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                <span className="text-foreground font-semibold">
                  ${(metrics.totalPremium / 1000).toFixed(1)}k
                </span>{" "}
                premium
              </span>
              {canViewCommissions && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span>
                    <span className="text-success font-semibold">
                      ${(earnedCommission / 1000).toFixed(1)}k
                    </span>{" "}
                    earned
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span>
                    <span className="text-warning font-semibold">
                      ${(pendingCommission / 1000).toFixed(1)}k
                    </span>{" "}
                    pending
                  </span>
                </>
              )}
              <span className="text-muted-foreground">·</span>
              <span>
                <span className="text-foreground font-semibold">
                  {metrics.ytdPolicies.toLocaleString()}
                </span>{" "}
                YTD
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PillButton
                tone="ghost"
                size="sm"
                disabled={exporting}
                className="h-7 px-2.5 text-[11px]"
              >
                <Download className="h-3 w-3" />
                {exporting ? "Exporting…" : "Export"}
              </PillButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleExport("csv")}
                className="text-[11px]"
              >
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("excel")}
                className="text-[11px]"
              >
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PillButton
            onClick={onNewPolicy}
            tone="black"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
          >
            <Plus className="h-3 w-3" />
            New policy
          </PillButton>
        </div>
      </header>

      {/* Table card */}
      <SoftCard padding="none" className="overflow-hidden flex flex-col">
        {/* Search + filter toggle (compact, single row) */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-card-tinted">
          <div className="flex-1 relative flex items-center min-w-0">
            <Search
              size={12}
              className="absolute left-2.5 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search by policy # or client name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 pl-7 text-[11px] bg-card border-border rounded-v2-pill focus-visible:ring-accent"
            />
          </div>
          <PillButton
            onClick={() => setShowFilters(!showFilters)}
            tone={showFilters ? "black" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-[11px]"
          >
            <Filter size={11} />
            Filters
            {filterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-v2-pill bg-accent text-foreground text-[9px] font-bold">
                {filterCount}
              </span>
            )}
          </PillButton>
          {filterCount > 0 && (
            <PillButton
              onClick={clearFilters}
              tone="ghost"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
            >
              Clear
            </PillButton>
          )}
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-background dark:bg-card-tinted/50 border-b border-border dark:border-border">
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  status: value === "all" ? undefined : (value as PolicyStatus),
                })
              }
            >
              <SelectTrigger className="h-6 w-[100px] text-[10px] bg-card border-border dark:border-border">
                <SelectValue placeholder="Application" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Apps</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.lifecycleStatus || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  lifecycleStatus:
                    value === "all"
                      ? undefined
                      : (value as PolicyLifecycleStatus),
                })
              }
            >
              <SelectTrigger className="h-6 w-[100px] text-[10px] bg-card border-border dark:border-border">
                <SelectValue placeholder="Lifecycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lifecycle</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="lapsed">Lapsed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.product || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  product: value === "all" ? undefined : (value as ProductType),
                })
              }
            >
              <SelectTrigger className="h-6 w-[110px] text-[10px] bg-card border-border dark:border-border">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="whole_life">Whole Life</SelectItem>
                <SelectItem value="term_life">Term Life</SelectItem>
                <SelectItem value="universal_life">Universal Life</SelectItem>
                <SelectItem value="indexed_universal_life">IUL</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.carrierId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  carrierId: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger className="h-6 w-[130px] text-[10px] bg-card border-border dark:border-border">
                <SelectValue placeholder="Carrier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Carriers</SelectItem>
                {carriers.map((carrier) => (
                  <SelectItem key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DateRangePicker
              value={{
                from: filters.dateFrom
                  ? parseLocalDate(filters.dateFrom)
                  : undefined,
                to: filters.dateTo ? parseLocalDate(filters.dateTo) : undefined,
              }}
              onChange={(range) => {
                setFilters({
                  ...filters,
                  dateFrom: range.from
                    ? formatDateForDB(range.from)
                    : undefined,
                  dateTo: range.to ? formatDateForDB(range.to) : undefined,
                });
              }}
              placeholder={
                dateColumnType === "effective"
                  ? "Effective Date Range"
                  : "Submit Date Range"
              }
              className="h-6"
            />
          </div>
        )}

        {/* Table Container - Desktop Only */}
        <div className="hidden md:block flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="h-8 border-b border-border dark:border-border hover:bg-transparent">
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2 cursor-pointer hover:text-foreground dark:hover:text-background transition-colors"
                  onClick={() => toggleSort("policy_number")}
                >
                  <div className="flex items-center gap-1">
                    Policy
                    {sortConfig.field === "policy_number" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2 cursor-pointer hover:text-foreground dark:hover:text-background transition-colors"
                  onClick={() => toggleSort("client")}
                >
                  <div className="flex items-center gap-1">
                    Client
                    {sortConfig.field === "client" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2">
                  Carrier/Product
                </TableHead>
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2 cursor-pointer hover:text-foreground dark:hover:text-background transition-colors"
                  onClick={() => toggleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortConfig.field === "status" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2 text-right cursor-pointer hover:text-foreground dark:hover:text-background transition-colors"
                  onClick={() => toggleSort("annual_premium")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Premium
                    {sortConfig.field === "annual_premium" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                {canViewCommissions && (
                  <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2 text-right">
                    Commission
                  </TableHead>
                )}
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2 text-center">
                  Comm Status
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 px-1.5 py-0.5 -ml-1.5 rounded hover:bg-card-tinted dark:hover:bg-card-tinted transition-colors group">
                        <span className="group-hover:text-foreground dark:group-hover:text-background">
                          {dateColumnType === "effective"
                            ? "Effective"
                            : "Submit"}
                        </span>
                        <ChevronDown
                          size={12}
                          className="text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="min-w-[160px]"
                    >
                      <DropdownMenuItem
                        onClick={() => setDateColumnType("effective")}
                        className="text-[11px] flex items-center justify-between"
                      >
                        Effective Date
                        {dateColumnType === "effective" && <Check size={12} />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDateColumnType("submit")}
                        className="text-[11px] flex items-center justify-between"
                      >
                        Submit Date
                        {dateColumnType === "submit" && <Check size={12} />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => toggleSort(getDateSortField())}
                        className="text-[11px] flex items-center justify-between"
                      >
                        Sort{" "}
                        {sortConfig.field === getDateSortField() &&
                        sortConfig.direction === "asc"
                          ? "Descending"
                          : "Ascending"}
                        {sortConfig.field === getDateSortField() ? (
                          sortConfig.direction === "asc" ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )
                        ) : (
                          <ChevronUp size={12} className="opacity-50" />
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground px-2 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={canViewCommissions ? 9 : 8}
                    className="text-center py-12"
                  >
                    <LogoSpinner size="xl" className="mr-2" />
                    Your policies are loading...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={canViewCommissions ? 9 : 8}
                    className="text-center py-12"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-muted-foreground dark:text-muted-foreground" />
                      <span className="text-[11px] text-destructive">
                        Error:{" "}
                        {error instanceof Error ? error.message : String(error)}
                      </span>
                      <Button
                        onClick={refresh}
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2"
                      >
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : policies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canViewCommissions ? 9 : 8}
                    className="text-center py-12"
                  >
                    <div className="flex flex-col items-center justify-center p-4">
                      <FileText className="h-8 w-8 text-muted-foreground dark:text-muted-foreground mb-2" />
                      <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                        {filterCount > 0
                          ? "No policies match your filters"
                          : "No policies found"}
                      </p>
                      <p className="text-[10px] text-muted-foreground dark:text-muted-foreground mt-1">
                        Add a policy to get started
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => {
                  const carrier = getCarrierById(policy.carrierId);
                  const policyCommission = commissionsByPolicy[policy.id];
                  // Use actual commission amount from database (includes contract level multiplier)
                  // Fallback to 0 if no commission record exists
                  const commission = policyCommission?.amount || 0;

                  return (
                    <TableRow
                      key={policy.id}
                      className="h-9 border-b border-border dark:border-border/50 hover:bg-background dark:hover:bg-card-tinted/50 transition-colors"
                    >
                      <TableCell className="text-[11px] text-foreground dark:text-foreground py-1.5 px-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          {policy.policyNumber}
                          {!policy.leadPurchaseId && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link2Off className="h-3 w-3 text-warning" />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  className="text-xs"
                                >
                                  Not linked to lead purchase
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2">
                        <div className="flex flex-col gap-0">
                          <span className="font-medium text-foreground dark:text-foreground">
                            {policy.client.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                            {policy.client.age}y • {policy.client.state}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2">
                        <div className="flex flex-col gap-0">
                          <span className="font-medium text-foreground dark:text-foreground">
                            {carrier?.name || "Unknown"}
                          </span>
                          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                            {PRODUCT_ABBREV[policy.product] || policy.product}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 px-2">
                        <div className="flex flex-col gap-0.5">
                          {/* Application Status Dropdown */}
                          <Select
                            value={policy.status}
                            onValueChange={(value) => {
                              updatePolicy({
                                id: policy.id,
                                updates: {
                                  status: value as PolicyStatus,
                                  // Set default lifecycle status when approving
                                  ...(value === "approved" &&
                                  !policy.lifecycleStatus
                                    ? {
                                        lifecycleStatus:
                                          "active" as PolicyLifecycleStatus,
                                      }
                                    : {}),
                                  // Clear lifecycle status when changing to non-approved
                                  ...(value !== "approved"
                                    ? {
                                        lifecycleStatus:
                                          null as unknown as PolicyLifecycleStatus,
                                      }
                                    : {}),
                                },
                              });
                            }}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-6 text-[10px] w-[85px] px-1.5 gap-1 font-medium border",
                                policy.status === "pending" &&
                                  "bg-warning/10 text-warning border-warning/30",
                                policy.status === "approved" &&
                                  "bg-success/10 text-success border-success/30",
                                policy.status === "denied" &&
                                  "bg-destructive/10 text-destructive border-destructive/30",
                                policy.status === "withdrawn" &&
                                  "bg-muted text-muted-foreground dark:text-muted-foreground border-border dark:border-border",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="denied">Denied</SelectItem>
                              <SelectItem value="withdrawn">
                                Withdrawn
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {/* Lifecycle Status Dropdown - only show when approved */}
                          {policy.status === "approved" && (
                            <Select
                              value={policy.lifecycleStatus || "active"}
                              onValueChange={(value) => {
                                const newStatus =
                                  value as PolicyLifecycleStatus;
                                const currentStatus =
                                  policy.lifecycleStatus || "active";

                                // Handle special cases for cancel/lapse/reinstate
                                if (
                                  newStatus === "cancelled" &&
                                  currentStatus === "active"
                                ) {
                                  handleCancelPolicy(policy.id);
                                } else if (
                                  newStatus === "lapsed" &&
                                  currentStatus === "active"
                                ) {
                                  handleLapsePolicy(policy.id);
                                } else if (
                                  newStatus === "active" &&
                                  (currentStatus === "cancelled" ||
                                    currentStatus === "lapsed")
                                ) {
                                  handleReinstatePolicy(
                                    policy.id,
                                    currentStatus,
                                  );
                                } else {
                                  // Direct update for other changes (e.g., expired)
                                  updatePolicy({
                                    id: policy.id,
                                    updates: { lifecycleStatus: newStatus },
                                  });
                                }
                              }}
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-6 text-[10px] w-[85px] px-1.5 gap-1 font-medium border",
                                  (policy.lifecycleStatus === "active" ||
                                    !policy.lifecycleStatus) &&
                                    "bg-info/10 text-info border-info/30",
                                  policy.lifecycleStatus === "lapsed" &&
                                    "bg-destructive/10 text-destructive border-destructive/30",
                                  policy.lifecycleStatus === "cancelled" &&
                                    "bg-muted text-muted-foreground dark:text-muted-foreground border-border dark:border-border",
                                  policy.lifecycleStatus === "expired" &&
                                    "bg-muted text-muted-foreground border-border",
                                )}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="lapsed">Lapsed</SelectItem>
                                <SelectItem value="cancelled">
                                  Cancelled
                                </SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] py-1.5 px-2 text-right tabular-nums">
                        <div className="flex flex-col gap-0 items-end">
                          <span className="text-foreground dark:text-foreground">
                            {formatCurrency(policy.annualPremium)}
                          </span>
                          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                            annual
                          </span>
                        </div>
                      </TableCell>
                      {canViewCommissions && (
                        <TableCell className="text-[11px] py-1.5 px-2 text-right tabular-nums">
                          <div className="flex flex-col gap-0 items-end">
                            <span className="text-success font-medium">
                              {formatCurrency(commission)}
                            </span>
                            <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                              {(policy.commissionPercentage * 100).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="py-1.5 px-2">
                        {policyCommission ? (
                          <Select
                            value={policyCommission.status}
                            onValueChange={(value) =>
                              handleStatusChange(
                                policyCommission,
                                value,
                                policy,
                              )
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                "h-6 text-[10px] w-[90px] mx-auto px-1.5 gap-1 font-medium border",
                                policyCommission.status === "paid" &&
                                  "bg-success/10 text-success border-success/30",
                                policyCommission.status === "pending" &&
                                  "bg-warning/10 text-warning border-warning/30",
                                (policyCommission.status as string) ===
                                  "unpaid" &&
                                  "bg-warning/10 text-warning border-warning/30",
                                (policyCommission.status as string) ===
                                  "earned" &&
                                  "bg-info/10 text-info border-info/30",
                                policyCommission.status === "charged_back" &&
                                  "bg-destructive/10 text-destructive border-destructive/30",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="unpaid">Unpaid</SelectItem>
                              {/* Display-only state used by some existing workflows (e.g. reinstatement) */}
                              <SelectItem value="earned" disabled>
                                Earned
                              </SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="charged_back">
                                Charged Back
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground dark:text-muted-foreground text-[10px] block text-center">
                            No commission
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground dark:text-muted-foreground py-1.5 px-2">
                        {dateColumnType === "effective"
                          ? formatDate(policy.effectiveDate)
                          : policy.submitDate
                            ? formatDate(policy.submitDate)
                            : "—"}
                      </TableCell>
                      <TableCell className="py-1.5 px-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-background"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => onEditPolicy(policy.id)}
                              className="text-[11px]"
                            >
                              <Edit className="mr-2 h-3.5 w-3.5" />
                              Edit Policy
                            </DropdownMenuItem>
                            {canViewCommissions && !policy.leadPurchaseId && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setPolicyToLink(policy);
                                  setLinkDialogOpen(true);
                                }}
                                className="text-[11px]"
                              >
                                <Link2 className="mr-2 h-3.5 w-3.5" />
                                Link to Lead Purchase
                              </DropdownMenuItem>
                            )}
                            {/* Cancel/Lapse actions - only for approved+active policies */}
                            {policy.status === "approved" &&
                              policy.lifecycleStatus === "active" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleCancelPolicy(policy.id)
                                    }
                                    className="text-warning text-[11px]"
                                  >
                                    <XCircle className="mr-2 h-3.5 w-3.5" />
                                    Cancel Policy
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleLapsePolicy(policy.id)}
                                    className="text-warning text-[11px]"
                                  >
                                    <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                    Mark as Lapsed
                                  </DropdownMenuItem>
                                </>
                              )}
                            {/* Reinstate action - only for cancelled/lapsed lifecycle */}
                            {policy.status === "approved" &&
                              (policy.lifecycleStatus === "cancelled" ||
                                policy.lifecycleStatus === "lapsed") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleReinstatePolicy(
                                      policy.id,
                                      policy.lifecycleStatus as
                                        | "cancelled"
                                        | "lapsed",
                                    )
                                  }
                                  className="text-success text-[11px]"
                                >
                                  <CheckCircle className="mr-2 h-3.5 w-3.5" />
                                  Reinstate Policy
                                </DropdownMenuItem>
                              )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                handleDeletePolicy(
                                  policy.id,
                                  policy.client.name,
                                )
                              }
                              disabled={isDeleting}
                              className="text-destructive text-[11px]"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete Policy
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="flex-1 overflow-auto md:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LogoSpinner size="xl" className="mr-2" />
              <span className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                Loading...
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-12 gap-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground dark:text-muted-foreground" />
              <span className="text-[11px] text-destructive">
                {error instanceof Error ? error.message : String(error)}
              </span>
              <Button
                onClick={refresh}
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
              >
                Retry
              </Button>
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <FileText className="h-8 w-8 text-muted-foreground dark:text-muted-foreground mb-2" />
              <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                {filterCount > 0
                  ? "No policies match your filters"
                  : "No policies found"}
              </p>
            </div>
          ) : (
            <div className="px-2 py-1.5 space-y-1.5">
              {policies.map((policy) => {
                const carrier = getCarrierById(policy.carrierId);
                const policyCommission = commissionsByPolicy[policy.id];
                const commission = policyCommission?.amount || 0;
                return (
                  <div
                    key={policy.id}
                    className="rounded-lg border border-border dark:border-border bg-card p-2.5"
                  >
                    {/* Top: Client name + Actions menu */}
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[12px] text-foreground dark:text-foreground truncate">
                          {policy.client.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground dark:text-muted-foreground mt-0.5">
                          {policy.policyNumber} &middot; {policy.client.age}y
                          &middot; {policy.client.state}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2 flex-shrink-0"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => onEditPolicy(policy.id)}
                            className="text-[11px]"
                          >
                            <Edit className="mr-2 h-3.5 w-3.5" />
                            Edit Policy
                          </DropdownMenuItem>
                          {canViewCommissions && !policy.leadPurchaseId && (
                            <DropdownMenuItem
                              onClick={() => {
                                setPolicyToLink(policy);
                                setLinkDialogOpen(true);
                              }}
                              className="text-[11px]"
                            >
                              <Link2 className="mr-2 h-3.5 w-3.5" />
                              Link to Lead Purchase
                            </DropdownMenuItem>
                          )}
                          {policy.status === "approved" &&
                            policy.lifecycleStatus === "active" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleCancelPolicy(policy.id)}
                                  className="text-warning text-[11px]"
                                >
                                  <XCircle className="mr-2 h-3.5 w-3.5" />
                                  Cancel Policy
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleLapsePolicy(policy.id)}
                                  className="text-warning text-[11px]"
                                >
                                  <AlertCircle className="mr-2 h-3.5 w-3.5" />
                                  Mark as Lapsed
                                </DropdownMenuItem>
                              </>
                            )}
                          {policy.status === "approved" &&
                            (policy.lifecycleStatus === "cancelled" ||
                              policy.lifecycleStatus === "lapsed") && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleReinstatePolicy(
                                    policy.id,
                                    policy.lifecycleStatus as
                                      | "cancelled"
                                      | "lapsed",
                                  )
                                }
                                className="text-success text-[11px]"
                              >
                                <CheckCircle className="mr-2 h-3.5 w-3.5" />
                                Reinstate Policy
                              </DropdownMenuItem>
                            )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleDeletePolicy(policy.id, policy.client.name)
                            }
                            disabled={isDeleting}
                            className="text-destructive text-[11px]"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete Policy
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Carrier + Product */}
                    <div className="text-[10px] text-muted-foreground dark:text-muted-foreground mt-1">
                      {carrier?.name || "Unknown"} &middot;{" "}
                      {PRODUCT_ABBREV[policy.product] || policy.product}{" "}
                      &middot;{" "}
                      {dateColumnType === "effective"
                        ? formatDate(policy.effectiveDate)
                        : policy.submitDate
                          ? formatDate(policy.submitDate)
                          : "—"}
                    </div>

                    {/* Bottom: Status badges + Premium */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border dark:border-border">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
                            policy.status === "pending" &&
                              "bg-warning/10 text-warning",
                            policy.status === "approved" &&
                              "bg-success/10 text-success",
                            policy.status === "denied" &&
                              "bg-destructive/10 text-destructive",
                            policy.status === "withdrawn" &&
                              "bg-muted text-muted-foreground dark:text-muted-foreground",
                          )}
                        >
                          {policy.status}
                        </span>
                        {policy.status === "approved" && (
                          <span
                            className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
                              (!policy.lifecycleStatus ||
                                policy.lifecycleStatus === "active") &&
                                "bg-info/10 text-info",
                              policy.lifecycleStatus === "lapsed" &&
                                "bg-destructive/10 text-destructive",
                              policy.lifecycleStatus === "cancelled" &&
                                "bg-muted text-muted-foreground dark:text-muted-foreground",
                              policy.lifecycleStatus === "expired" &&
                                "bg-muted text-muted-foreground",
                            )}
                          >
                            {policy.lifecycleStatus || "active"}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] font-medium text-foreground dark:text-foreground tabular-nums">
                          {formatCurrency(policy.annualPremium)}
                        </div>
                        {canViewCommissions && (
                          <div className="text-[10px] text-success tabular-nums">
                            {formatCurrency(commission)} comm
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Server-side Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-border dark:border-border flex-shrink-0">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-muted-foreground dark:text-muted-foreground">
              <span className="font-medium text-foreground dark:text-foreground">
                {(currentPage - 1) * pageSize + 1}
              </span>
              -
              <span className="font-medium text-foreground dark:text-foreground">
                {Math.min(currentPage * pageSize, totalItems)}
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
              <SelectTrigger className="h-6 w-[80px] text-[10px] bg-card border-border dark:border-border">
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
                      className="h-6 min-w-6 px-1.5 text-[10px] text-muted-foreground dark:text-muted-foreground"
                    >
                      1
                    </Button>,
                  );
                  if (start > 2) {
                    pages.push(
                      <span
                        key="dots1"
                        className="px-0.5 text-muted-foreground dark:text-muted-foreground text-[10px]"
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
                        "h-6 min-w-6 px-1.5 text-[10px]",
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
                        className="px-0.5 text-muted-foreground dark:text-muted-foreground text-[10px]"
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
                      className="h-6 min-w-6 px-1.5 text-[10px] text-muted-foreground dark:text-muted-foreground"
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
      </SoftCard>

      {/* Lead Purchase Link Dialog */}
      <LeadPurchaseLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        policy={policyToLink}
        onLinked={() => {
          setPolicyToLink(null);
          refresh();
        }}
      />
    </div>
  );
};
