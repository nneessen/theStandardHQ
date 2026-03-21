// src/features/policies/PolicyList.tsx

import React, { useState, useEffect, useCallback } from "react";
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
    filters,
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
  const totalAdvances = paidCommissions.reduce(
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
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
      {/* Header with Title and Metrics Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        {/* Title and New Policy Button */}
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Policies
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                disabled={exporting}
              >
                <Download className="h-3 w-3 mr-1" />
                {exporting ? "Exporting..." : "Export"}
              </Button>
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
          <Button
            onClick={onNewPolicy}
            size="sm"
            className="h-6 text-[10px] px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Smart Contextual Metrics Bar */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 text-[11px]">
        {metrics ? (
          <>
            {/* Count metrics */}
            <div className="flex items-center gap-1">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {metrics.totalPolicies}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">total</span>
            </div>
            <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {metrics.activePolicies}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">active</span>
            </div>
            <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {metrics.pendingPolicies}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">pending</span>
            </div>
            <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />

            {/* Premium metrics */}
            <div className="flex items-center gap-1">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                ${(metrics.totalPremium / 1000).toFixed(1)}k
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">premium</span>
            </div>
            <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />

            {canViewCommissions && (
              <>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    ${(earnedCommission / 1000).toFixed(1)}k
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    earned
                  </span>
                </div>
                <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex items-center gap-1">
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    ${(pendingCommission / 1000).toFixed(1)}k
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    pending
                  </span>
                </div>
                <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex items-center gap-1">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    ${(totalAdvances / 1000).toFixed(1)}k
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    advanced
                  </span>
                </div>
                <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
              </>
            )}

            {/* YTD metrics */}
            <div className="flex items-center gap-1">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {metrics.ytdPolicies}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">YTD</span>
            </div>

            {filterCount > 0 && (
              <>
                <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
                <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                  {filterCount} filter{filterCount > 1 ? "s" : ""}
                </span>
              </>
            )}
          </>
        ) : (
          <div className="text-zinc-500 dark:text-zinc-400">
            Loading metrics...
          </div>
        )}
      </div>

      {/* Filters and Search Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex-1 relative flex items-center">
          <Search
            size={14}
            className="absolute left-2 text-zinc-400 dark:text-zinc-500"
          />
          <Input
            type="text"
            placeholder="Search policies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-6 pl-7 text-[10px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
          />
        </div>
        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? "default" : "ghost"}
          size="sm"
          className="h-6 text-[10px] px-2"
        >
          <Filter size={12} className="mr-1" />
          Filters
        </Button>
        {filterCount > 0 && (
          <Button
            onClick={clearFilters}
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 text-zinc-500 dark:text-zinc-400"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Collapsible Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
          <Select
            value={filters.status || "all"}
            onValueChange={(value) =>
              setFilters({
                ...filters,
                status: value === "all" ? undefined : (value as PolicyStatus),
              })
            }
          >
            <SelectTrigger className="h-6 w-[100px] text-[10px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
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
            <SelectTrigger className="h-6 w-[100px] text-[10px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
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
            <SelectTrigger className="h-6 w-[110px] text-[10px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
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
            <SelectTrigger className="h-6 w-[130px] text-[10px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
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
              from: filters.effectiveDateFrom
                ? parseLocalDate(filters.effectiveDateFrom)
                : undefined,
              to: filters.effectiveDateTo
                ? parseLocalDate(filters.effectiveDateTo)
                : undefined,
            }}
            onChange={(range) => {
              setFilters({
                ...filters,
                effectiveDateFrom: range.from
                  ? formatDateForDB(range.from)
                  : undefined,
                effectiveDateTo: range.to
                  ? formatDateForDB(range.to)
                  : undefined,
              });
            }}
            placeholder="Date Range"
            className="h-6"
          />
        </div>
      )}

      {/* Table Container - Desktop Only */}
      <div className="hidden md:block flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white dark:bg-zinc-900 z-10">
            <TableRow className="h-8 border-b border-zinc-200 dark:border-zinc-800 hover:bg-transparent">
              <TableHead
                className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
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
                className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
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
              <TableHead className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2">
                Carrier/Product
              </TableHead>
              <TableHead
                className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
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
                className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2 text-right cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
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
                <TableHead className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2 text-right">
                  Commission
                </TableHead>
              )}
              <TableHead className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2 text-center">
                Comm Status
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-1.5 py-0.5 -ml-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                      <span className="group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                        {dateColumnType === "effective"
                          ? "Effective"
                          : "Submit"}
                      </span>
                      <ChevronDown
                        size={12}
                        className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
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
              <TableHead className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-2 text-right">
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
                    <AlertCircle className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    <span className="text-[11px] text-red-600 dark:text-red-400">
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
                    <FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {filterCount > 0
                        ? "No policies match your filters"
                        : "No policies found"}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
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
                    className="h-9 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <TableCell className="text-[11px] text-zinc-900 dark:text-zinc-100 py-1.5 px-2 font-medium">
                      <div className="flex items-center gap-1.5">
                        {policy.policyNumber}
                        {!policy.leadPurchaseId && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link2Off className="h-3 w-3 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs">
                                Not linked to lead purchase
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 px-2">
                      <div className="flex flex-col gap-0">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {policy.client.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {policy.client.age}y • {policy.client.state}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 px-2">
                      <div className="flex flex-col gap-0">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {carrier?.name || "Unknown"}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
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
                                "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                              policy.status === "approved" &&
                                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                              policy.status === "denied" &&
                                "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
                              policy.status === "withdrawn" &&
                                "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="denied">Denied</SelectItem>
                            <SelectItem value="withdrawn">Withdrawn</SelectItem>
                          </SelectContent>
                        </Select>
                        {/* Lifecycle Status Dropdown - only show when approved */}
                        {policy.status === "approved" && (
                          <Select
                            value={policy.lifecycleStatus || "active"}
                            onValueChange={(value) => {
                              const newStatus = value as PolicyLifecycleStatus;
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
                                handleReinstatePolicy(policy.id, currentStatus);
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
                                  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                                policy.lifecycleStatus === "lapsed" &&
                                  "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
                                policy.lifecycleStatus === "cancelled" &&
                                  "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
                                policy.lifecycleStatus === "expired" &&
                                  "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
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
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(policy.annualPremium)}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          annual
                        </span>
                      </div>
                    </TableCell>
                    {canViewCommissions && (
                      <TableCell className="text-[11px] py-1.5 px-2 text-right tabular-nums">
                        <div className="flex flex-col gap-0 items-end">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatCurrency(commission)}
                          </span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
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
                            handleStatusChange(policyCommission, value, policy)
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              "h-6 text-[10px] w-[90px] mx-auto px-1.5 gap-1 font-medium border",
                              policyCommission.status === "paid" &&
                                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                              policyCommission.status === "pending" &&
                                "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                              (policyCommission.status as string) ===
                                "unpaid" &&
                                "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
                              (policyCommission.status as string) ===
                                "earned" &&
                                "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                              policyCommission.status === "charged_back" &&
                                "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
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
                        <span className="text-zinc-400 dark:text-zinc-500 text-[10px] block text-center">
                          No commission
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] text-zinc-500 dark:text-zinc-400 py-1.5 px-2">
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
                            className="h-6 w-6 p-0 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
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
                                  onClick={() => handleCancelPolicy(policy.id)}
                                  className="text-amber-600 dark:text-amber-400 text-[11px]"
                                >
                                  <XCircle className="mr-2 h-3.5 w-3.5" />
                                  Cancel Policy
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleLapsePolicy(policy.id)}
                                  className="text-amber-600 dark:text-amber-400 text-[11px]"
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
                                className="text-emerald-600 dark:text-emerald-400 text-[11px]"
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
                            className="text-red-600 dark:text-red-400 text-[11px]"
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
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Loading...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <AlertCircle className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <span className="text-[11px] text-red-600 dark:text-red-400">
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
            <FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
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
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5"
                >
                  {/* Top: Client name + Actions menu */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[12px] text-zinc-900 dark:text-zinc-100 truncate">
                        {policy.client.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
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
                                className="text-amber-600 dark:text-amber-400 text-[11px]"
                              >
                                <XCircle className="mr-2 h-3.5 w-3.5" />
                                Cancel Policy
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleLapsePolicy(policy.id)}
                                className="text-amber-600 dark:text-amber-400 text-[11px]"
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
                              className="text-emerald-600 dark:text-emerald-400 text-[11px]"
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
                          className="text-red-600 dark:text-red-400 text-[11px]"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete Policy
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Carrier + Product */}
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                    {carrier?.name || "Unknown"} &middot;{" "}
                    {PRODUCT_ABBREV[policy.product] || policy.product} &middot;{" "}
                    {dateColumnType === "effective"
                      ? formatDate(policy.effectiveDate)
                      : policy.submitDate
                        ? formatDate(policy.submitDate)
                        : "—"}
                  </div>

                  {/* Bottom: Status badges + Premium */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
                          policy.status === "pending" &&
                            "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                          policy.status === "approved" &&
                            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          policy.status === "denied" &&
                            "bg-red-500/10 text-red-600 dark:text-red-400",
                          policy.status === "withdrawn" &&
                            "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
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
                              "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                            policy.lifecycleStatus === "lapsed" &&
                              "bg-red-500/10 text-red-600 dark:text-red-400",
                            policy.lifecycleStatus === "cancelled" &&
                              "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
                            policy.lifecycleStatus === "expired" &&
                              "bg-slate-500/10 text-slate-600 dark:text-slate-400",
                          )}
                        >
                          {policy.lifecycleStatus || "active"}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {formatCurrency(policy.annualPremium)}
                      </div>
                      {canViewCommissions && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">
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
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {(currentPage - 1) * pageSize + 1}
            </span>
            -
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {totalItems}
            </span>
          </span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="h-6 w-[80px] text-[10px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
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
            className="h-6 w-6 p-0 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>

          <Button
            onClick={previousPage}
            disabled={currentPage === 1}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <div className="hidden sm:flex items-center gap-0.5">
            {(() => {
              const pages = [];
              const maxVisible = 5;
              let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
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
                    className="h-6 min-w-6 px-1.5 text-[10px] text-zinc-500 dark:text-zinc-400"
                  >
                    1
                  </Button>,
                );
                if (start > 2) {
                  pages.push(
                    <span
                      key="dots1"
                      className="px-0.5 text-zinc-400 dark:text-zinc-500 text-[10px]"
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
                      currentPage !== i && "text-zinc-500 dark:text-zinc-400",
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
                      className="px-0.5 text-zinc-400 dark:text-zinc-500 text-[10px]"
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
                    className="h-6 min-w-6 px-1.5 text-[10px] text-zinc-500 dark:text-zinc-400"
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
            className="h-6 w-6 p-0 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

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
