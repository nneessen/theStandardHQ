// src/features/contracting/components/ContractingDashboard.tsx
// Contracting manager dashboard - shows all recruits with carrier contract requests

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { carrierContractRequestService } from "@/services/recruiting/carrierContractRequestService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileCheck,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ContractingFilters,
  type ContractingFilterState,
} from "./ContractingFilters";
import { InlineEditableCell } from "./InlineEditableCell";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { BulkStatusChangeDialog } from "./BulkStatusChangeDialog";
import { ContractRequestDetailDialog } from "./ContractRequestDetailDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

const PAGE_SIZE = 50;
const CONTRACT_REQUESTS_QUERY_KEY = "contract-requests-filtered";
const RECRUIT_CONTRACTS_QUERY_KEY = "recruit-carrier-contracts";

const STATUS_OPTIONS = [
  { value: "requested", label: "Requested" },
  { value: "in_progress", label: "In Progress" },
  { value: "writing_received", label: "Writing Received" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type ContractingDashboardResponse = Awaited<
  ReturnType<
    typeof carrierContractRequestService.getContractingDashboardRecruits
  >
>;
type AgentRequestGroup = ContractingDashboardResponse["recruits"][number];
type ContractRequestRow = AgentRequestGroup["requests"][number];
type ContractRequestsResponse = Awaited<
  ReturnType<
    typeof carrierContractRequestService.getContractRequestsWithFilters
  >
>;
type ContractRequestsPageData = ContractRequestsResponse;
type ContractRequestUpdate = Parameters<
  typeof carrierContractRequestService.updateContractRequest
>[1];
const EMPTY_REQUESTS: ContractRequestRow[] = [];

function getBadgeVariantForStatus(status: string): BadgeProps["variant"] {
  switch (status) {
    case "requested":
      return "secondary";
    case "in_progress":
      return "info";
    case "writing_received":
      return "success";
    case "completed":
      return "default";
    case "rejected":
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function formatCompactDate(value: string | null | undefined) {
  if (!value) return "-";

  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return "-";
  }
}

function pickLatestDate(
  current: string | null | undefined,
  next: string | null | undefined,
) {
  if (!current) return next || null;
  if (!next) return current;
  return new Date(next).getTime() > new Date(current).getTime()
    ? next
    : current;
}

function isInteractiveTarget(target: HTMLElement) {
  return Boolean(
    target.closest("button") ||
    target.closest('[role="checkbox"]') ||
    target.closest("input") ||
    target.closest("select") ||
    target.closest("textarea"),
  );
}

export function ContractingDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ContractingFilterState>({
    status: [],
    startDate: null,
    endDate: null,
    carrierId: null,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<ContractRequestRow | null>(null);
  const [expandedRecruitIds, setExpandedRecruitIds] = useState<Set<string>>(
    new Set(),
  );

  // Get available carriers for filter dropdown
  const { data: availableCarriers } = useQuery({
    queryKey: ["all-carriers-for-contracting"],
    queryFn: async () => {
      const { supabase } = await import("@/services/base/supabase");
      const { data, error } = await supabase
        .from("carriers")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  // Get contract requests with filters (uses new service method)
  const { data: contractsData, isLoading } = useQuery({
    queryKey: [CONTRACT_REQUESTS_QUERY_KEY, filters, searchQuery, page],
    queryFn: () =>
      carrierContractRequestService.getContractRequestsWithFilters({
        status: filters.status,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        carrierId: filters.carrierId || undefined,
        searchQuery,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });

  const allRequests = contractsData?.requests ?? EMPTY_REQUESTS;
  const totalCount = contractsData?.totalCount || 0;
  const paginatedRequests = allRequests;

  const agentGroups = useMemo<AgentRequestGroup[]>(() => {
    const groups = new Map<string, AgentRequestGroup>();

    for (const request of paginatedRequests) {
      const recruitId = request.recruit?.id || request.recruit_id || request.id;
      const firstName = request.recruit?.first_name?.trim() || "";
      const lastName = request.recruit?.last_name?.trim() || "";
      const recruitName =
        `${firstName} ${lastName}`.trim() || "Unknown Recruit";
      const recruitEmail = request.recruit?.email || "-";

      const existing = groups.get(recruitId);
      if (existing) {
        existing.requests.push(request);
        existing.statusCounts[request.status] =
          (existing.statusCounts[request.status] || 0) + 1;
        existing.requestedLatest = pickLatestDate(
          existing.requestedLatest,
          request.requested_date,
        );
        existing.writingReceivedLatest = pickLatestDate(
          existing.writingReceivedLatest,
          request.writing_received_date,
        );
        continue;
      }

      groups.set(recruitId, {
        recruitId,
        recruitName,
        recruitEmail,
        requests: [request],
        statusCounts: { [request.status]: 1 },
        requestedLatest: request.requested_date,
        writingReceivedLatest: request.writing_received_date,
      });
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        requests: [...group.requests].sort((a, b) => {
          const aTime = a.requested_date
            ? new Date(a.requested_date).getTime()
            : 0;
          const bTime = b.requested_date
            ? new Date(b.requested_date).getTime()
            : 0;

          if (aTime !== bTime) return bTime - aTime;

          return (a.carrier?.name || "").localeCompare(b.carrier?.name || "");
        }),
      }))
      .sort((a, b) => {
        const aLatest = a.requestedLatest
          ? new Date(a.requestedLatest).getTime()
          : 0;
        const bLatest = b.requestedLatest
          ? new Date(b.requestedLatest).getTime()
          : 0;

        if (aLatest !== bLatest) return bLatest - aLatest;

        return a.recruitName.localeCompare(b.recruitName);
      });
  }, [paginatedRequests]);

  const visibleRequestIds = useMemo(
    () =>
      agentGroups.flatMap((group) =>
        group.requests.map((request) => request.id),
      ),
    [agentGroups],
  );
  const visibleRequestIdSet = useMemo(
    () => new Set(visibleRequestIds),
    [visibleRequestIds],
  );
  const visibleAgentCount = agentGroups.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const allVisibleSelected =
    visibleRequestIds.length > 0 &&
    visibleRequestIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleRequestIds.some((id) => selectedIds.has(id));

  // Mutation for inline updates with optimistic updates
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: ContractRequestUpdate;
    }) => carrierContractRequestService.updateContractRequest(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [CONTRACT_REQUESTS_QUERY_KEY],
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<ContractRequestsPageData>([
        CONTRACT_REQUESTS_QUERY_KEY,
        filters,
        searchQuery,
        page,
      ]);

      // Optimistically update
      queryClient.setQueryData<ContractRequestsPageData>(
        [CONTRACT_REQUESTS_QUERY_KEY, filters, searchQuery, page],
        (old) => {
          if (!old?.requests) return old;
          return {
            ...old,
            requests: old.requests.map((r) =>
              r.id === id ? { ...r, ...updates } : r,
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          [CONTRACT_REQUESTS_QUERY_KEY, filters, searchQuery, page],
          context.previousData,
        );
      }
      toast.error("Update failed");
    },
    onSuccess: () => {
      toast.success("Updated");
      queryClient.invalidateQueries({
        queryKey: [CONTRACT_REQUESTS_QUERY_KEY],
      });
      queryClient.invalidateQueries({
        queryKey: [RECRUIT_CONTRACTS_QUERY_KEY],
      });
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: (status: string) =>
      carrierContractRequestService.bulkUpdateStatus(
        Array.from(selectedIds),
        status,
      ),
    onSuccess: () => {
      toast.success(`Updated ${selectedIds.size} contracts`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({
        queryKey: [CONTRACT_REQUESTS_QUERY_KEY],
      });
      queryClient.invalidateQueries({
        queryKey: [RECRUIT_CONTRACTS_QUERY_KEY],
      });
    },
    onError: () => {
      toast.error("Bulk update failed");
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      carrierContractRequestService.bulkDelete(Array.from(selectedIds)),
    onSuccess: () => {
      toast.success(`Deleted ${selectedIds.size} contracts`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({
        queryKey: [CONTRACT_REQUESTS_QUERY_KEY],
      });
      queryClient.invalidateQueries({
        queryKey: [RECRUIT_CONTRACTS_QUERY_KEY],
      });
    },
    onError: () => {
      toast.error("Bulk delete failed");
    },
  });

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (
        visibleRequestIds.length > 0 &&
        visibleRequestIds.every((id) => next.has(id))
      ) {
        visibleRequestIds.forEach((id) => next.delete(id));
      } else {
        visibleRequestIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const toggleAgentSelection = (group: AgentRequestGroup) => {
    const groupIds = group.requests.map((request) => request.id);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allGroupSelected =
        groupIds.length > 0 && groupIds.every((id) => next.has(id));

      if (allGroupSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const getAgentSelectionState = (group: AgentRequestGroup) => {
    const groupIds = group.requests.map((request) => request.id);
    const selectedCount = groupIds.filter((id) => selectedIds.has(id)).length;

    if (selectedCount === 0) return false;
    if (selectedCount === groupIds.length) return true;
    return "indeterminate" as const;
  };

  const toggleRecruitExpanded = (recruitId: string) => {
    setExpandedRecruitIds((prev) => {
      const next = new Set(prev);
      if (next.has(recruitId)) {
        next.delete(recruitId);
      } else {
        next.add(recruitId);
      }
      return next;
    });
  };

  const expandAllVisible = () => {
    setExpandedRecruitIds(new Set(agentGroups.map((group) => group.recruitId)));
  };

  const collapseAllVisible = () => {
    setExpandedRecruitIds(new Set());
  };

  // Row click handler for detail modal
  const handleRowClick = (request: ContractRequestRow) => {
    setSelectedRequest(request);
    setDetailModalOpen(true);
  };

  // Bulk action handlers
  const handleBulkExport = async () => {
    try {
      const csv = await carrierContractRequestService.exportToCSV({
        status: filters.status,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        carrierId: filters.carrierId || undefined,
        searchQuery,
      });

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contracts-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Exported contracts to CSV");
    } catch (_error) {
      toast.error("Export failed");
    }
  };

  const handleBulkDelete = async () => {
    if (
      !confirm(
        `Delete ${selectedIds.size} contract requests? This cannot be undone.`,
      )
    ) {
      return;
    }
    await bulkDeleteMutation.mutateAsync();
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filters]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;

      const next = new Set(
        Array.from(prev).filter((id) => visibleRequestIdSet.has(id)),
      );

      if (next.size === prev.size) return prev;
      return next;
    });
  }, [visibleRequestIdSet]);

  useEffect(() => {
    const visibleRecruitIds = new Set(
      agentGroups.map((group) => group.recruitId),
    );

    setExpandedRecruitIds((prev) => {
      if (prev.size === 0) return prev;

      const next = new Set(
        Array.from(prev).filter((recruitId) =>
          visibleRecruitIds.has(recruitId),
        ),
      );

      if (next.size === prev.size) return prev;
      return next;
    });
  }, [agentGroups]);

  // Calculate stats from current page (for now - could be enhanced with separate query)
  const stats = useMemo(() => {
    if (!allRequests)
      return {
        total: 0,
        requested: 0,
        in_progress: 0,
        writing_received: 0,
        completed: 0,
      };

    return {
      total: totalCount,
      requested: allRequests.filter((r) => r.status === "requested").length,
      in_progress: allRequests.filter((r) => r.status === "in_progress").length,
      writing_received: allRequests.filter(
        (r) => r.status === "writing_received",
      ).length,
      completed: allRequests.filter((r) => r.status === "completed").length,
    };
  }, [allRequests, totalCount]);

  return (
    <div className="flex flex-col gap-2">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-1.5 border border-v2-ring dark:border-v2-ring">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            <h1 className="text-sm font-semibold">Contracting Hub</h1>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="font-medium">{stats.total}</span>
              <span className="text-muted-foreground">total</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{stats.requested}</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-info" />
              <span className="font-medium">{stats.in_progress}</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span className="font-medium">{stats.writing_received}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search recruit or carrier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 w-56 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Filters */}
      <ContractingFilters
        filters={filters}
        onFiltersChange={setFilters}
        carriers={availableCarriers || []}
      />

      {/* Table */}
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft overflow-hidden">
        <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Grouped by recruit</span>
            <span className="h-3 w-px bg-border" />
            <span>{visibleAgentCount} agent rows on this page</span>
            <span className="h-3 w-px bg-border" />
            <span>{paginatedRequests.length} requests on this page</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={expandAllVisible}
              className="h-6 px-2 text-[10px]"
              disabled={agentGroups.length === 0}
            >
              Expand all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={collapseAllVisible}
              className="h-6 px-2 text-[10px]"
              disabled={expandedRecruitIds.size === 0}
            >
              Collapse all
            </Button>
          </div>
        </div>

        <div className="overflow-auto h-[calc(100%-41px)]">
          {isLoading ? (
            <div className="p-3 space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/50">
                <TableRow className="h-8">
                  <TableHead className="h-8 w-[40px]">
                    <Checkbox
                      checked={
                        allVisibleSelected
                          ? true
                          : someVisibleSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={toggleSelectAllVisible}
                    />
                  </TableHead>
                  <TableHead className="h-8 text-[10px] font-semibold w-[280px] min-w-[260px]">
                    Agent
                  </TableHead>
                  <TableHead className="h-8 text-[10px] font-semibold w-[170px]">
                    Queue
                  </TableHead>
                  <TableHead className="h-8 text-[10px] font-semibold w-[220px] min-w-[200px]">
                    Status Mix
                  </TableHead>
                  <TableHead className="h-8 text-[10px] font-semibold w-[95px]">
                    Last Request
                  </TableHead>
                  <TableHead className="h-8 text-[10px] font-semibold w-[110px]">
                    Last Writing
                  </TableHead>
                  <TableHead className="h-8 text-[10px] font-semibold w-[100px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentGroups.map((group) => {
                  const isExpanded = expandedRecruitIds.has(group.recruitId);
                  const visibleStatusBadges = STATUS_OPTIONS.filter(
                    (status) => group.statusCounts[status.value],
                  );
                  const pendingCount =
                    (group.statusCounts.requested || 0) +
                    (group.statusCounts.in_progress || 0);
                  const selectedForAgent = group.requests.filter((request) =>
                    selectedIds.has(request.id),
                  ).length;

                  return (
                    <Fragment key={group.recruitId}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (isInteractiveTarget(target)) return;
                          toggleRecruitExpanded(group.recruitId);
                        }}
                      >
                        <TableCell
                          className="py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={getAgentSelectionState(group)}
                            onCheckedChange={() => toggleAgentSelection(group)}
                          />
                        </TableCell>

                        <TableCell className="py-2">
                          <div className="flex items-start gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRecruitExpanded(group.recruitId);
                              }}
                              aria-label={
                                isExpanded
                                  ? `Collapse ${group.recruitName}`
                                  : `Expand ${group.recruitName}`
                              }
                            >
                              <ChevronRight
                                className={`h-3.5 w-3.5 transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                              />
                            </Button>

                            <div className="min-w-0">
                              <div className="font-medium text-[11px] leading-4 truncate">
                                {group.recruitName}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {group.recruitEmail}
                              </div>
                              {selectedForAgent > 0 && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {selectedForAgent}/{group.requests.length}{" "}
                                  selected
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-2">
                          <div className="flex items-center gap-1">
                            <Badge size="sm" variant="outline">
                              {group.requests.length} req
                            </Badge>
                            {pendingCount > 0 && (
                              <Badge size="sm" variant="warning">
                                {pendingCount} pending
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {visibleStatusBadges.map((status) => (
                              <Badge
                                key={`${group.recruitId}-${status.value}`}
                                size="sm"
                                variant={getBadgeVariantForStatus(status.value)}
                                className="gap-1"
                              >
                                <span>{status.label}</span>
                                <span className="opacity-90">
                                  {group.statusCounts[status.value]}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell className="py-2 text-[10px] text-muted-foreground">
                          {formatCompactDate(group.requestedLatest)}
                        </TableCell>

                        <TableCell className="py-2 text-[10px] text-muted-foreground">
                          {formatCompactDate(group.writingReceivedLatest)}
                        </TableCell>

                        <TableCell
                          className="py-2 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => toggleAgentSelection(group)}
                          >
                            {selectedForAgent === group.requests.length &&
                            group.requests.length > 0
                              ? "Clear"
                              : "Select all"}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow
                          key={`${group.recruitId}-expanded`}
                          className="bg-muted/10"
                        >
                          <TableCell colSpan={7} className="p-0">
                            <div className="px-3 py-2 border-t border-border/60">
                              <div className="text-[10px] text-muted-foreground mb-2">
                                Manage carrier requests for {group.recruitName}
                              </div>

                              <div className="rounded-md border border-border overflow-hidden">
                                <Table>
                                  <TableHeader className="bg-muted/40">
                                    <TableRow className="h-8">
                                      <TableHead className="h-8 w-[36px]">
                                        <Checkbox
                                          checked={getAgentSelectionState(
                                            group,
                                          )}
                                          onCheckedChange={() =>
                                            toggleAgentSelection(group)
                                          }
                                        />
                                      </TableHead>
                                      <TableHead className="h-8 text-[10px] font-semibold">
                                        Carrier
                                      </TableHead>
                                      <TableHead className="h-8 text-[10px] font-semibold w-[110px]">
                                        Status
                                      </TableHead>
                                      <TableHead className="h-8 text-[10px] font-semibold w-[130px]">
                                        Writing #
                                      </TableHead>
                                      <TableHead className="h-8 text-[10px] font-semibold w-[100px]">
                                        Requested
                                      </TableHead>
                                      <TableHead className="h-8 text-[10px] font-semibold w-[100px]">
                                        Received
                                      </TableHead>
                                      <TableHead className="h-8 text-[10px] font-semibold w-[90px] text-right">
                                        Details
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.requests.map((request) => (
                                      <TableRow
                                        key={request.id}
                                        className="h-9 hover:bg-muted/40 cursor-pointer"
                                        onClick={(e) => {
                                          const target =
                                            e.target as HTMLElement;
                                          if (isInteractiveTarget(target))
                                            return;
                                          handleRowClick(request);
                                        }}
                                      >
                                        <TableCell
                                          className="py-1.5"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Checkbox
                                            checked={selectedIds.has(
                                              request.id,
                                            )}
                                            onCheckedChange={() =>
                                              toggleSelection(request.id)
                                            }
                                          />
                                        </TableCell>

                                        <TableCell className="py-1.5 text-[11px]">
                                          <div className="flex items-center gap-2">
                                            <span className="truncate">
                                              {request.carrier?.name ||
                                                "Unknown"}
                                            </span>
                                            <Badge
                                              size="sm"
                                              variant={getBadgeVariantForStatus(
                                                request.status,
                                              )}
                                            >
                                              {STATUS_OPTIONS.find(
                                                (option) =>
                                                  option.value ===
                                                  request.status,
                                              )?.label || request.status}
                                            </Badge>
                                          </div>
                                        </TableCell>

                                        <TableCell
                                          className="py-1.5"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <InlineEditableCell
                                            value={request.status}
                                            mode="select"
                                            options={[...STATUS_OPTIONS]}
                                            onSave={async (newStatus) => {
                                              await updateMutation.mutateAsync({
                                                id: request.id,
                                                updates: { status: newStatus },
                                              });
                                            }}
                                            className="inline-block"
                                          />
                                        </TableCell>

                                        <TableCell
                                          className="py-1.5"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <InlineEditableCell
                                            value={request.writing_number}
                                            mode="text"
                                            placeholder="Enter writing #"
                                            onSave={async (
                                              newWritingNumber,
                                            ) => {
                                              await updateMutation.mutateAsync({
                                                id: request.id,
                                                updates: {
                                                  writing_number:
                                                    newWritingNumber,
                                                  ...(newWritingNumber &&
                                                  request.status === "requested"
                                                    ? {
                                                        status:
                                                          "writing_received",
                                                      }
                                                    : {}),
                                                },
                                              });
                                            }}
                                            className="font-mono"
                                          />
                                        </TableCell>

                                        <TableCell className="py-1.5 text-[10px] text-muted-foreground">
                                          {formatCompactDate(
                                            request.requested_date,
                                          )}
                                        </TableCell>

                                        <TableCell className="py-1.5 text-[10px] text-muted-foreground">
                                          {formatCompactDate(
                                            request.writing_received_date,
                                          )}
                                        </TableCell>

                                        <TableCell
                                          className="py-1.5 text-right"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-[10px]"
                                            onClick={() =>
                                              handleRowClick(request)
                                            }
                                          >
                                            Open
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {paginatedRequests.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-xs text-muted-foreground py-8"
                    >
                      {searchQuery
                        ? "No contracts match your search"
                        : "No carrier contracts yet"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-1.5 border border-v2-ring dark:border-v2-ring">
          <div className="text-[10px] text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} requests
            {" • "}
            {visibleAgentCount} agents on this page
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-6 px-2 text-[10px]"
            >
              <ChevronLeft className="h-3 w-3" />
              Previous
            </Button>
            <span className="text-[10px] px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-6 px-2 text-[10px]"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.size}
        onStatusChange={() => setBulkStatusDialogOpen(true)}
        onExport={handleBulkExport}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Bulk Status Change Dialog */}
      <BulkStatusChangeDialog
        open={bulkStatusDialogOpen}
        onOpenChange={setBulkStatusDialogOpen}
        selectedCount={selectedIds.size}
        onConfirm={async (newStatus) => {
          await bulkUpdateMutation.mutateAsync(newStatus);
        }}
      />

      {/* Contract Request Detail Modal */}
      {selectedRequest && (
        <ContractRequestDetailDialog
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          request={selectedRequest}
        />
      )}
    </div>
  );
}

export default ContractingDashboard;
