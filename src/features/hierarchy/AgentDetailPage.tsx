// src/features/hierarchy/AgentDetailPage.tsx

import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Mail,
  User,
  Phone,
  MapPin,
  FileCheck,
  DollarSign,
  TrendingUp,
  Users,
  Edit,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import {
  useAgentCommissions,
  useAgentDetails,
  useAgentOverrides,
  useAgentPolicies,
  useTeamComparison,
  invalidateHierarchyForNode,
} from "@/hooks/hierarchy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
// eslint-disable-next-line no-restricted-imports
import { policyService } from "@/services/policies";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EditAgentModal } from "./components/EditAgentModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TimePeriodSwitcher,
  PeriodNavigator,
  DateRangeDisplay,
} from "@/features/dashboard";
import {
  getDateRange,
  isInDateRange,
  type TimePeriod,
} from "@/utils/dateRange";

/** Type for policy objects returned from hierarchyService.getAgentPolicies */
interface AgentPolicy {
  id: string;
  policyNumber: string;
  clientName: string;
  product: string;
  carrier: string;
  annualPremium: number;
  status: string;
  lifecycleStatus: string | null;
  createdAt: string;
  submitDate: string;
  effectiveDate: string;
  issueDate: string;
}

/** Type for commission objects returned from hierarchyService.getAgentCommissions */
interface AgentCommission {
  id: string;
  date: string;
  type: string;
  policyNumber: string;
  amount: number;
  earnedAmount?: number;
  unearnedAmount?: number;
  monthsPaid?: number;
  advanceMonths?: number;
  chargebackAmount?: number;
  status: string;
}

interface CommissionMetricsSummary {
  advances: number;
  earned: number;
  unearned: number;
  pending: number;
  paid: number;
  chargebacks: number;
}

const POLICIES_PER_PAGE = 15;
const COMMISSIONS_PER_PAGE = 15;

export function AgentDetailPage() {
  const { agentId } = useParams({ from: "/hierarchy/agent/$agentId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "policies" | "commissions" | "overrides" | "team"
  >("policies");
  const [policyPage, setPolicyPage] = useState(0);
  const [commissionPage, setCommissionPage] = useState(0);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("MTD");
  const [periodOffset, setPeriodOffset] = useState(0);

  // Fetch comprehensive agent data
  const { data: agentData, isLoading: loadingAgent } = useAgentDetails(
    agentId,
    {
      enabled: !!agentId,
    },
  );

  // A POLICY OBJECT
  //   {
  //     "id": "2e403634-78f7-4799-a53d-c6c32aa66031",
  //     "policyNumber": "A1313395",
  //     "clientName": "JOSEPH MORAN",
  //     "product": "term_life",
  //     "carrier": "Baltimore Life",
  //     "annualPremium": 1534.8,
  //     "status": "pending",
  //     "createdAt": "2026-01-03T16:47:08.79648+00:00",
  //     "effectiveDate": "2026-01-28",
  //     "issueDate": "2026-01-28" is this suppose to be submitDate? are they the same?
  // }

  const { data: policies, isLoading: loadingPolicies } = useAgentPolicies(
    agentId,
    {
      enabled: !!agentId,
    },
  );

  const { data: commissions, isLoading: loadingCommissions } =
    useAgentCommissions(agentId, {
      enabled: !!agentId,
    });

  // Get current user for viewer override calculations
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: overrides } = useAgentOverrides(agentId, {
    enabled: !!agentId,
    viewerId: currentUser?.id,
  });

  const { data: teamComparison } = useTeamComparison(agentId, {
    enabled: !!agentId,
  });

  const dateRange = useMemo(
    () => getDateRange(timePeriod, periodOffset),
    [timePeriod, periodOffset],
  );

  const invalidateAgentHierarchyQueries = useCallback(() => {
    if (!agentId) return;
    invalidateHierarchyForNode(queryClient, agentId);
    queryClient.invalidateQueries({ queryKey: ["policies"] });
    queryClient.invalidateQueries({ queryKey: ["commissions"] });
  }, [agentId, queryClient]);

  const handleTimePeriodChange = useCallback((newPeriod: TimePeriod) => {
    setTimePeriod(newPeriod);
    setPeriodOffset(0);
  }, []);

  // Policy status update mutation for upline editing
  const updatePolicyStatus = useMutation({
    mutationFn: async ({
      policyId,
      updates,
    }: {
      policyId: string;
      updates: Record<string, unknown>;
    }) => {
      return policyService.update(policyId, updates);
    },
    onSuccess: () => {
      invalidateAgentHierarchyQueries();
      toast.success("Policy updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update policy: ${error.message}`);
    },
  });

  const deletePolicyMutation = useMutation({
    mutationFn: async (policyId: string) => {
      await policyService.delete(policyId);
    },
    onSuccess: () => {
      invalidateAgentHierarchyQueries();
      toast.success("Policy deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete policy: ${error.message}`);
    },
  });

  const handleStatusChange = useCallback(
    (policyId: string, status: string) => {
      updatePolicyStatus.mutate({ policyId, updates: { status } });
    },
    [updatePolicyStatus],
  );

  const handleLifecycleChange = useCallback(
    (policyId: string, lifecycleStatus: string | null) => {
      updatePolicyStatus.mutate({
        policyId,
        updates: { lifecycleStatus },
      });
    },
    [updatePolicyStatus],
  );

  const handleDeletePolicy = useCallback(
    (policyId: string, policyNumber: string) => {
      if (
        window.confirm(
          `Delete policy ${policyNumber || "record"}? This action cannot be undone.`,
        )
      ) {
        deletePolicyMutation.mutate(policyId);
      }
    },
    [deletePolicyMutation],
  );

  // Calculate additional metrics
  const policyList = useMemo<AgentPolicy[]>(
    () => policies?.policies ?? [],
    [policies?.policies],
  );
  const commissionList = useMemo<AgentCommission[]>(
    () => commissions?.recent ?? [],
    [commissions?.recent],
  );
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const mtdPolicies = policyList.filter((p: AgentPolicy) => {
    const pDate = new Date(p.submitDate || p.createdAt);
    return (
      pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear
    );
  });

  const ytdPolicies = policyList.filter((p: AgentPolicy) => {
    const pDate = new Date(p.submitDate || p.createdAt);
    return pDate.getFullYear() === currentYear;
  });

  const mtdMetrics = {
    policies: mtdPolicies.length,
    premium: mtdPolicies.reduce(
      (sum: number, p: AgentPolicy) => sum + (p.annualPremium || 0),
      0,
    ),
  };

  const ytdMetrics = {
    policies: ytdPolicies.length,
    premium: ytdPolicies.reduce(
      (sum: number, p: AgentPolicy) => sum + (p.annualPremium || 0),
      0,
    ),
  };

  const filteredPolicies = useMemo(
    () =>
      policyList.filter((policy: AgentPolicy) =>
        isInDateRange(policy.submitDate || policy.createdAt, dateRange),
      ),
    [policyList, dateRange],
  );

  const filteredCommissions = useMemo(
    () =>
      commissionList.filter((commission: AgentCommission) =>
        isInDateRange(commission.date, dateRange),
      ),
    [commissionList, dateRange],
  );

  const totalPolicyPages = Math.max(
    1,
    Math.ceil(filteredPolicies.length / POLICIES_PER_PAGE),
  );
  const totalCommissionPages = Math.max(
    1,
    Math.ceil(filteredCommissions.length / COMMISSIONS_PER_PAGE),
  );

  useEffect(() => {
    setPolicyPage((current) => Math.min(current, totalPolicyPages - 1));
  }, [totalPolicyPages]);

  useEffect(() => {
    setCommissionPage((current) => Math.min(current, totalCommissionPages - 1));
  }, [totalCommissionPages]);

  useEffect(() => {
    setPolicyPage(0);
    setCommissionPage(0);
  }, [timePeriod, periodOffset]);

  useEffect(() => {
    if (activeTab === "policies") {
      setPolicyPage(0);
    }
    if (activeTab === "commissions") {
      setCommissionPage(0);
    }
  }, [activeTab]);

  const paginatedPolicies = filteredPolicies.slice(
    policyPage * POLICIES_PER_PAGE,
    (policyPage + 1) * POLICIES_PER_PAGE,
  );

  const paginatedCommissions = filteredCommissions.slice(
    commissionPage * COMMISSIONS_PER_PAGE,
    (commissionPage + 1) * COMMISSIONS_PER_PAGE,
  );

  const commissionMetrics = useMemo(
    () =>
      filteredCommissions.reduce(
        (acc: CommissionMetricsSummary, commission: AgentCommission) => {
          const amount = commission.amount || 0;
          const earnedAmount = commission.earnedAmount || 0;
          const unearnedAmount = commission.unearnedAmount || 0;
          const chargebackAmount = commission.chargebackAmount || 0;
          const advanceMonths = commission.advanceMonths || 0;

          if (advanceMonths > 0) {
            acc.advances += amount;
          }
          if (commission.status === "pending") {
            acc.pending += amount;
          }
          if (commission.status === "paid") {
            acc.paid += amount;
          }
          acc.earned += earnedAmount;
          acc.unearned += unearnedAmount;
          acc.chargebacks += chargebackAmount;
          return acc;
        },
        {
          advances: 0,
          earned: 0,
          unearned: 0,
          pending: 0,
          paid: 0,
          chargebacks: 0,
        },
      ),
    [filteredCommissions],
  );

  const agentOverrideEarnings = {
    mtd: overrides?.agentEarnings?.mtd || overrides?.mtd || 0,
    ytd: overrides?.agentEarnings?.ytd || overrides?.ytd || 0,
  };

  const viewerEarningsFromAgent = {
    mtd: overrides?.viewerEarningsFromAgent?.mtd || 0,
    ytd: overrides?.viewerEarningsFromAgent?.ytd || 0,
  };

  if (loadingAgent) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[11px] text-muted-foreground">
          Loading agent details...
        </div>
      </div>
    );
  }

  if (!agentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <AlertCircle className="h-6 w-6 text-muted-foreground" />
        <div className="text-[11px] text-muted-foreground">Agent not found</div>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={() => navigate({ to: "/hierarchy" })}
        >
          Back to Team
        </Button>
      </div>
    );
  }

  const agentName =
    agentData.first_name && agentData.last_name
      ? `${agentData.first_name} ${agentData.last_name}`
      : agentData.email;

  return (
    <div className="min-h-screen flex flex-col p-3 space-y-2.5">
      {/* Compact Header with inline stats */}
      <div className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/hierarchy" })}
            className="h-6 px-2 text-[10px] text-muted-foreground dark:text-muted-foreground"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back
          </Button>
          <div className="h-3 w-px bg-muted" />

          {/* Agent info inline */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">
                {agentName}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Mail className="h-2.5 w-2.5" />
                  {agentData.email}
                </span>
                {agentData.phone && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="flex items-center gap-0.5">
                      <Phone className="h-2.5 w-2.5" />
                      {agentData.phone}
                    </span>
                  </>
                )}
                {agentData.state && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {agentData.state}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="h-3 w-px bg-muted" />

          {/* Inline compact stats */}
          <div className="flex items-center gap-3 text-[11px]">
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5 border-border "
            >
              Level {agentData.contract_level || 80}%
            </Badge>
            {agentData.approval_status === "approved" ? (
              <Badge className="bg-success/20 text-success dark:bg-success/50 dark:text-success text-[10px] h-5 px-1.5">
                Active
              </Badge>
            ) : (
              <Badge className="bg-warning/20 text-warning dark:bg-warning/50 dark:text-warning text-[10px] h-5 px-1.5">
                {agentData.approval_status}
              </Badge>
            )}
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <FileCheck className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-foreground">
                {mtdMetrics.policies}
              </span>
              <span className="text-muted-foreground">MTD</span>
            </div>
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-success" />
              <span className="font-medium text-foreground">
                {formatCurrency(mtdMetrics.premium)}
              </span>
            </div>
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-info" />
              <span className="font-medium text-foreground">
                {ytdMetrics.policies}
              </span>
              <span className="text-muted-foreground">YTD</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-muted-foreground dark:text-muted-foreground"
            onClick={() =>
              toast.success(
                `Message feature coming soon for ${agentData.email}`,
              )
            }
          >
            <Mail className="h-3 w-3 mr-1" />
            Message
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-muted-foreground dark:text-muted-foreground"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>
      </div>

      {/* Compact tabs */}
      <div className="flex items-center gap-0.5 bg-background rounded-md p-0.5 w-fit">
        <button
          onClick={() => setActiveTab("policies")}
          className={cn(
            "flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
            activeTab === "policies"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground",
          )}
        >
          <FileCheck className="h-3.5 w-3.5" />
          Policies
        </button>
        <button
          onClick={() => setActiveTab("commissions")}
          className={cn(
            "flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
            activeTab === "commissions"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground",
          )}
        >
          <DollarSign className="h-3.5 w-3.5" />
          Commissions
        </button>
        <button
          onClick={() => setActiveTab("overrides")}
          className={cn(
            "flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
            activeTab === "overrides"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground",
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Overrides
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={cn(
            "flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
            activeTab === "team"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground",
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Team
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {(activeTab === "policies" || activeTab === "commissions") && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 border border-border mb-2">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide shrink-0">
              Date Filter
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
              <TimePeriodSwitcher
                timePeriod={timePeriod}
                onTimePeriodChange={handleTimePeriodChange}
              />
              <PeriodNavigator
                timePeriod={timePeriod}
                periodOffset={periodOffset}
                onOffsetChange={setPeriodOffset}
                dateRange={dateRange}
              />
              <DateRangeDisplay timePeriod={timePeriod} dateRange={dateRange} />
            </div>
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === "policies" &&
          (() => {
            return (
              <div className="space-y-2">
                <div className="rounded-lg bg-card border border-border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="border-b border-border hover:bg-transparent">
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                          Policy #
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                          Client
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                          Product
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                          Carrier
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                          Submit Date
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                          Effective
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground text-right">
                          Premium
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                          Status
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPolicies ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center text-[11px] text-muted-foreground py-8"
                          >
                            Loading policies...
                          </TableCell>
                        </TableRow>
                      ) : filteredPolicies.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center text-[11px] text-muted-foreground py-8"
                          >
                            {policyList.length === 0
                              ? "No policies found"
                              : "No policies in selected date range"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedPolicies.map((policy: AgentPolicy) => (
                          <TableRow
                            key={policy.id}
                            className="hover:bg-background border-b border-border/60"
                          >
                            <TableCell className="py-1.5 text-[11px] font-mono text-foreground">
                              {policy.policyNumber}
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] text-foreground">
                              {policy.clientName}
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] text-foreground">
                              {policy.product}
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] text-foreground">
                              {policy.carrier}
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] text-foreground">
                              {formatDate(policy.submitDate)}
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] text-foreground">
                              {formatDate(policy.effectiveDate)}
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] font-semibold text-foreground text-right">
                              {formatCurrency(policy.annualPremium)}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] h-4 px-1",
                                  policy.lifecycleStatus === "active" &&
                                    "text-success border-success/40",
                                  policy.lifecycleStatus === "lapsed" &&
                                    "text-warning border-warning dark:border-warning",
                                  policy.lifecycleStatus === "cancelled" &&
                                    "text-destructive border-destructive/40",
                                  policy.status === "pending" &&
                                    "text-warning border-warning dark:border-warning",
                                  policy.status === "approved" &&
                                    !policy.lifecycleStatus &&
                                    "text-info border-info/40",
                                  policy.status === "denied" &&
                                    "text-destructive border-destructive/40",
                                )}
                              >
                                {policy.lifecycleStatus || policy.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1.5 w-8">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-44"
                                >
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-[11px]">
                                      Application Status
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {["pending", "approved", "denied"].map(
                                        (s) => (
                                          <DropdownMenuItem
                                            key={s}
                                            className={cn(
                                              "text-[11px] capitalize",
                                              policy.status === s &&
                                                "font-semibold",
                                            )}
                                            disabled={policy.status === s}
                                            onClick={() =>
                                              handleStatusChange(policy.id, s)
                                            }
                                          >
                                            {s}
                                          </DropdownMenuItem>
                                        ),
                                      )}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-[11px]">
                                      Lifecycle Status
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {[
                                        { value: "active", label: "Active" },
                                        { value: "lapsed", label: "Lapsed" },
                                        {
                                          value: "cancelled",
                                          label: "Cancelled",
                                        },
                                      ].map((s) => (
                                        <DropdownMenuItem
                                          key={s.value}
                                          className={cn(
                                            "text-[11px]",
                                            policy.lifecycleStatus ===
                                              s.value && "font-semibold",
                                          )}
                                          disabled={
                                            policy.lifecycleStatus === s.value
                                          }
                                          onClick={() =>
                                            handleLifecycleChange(
                                              policy.id,
                                              s.value,
                                            )
                                          }
                                        >
                                          {s.label}
                                        </DropdownMenuItem>
                                      ))}
                                      {policy.lifecycleStatus && (
                                        <DropdownMenuItem
                                          className="text-[11px] text-muted-foreground"
                                          onClick={() =>
                                            handleLifecycleChange(
                                              policy.id,
                                              null,
                                            )
                                          }
                                        >
                                          Clear
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuItem
                                    className="text-[11px] text-destructive"
                                    disabled={deletePolicyMutation.isPending}
                                    onClick={() =>
                                      handleDeletePolicy(
                                        policy.id,
                                        policy.policyNumber,
                                      )
                                    }
                                  >
                                    <Trash2 className="h-3 w-3 mr-1.5" />
                                    Delete Policy
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                {totalPolicyPages > 1 && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-muted-foreground">
                      {filteredPolicies.length} policies
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={policyPage === 0}
                        onClick={() => setPolicyPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground dark:text-muted-foreground min-w-[4rem] text-center">
                        {policyPage + 1} / {totalPolicyPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={policyPage >= totalPolicyPages - 1}
                        onClick={() => setPolicyPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        {/* Commissions Tab */}
        {activeTab === "commissions" && (
          <div className="space-y-2">
            {/* Inline commission stats header */}
            <div className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
              <div className="flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Advances:</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(commissionMetrics.advances)}
                  </span>
                </div>
                <div className="h-3 w-px bg-muted" />
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Earned:</span>
                  <span className="font-semibold text-success">
                    {formatCurrency(commissionMetrics.earned)}
                  </span>
                </div>
                <div className="h-3 w-px bg-muted" />
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Unearned:</span>
                  <span className="font-semibold text-warning">
                    {formatCurrency(commissionMetrics.unearned)}
                  </span>
                </div>
                <div className="h-3 w-px bg-muted" />
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Chargebacks:</span>
                  <span className="font-semibold text-destructive">
                    {formatCurrency(commissionMetrics.chargebacks)}
                  </span>
                </div>
              </div>
            </div>

            {/* Commission table */}
            <div className="rounded-lg bg-card border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                      Type
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                      Policy
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground text-right">
                      Advance
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground text-right">
                      Earned
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground text-right">
                      Unearned
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground text-center">
                      Progress
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCommissions ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-[11px] text-muted-foreground py-8"
                      >
                        Loading commissions...
                      </TableCell>
                    </TableRow>
                  ) : filteredCommissions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-[11px] text-muted-foreground py-8"
                      >
                        {commissionList.length === 0
                          ? "No commissions found"
                          : "No commissions in selected date range"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCommissions.map((commission: AgentCommission) => (
                      <TableRow
                        key={commission.id}
                        className="hover:bg-background border-b border-border/60"
                      >
                        <TableCell className="py-1.5 text-[11px] text-foreground">
                          {formatDate(commission.date)}
                        </TableCell>
                        <TableCell className="py-1.5 text-[11px] text-foreground capitalize">
                          {commission.type}
                        </TableCell>
                        <TableCell className="py-1.5 text-[11px] font-mono text-foreground">
                          {commission.policyNumber}
                        </TableCell>
                        <TableCell className="py-1.5 text-[11px] font-semibold text-foreground text-right">
                          {formatCurrency(commission.amount)}
                        </TableCell>
                        <TableCell className="py-1.5 text-[11px] font-semibold text-success text-right">
                          {formatCurrency(commission.earnedAmount || 0)}
                        </TableCell>
                        <TableCell className="py-1.5 text-[11px] text-warning text-right">
                          {formatCurrency(commission.unearnedAmount || 0)}
                        </TableCell>
                        <TableCell className="py-1.5 text-[11px] text-muted-foreground text-center">
                          {commission.monthsPaid || 0}/
                          {commission.advanceMonths || 9} mo
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] h-4 px-1",
                              commission.status === "paid" &&
                                "text-success border-success/40",
                              commission.status === "pending" &&
                                "text-warning border-warning dark:border-warning",
                            )}
                          >
                            {commission.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {totalCommissionPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-muted-foreground">
                  {filteredCommissions.length} commissions
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={commissionPage === 0}
                    onClick={() => setCommissionPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground dark:text-muted-foreground min-w-[4rem] text-center">
                    {commissionPage + 1} / {totalCommissionPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={commissionPage >= totalCommissionPages - 1}
                    onClick={() => setCommissionPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Overrides Tab */}
        {activeTab === "overrides" && (
          <div className="space-y-2">
            {/* Inline override stats header */}
            <div className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
              <div className="flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">
                    Their MTD Earnings:
                  </span>
                  <span className="font-semibold text-success">
                    {formatCurrency(agentOverrideEarnings.mtd)}
                  </span>
                </div>
                <div className="h-3 w-px bg-muted" />
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">
                    Their YTD Earnings:
                  </span>
                  <span className="font-semibold text-success">
                    {formatCurrency(agentOverrideEarnings.ytd)}
                  </span>
                </div>
                {/* Show viewer's overrides from this agent if not viewing own profile */}
                {currentUser?.id !== agentId && (
                  <>
                    <div className="h-3 w-px bg-muted" />
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">
                        Your MTD from them:
                      </span>
                      <span className="font-semibold text-info">
                        {formatCurrency(viewerEarningsFromAgent.mtd)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Two-column layout for override details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Agent's Override Earnings from Downlines */}
              <div className="rounded-lg bg-card border border-border p-4">
                <h4 className="text-[11px] font-semibold text-muted-foreground mb-3">
                  Their Override Earnings
                </h4>
                {agentOverrideEarnings.mtd > 0 ||
                agentOverrideEarnings.ytd > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        MTD Override Income:
                      </span>
                      <span className="font-semibold text-success">
                        {formatCurrency(agentOverrideEarnings.mtd)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        YTD Override Income:
                      </span>
                      <span className="font-semibold text-success">
                        {formatCurrency(agentOverrideEarnings.ytd)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    No override earnings yet
                  </p>
                )}
              </div>

              {/* Your Overrides from This Agent (only if not viewing own profile) */}
              {currentUser?.id !== agentId && (
                <div className="rounded-lg bg-card border border-border p-4">
                  <h4 className="text-[11px] font-semibold text-muted-foreground mb-3">
                    Your Overrides from This Agent
                  </h4>
                  {viewerEarningsFromAgent.mtd > 0 ||
                  viewerEarningsFromAgent.ytd > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          MTD Override Income:
                        </span>
                        <span className="font-semibold text-info">
                          {formatCurrency(viewerEarningsFromAgent.mtd)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          YTD Override Income:
                        </span>
                        <span className="font-semibold text-info">
                          {formatCurrency(viewerEarningsFromAgent.ytd)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground text-center py-2">
                      No overrides from this agent yet
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === "team" && (
          <div className="space-y-2">
            {teamComparison?.directReports?.length > 0 ? (
              <>
                {/* Inline team stats header */}
                <div className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
                  <div className="flex items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold text-foreground">
                        {teamComparison.totalMembers}
                      </span>
                      <span className="text-muted-foreground">
                        direct reports
                      </span>
                    </div>
                    <div className="h-3 w-px bg-muted" />
                    <div className="flex items-center gap-1">
                      <FileCheck className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold text-foreground">
                        {teamComparison.totalPolicies}
                      </span>
                      <span className="text-muted-foreground">
                        team policies
                      </span>
                    </div>
                    <div className="h-3 w-px bg-muted" />
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-success" />
                      <span className="font-semibold text-success">
                        {formatCurrency(teamComparison.totalPremium)}
                      </span>
                      <span className="text-muted-foreground">
                        team premium
                      </span>
                    </div>
                  </div>
                </div>

                {/* Team table */}
                <div className="rounded-lg bg-card border border-border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="border-b border-border hover:bg-transparent">
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                          Agent
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground text-right">
                          Level
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground text-right">
                          Policies
                        </TableHead>
                        <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground text-right">
                          Premium
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamComparison.directReports.map(
                        (member: {
                          id: string;
                          name: string;
                          email: string;
                          contractLevel: number;
                          policies: number;
                          premium: number;
                        }) => (
                          <TableRow
                            key={member.id}
                            className="hover:bg-background border-b border-border/60"
                          >
                            <TableCell className="py-1.5 text-[11px] text-foreground">
                              {member.name}
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] text-foreground text-right">
                              {member.contractLevel}%
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] text-foreground text-right">
                              {member.policies}
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] font-semibold text-foreground text-right">
                              {formatCurrency(member.premium)}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-card border border-border p-6 text-center">
                <Users className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground">
                  No direct reports
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Agent Modal */}
      <EditAgentModal
        agent={agentData}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
}
