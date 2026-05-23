// src/hooks/imo/useImoQueries.ts
// TanStack Query hooks for IMO and Agency data

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { imoService } from "../../services/imo";
import { agencyService } from "../../services/agency";
import type {
  CreateImoData,
  CreateAgencyData,
  ImoUpdate,
  AgencyUpdate,
  CreateAgencyWithCascadeOptions,
  CreateAgencyWithCascadeResult,
} from "../../types/imo.types";
import type { ReportDateRange } from "../../types/team-reports.schemas";

/**
 * Serialize a date range to a stable string for use in query keys.
 * Date objects have reference equality issues - identical dates with different
 * object references would create separate cache entries. This serializes to
 * ISO date strings for stable, value-based comparison.
 */
function serializeDateRange(dateRange?: ReportDateRange): string | undefined {
  if (!dateRange) return undefined;
  return `${dateRange.startDate.toISOString().split("T")[0]}_${dateRange.endDate.toISOString().split("T")[0]}`;
}

// Query keys
export const imoKeys = {
  all: ["imos"] as const,
  lists: () => [...imoKeys.all, "list"] as const,
  list: (filters?: object) => [...imoKeys.lists(), filters] as const,
  // Distinct cache key for "all (active + inactive)" so the management page
  // doesn't fight the sidebar's active-only cache.
  allIncludingInactive: () =>
    [...imoKeys.all, "list", "includingInactive"] as const,
  details: () => [...imoKeys.all, "detail"] as const,
  detail: (id: string) => [...imoKeys.details(), id] as const,
  myImo: () => [...imoKeys.all, "my"] as const,
  metrics: (id: string) => [...imoKeys.detail(id), "metrics"] as const,
  // Dashboard metrics keys (Phase 5) - now with dateRange support
  dashboardMetrics: (dateRange?: ReportDateRange) =>
    [
      ...imoKeys.all,
      "dashboardMetrics",
      serializeDateRange(dateRange),
    ] as const,
  productionByAgency: (dateRange?: ReportDateRange) =>
    [
      ...imoKeys.all,
      "productionByAgency",
      serializeDateRange(dateRange),
    ] as const,
  // Team report keys (Phase 6) - dateRange serialized to prevent cache thrashing
  performanceReport: (dateRange?: ReportDateRange) =>
    [
      ...imoKeys.all,
      "performanceReport",
      serializeDateRange(dateRange),
    ] as const,
  teamComparison: (dateRange?: ReportDateRange) =>
    [...imoKeys.all, "teamComparison", serializeDateRange(dateRange)] as const,
  topPerformers: (limit: number, dateRange?: ReportDateRange) =>
    [
      ...imoKeys.all,
      "topPerformers",
      limit,
      serializeDateRange(dateRange),
    ] as const,
  // Override summary keys (Phase 7) - now with dateRange support
  overrideSummary: (dateRange?: ReportDateRange) =>
    [...imoKeys.all, "overrideSummary", serializeDateRange(dateRange)] as const,
  overridesByAgency: () => [...imoKeys.all, "overridesByAgency"] as const,
  // Recruiting summary keys (Phase 8)
  recruitingSummary: () => [...imoKeys.all, "recruitingSummary"] as const,
  recruitingByAgency: () => [...imoKeys.all, "recruitingByAgency"] as const,
};

export const agencyKeys = {
  all: ["agencies"] as const,
  lists: () => [...agencyKeys.all, "list"] as const,
  listByImo: (imoId: string | undefined) =>
    [...agencyKeys.lists(), { imoId: imoId ?? "none" }] as const,
  details: () => [...agencyKeys.all, "detail"] as const,
  detail: (id: string) => [...agencyKeys.details(), id] as const,
  myAgency: () => [...agencyKeys.all, "my"] as const,
  myImoAgencies: () => [...agencyKeys.all, "myImo"] as const,
  metrics: (id: string) => [...agencyKeys.detail(id), "metrics"] as const,
  // Dashboard metrics keys (Phase 5) - now with dateRange support
  dashboardMetrics: (id?: string, dateRange?: ReportDateRange) =>
    [
      ...agencyKeys.all,
      "dashboardMetrics",
      id,
      serializeDateRange(dateRange),
    ] as const,
  productionByAgent: (id?: string) =>
    [...agencyKeys.all, "productionByAgent", id] as const,
  // Team report keys (Phase 6) - dateRange serialized to prevent cache thrashing
  performanceReport: (id?: string, dateRange?: ReportDateRange) =>
    [
      ...agencyKeys.all,
      "performanceReport",
      id,
      serializeDateRange(dateRange),
    ] as const,
  weeklyProduction: (id?: string, dateRange?: ReportDateRange) =>
    [
      ...agencyKeys.all,
      "weeklyProduction",
      id,
      serializeDateRange(dateRange),
    ] as const,
  // Override summary keys (Phase 7) - now with dateRange support
  overrideSummary: (id?: string, dateRange?: ReportDateRange) =>
    [
      ...agencyKeys.all,
      "overrideSummary",
      id,
      serializeDateRange(dateRange),
    ] as const,
  overridesByAgent: (id?: string) =>
    [...agencyKeys.all, "overridesByAgent", id] as const,
  // Recruiting summary keys (Phase 8)
  recruitingSummary: (id?: string) =>
    [...agencyKeys.all, "recruitingSummary", id] as const,
  recruitingByRecruiter: (id?: string) =>
    [...agencyKeys.all, "recruitingByRecruiter", id] as const,
};

// =============================================================================
// IMO HOOKS
// =============================================================================

/**
 * Get the current user's IMO
 */
export function useMyImo() {
  return useQuery({
    queryKey: imoKeys.myImo(),
    queryFn: () => imoService.getMyImo(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get an IMO by ID
 */
export function useImoById(imoId: string | undefined) {
  return useQuery({
    queryKey: imoKeys.detail(imoId!),
    queryFn: () => imoService.getImo(imoId!),
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get an IMO with its agencies
 */
export function useImoWithAgencies(imoId: string | undefined) {
  return useQuery({
    queryKey: [...imoKeys.detail(imoId!), "agencies"],
    queryFn: () => imoService.getImoWithAgencies(imoId!),
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get all active IMOs (super admin only)
 * @param options.enabled - Set to false to disable the query (LOW-1 fix)
 */
export function useAllActiveImos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: imoKeys.lists(),
    queryFn: () => imoService.getAllActiveImos(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get ALL IMOs (active + inactive). Intended for the IMO Management settings
 * page so super-admins can see/edit/reactivate deactivated IMOs. Without this,
 * an inactive IMO holding a unique code is invisible to the UI but still
 * blocks code reuse on create.
 *
 * RLS restricts non-super-admins to their own IMO row regardless, so this
 * does not widen visibility for them.
 */
export function useAllImos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: imoKeys.allIncludingInactive(),
    queryFn: () => imoService.getAllImos(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get IMO metrics
 */
export function useImoMetrics(imoId: string | undefined) {
  return useQuery({
    queryKey: imoKeys.metrics(imoId!),
    queryFn: () => imoService.getImoMetrics(imoId!),
    enabled: !!imoId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Create IMO mutation
 */
export function useCreateImo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateImoData) => imoService.createImo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imoKeys.all });
    },
  });
}

/**
 * Update IMO mutation
 */
export function useUpdateImo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ImoUpdate }) =>
      imoService.updateImo(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: imoKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: imoKeys.myImo() });
      queryClient.invalidateQueries({ queryKey: imoKeys.lists() });
    },
  });
}

/**
 * Deactivate IMO mutation
 */
export function useDeactivateImo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imoId: string) => imoService.deactivateImo(imoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imoKeys.all });
    },
  });
}

// =============================================================================
// AGENCY HOOKS
// =============================================================================

/**
 * Get the current user's agency
 */
export function useMyAgency() {
  return useQuery({
    queryKey: agencyKeys.myAgency(),
    queryFn: () => agencyService.getMyAgency(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get an agency by ID
 */
export function useAgencyById(agencyId: string | undefined) {
  return useQuery({
    queryKey: agencyKeys.detail(agencyId!),
    queryFn: () => agencyService.getAgency(agencyId!),
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get an agency with owner info
 */
export function useAgencyWithOwner(agencyId: string | undefined) {
  return useQuery({
    queryKey: [...agencyKeys.detail(agencyId!), "owner"],
    queryFn: () => agencyService.getAgencyWithOwner(agencyId!),
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get all agencies in the current user's IMO
 */
export function useMyImoAgencies(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: agencyKeys.myImoAgencies(),
    queryFn: () => agencyService.getAgenciesInMyImo(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get all active agencies across all IMOs (super admin only)
 */
export function useAllActiveAgencies() {
  return useQuery({
    queryKey: [...agencyKeys.lists(), "allActive"],
    queryFn: () => agencyService.getAllActiveAgencies(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get agencies in a specific IMO
 */
export function useAgenciesByImo(
  imoId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.listByImo(imoId),
    queryFn: () => agencyService.getAgenciesByImo(imoId!),
    enabled: !!imoId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get agency metrics
 */
export function useAgencyMetrics(agencyId: string | undefined) {
  return useQuery({
    queryKey: agencyKeys.metrics(agencyId!),
    queryFn: () => agencyService.getAgencyMetrics(agencyId!),
    enabled: !!agencyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Create agency mutation
 */
export function useCreateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAgencyData) => agencyService.createAgency(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
      queryClient.invalidateQueries({ queryKey: imoKeys.all }); // IMO might have agency count
    },
  });
}

/**
 * Preview cascade assignment - shows how many users would be affected
 * when assigning an owner and their downlines to an agency
 */
export function usePreviewCascadeAssignment(ownerId: string | undefined) {
  return useQuery({
    queryKey: [...agencyKeys.all, "cascadePreview", ownerId],
    queryFn: () => agencyService.previewCascadeAssignment(ownerId!),
    enabled: !!ownerId,
    staleTime: 30 * 1000, // 30 seconds - preview data can be slightly stale
  });
}

/**
 * Create agency with cascade assignment mutation
 * When cascadeDownlines is true, assigns owner + all their downlines to the new agency
 */
export function useCreateAgencyWithCascade() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateAgencyWithCascadeResult,
    Error,
    { data: CreateAgencyData; options?: CreateAgencyWithCascadeOptions }
  >({
    mutationFn: ({ data, options }) =>
      agencyService.createAgencyWithCascade(data, options),
    onSuccess: (result) => {
      // Invalidate agency queries
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
      queryClient.invalidateQueries({ queryKey: imoKeys.all });

      // If cascade occurred, also invalidate user-related queries
      if (
        result.cascadeResult?.success &&
        result.cascadeResult.totalUpdated > 0
      ) {
        // Invalidate user profiles cache
        queryClient.invalidateQueries({ queryKey: ["userProfiles"] });
        queryClient.invalidateQueries({ queryKey: ["users"] });
        // Invalidate hierarchy/team queries
        queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
        queryClient.invalidateQueries({ queryKey: ["team"] });
        queryClient.invalidateQueries({ queryKey: ["downlines"] });
      }
    },
  });
}

/**
 * Update agency mutation
 */
export function useUpdateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgencyUpdate }) =>
      agencyService.updateAgency(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: agencyKeys.myAgency() });
      queryClient.invalidateQueries({ queryKey: agencyKeys.myImoAgencies() });
    },
  });
}

/**
 * Delete agency mutation
 */
export function useDeleteAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agencyId: string) => agencyService.deleteAgency(agencyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}

/**
 * Deactivate agency mutation
 */
export function useDeactivateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agencyId: string) => agencyService.deactivateAgency(agencyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}

/**
 * Assign agent to agency mutation
 */
export function useAssignAgentToAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      agencyId,
    }: {
      agentId: string;
      agencyId: string;
    }) => agencyService.assignAgentToAgency(agentId, agencyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}

/**
 * Transfer agency ownership mutation
 */
export function useTransferAgencyOwnership(agencyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newOwnerId: string) =>
      agencyService.transferOwnership(agencyId, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.detail(agencyId) });
    },
  });
}

// =============================================================================
// DASHBOARD METRICS HOOKS (Phase 5)
// =============================================================================

/**
 * Get IMO dashboard metrics (aggregated for IMO admins)
 * Only returns data if user is IMO admin, IMO owner, or super admin
 * @param dateRange - Optional date range for filtering policies and commissions
 */
export function useImoDashboardMetrics(
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: imoKeys.dashboardMetrics(dateRange),
    queryFn: () => imoService.getDashboardMetrics(dateRange),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get IMO production breakdown by agency
 * Only returns data if user is IMO admin, IMO owner, or super admin
 * @param dateRange - Optional date range for filtering policies and commissions
 */
export function useImoProductionByAgency(
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: imoKeys.productionByAgency(dateRange),
    queryFn: () => imoService.getProductionByAgency(dateRange),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get agency dashboard metrics (aggregated for agency owners)
 * @param agencyId - Optional agency ID. Defaults to user's own agency.
 * @param dateRange - Optional date range for filtering policies and commissions
 * Only returns data if user is agency owner, IMO admin, or super admin
 */
export function useAgencyDashboardMetrics(
  agencyId?: string,
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.dashboardMetrics(agencyId, dateRange),
    queryFn: () => agencyService.getDashboardMetrics(agencyId, dateRange),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get agency production breakdown by agent
 * @param agencyId - Optional agency ID. Defaults to user's own agency.
 * Only returns data if user is agency owner, IMO admin, or super admin
 */
export function useAgencyProductionByAgent(
  agencyId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.productionByAgent(agencyId),
    queryFn: () => agencyService.getProductionByAgent(agencyId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

// =============================================================================
// TEAM PERFORMANCE REPORT HOOKS (Phase 6)
// =============================================================================

/**
 * Get IMO performance report with monthly trends
 * Only returns data if user is IMO admin, IMO owner, or super admin
 */
export function useImoPerformanceReport(
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: imoKeys.performanceReport(dateRange),
    queryFn: () => imoService.getPerformanceReport(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

// NOTE: useTeamComparisonReport was removed - use useImoProductionByAgency instead
// The useImoProductionByAgency hook now returns all fields needed for agency comparison.

/**
 * Get top performers report (agent rankings)
 * Only returns data if user is IMO admin, IMO owner, or super admin
 */
export function useTopPerformersReport(
  limit: number = 20,
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: imoKeys.topPerformers(limit, dateRange),
    queryFn: () => imoService.getTopPerformersReport(limit, dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get agency performance report with monthly trends
 * @param agencyId - Optional agency ID. Defaults to user's own agency.
 * Only returns data if user is agency owner, IMO admin, or super admin
 */
export function useAgencyPerformanceReport(
  agencyId?: string,
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.performanceReport(agencyId, dateRange),
    queryFn: () => agencyService.getPerformanceReport(agencyId, dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get agency weekly production report
 * @param agencyId - Optional agency ID. Defaults to user's own agency.
 * @param dateRange - Optional date range. Defaults to last 12 weeks.
 * Only returns data if user is agency owner, IMO admin, or super admin
 */
export function useAgencyWeeklyProduction(
  agencyId?: string,
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.weeklyProduction(agencyId, dateRange),
    queryFn: () => agencyService.getWeeklyProduction(agencyId, dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

// =============================================================================
// OVERRIDE COMMISSION SUMMARY HOOKS (Phase 7)
// =============================================================================

/**
 * Get IMO override commission summary
 * Only returns data if user is IMO admin, IMO owner, or super admin
 * @param dateRange - Optional date range for filtering by policy effective date
 */
export function useImoOverrideSummary(
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: imoKeys.overrideSummary(dateRange),
    queryFn: () => imoService.getOverrideSummary(dateRange),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get override commission breakdown by agency for IMO admins
 * Only returns data if user is IMO admin, IMO owner, or super admin
 */
export function useImoOverridesByAgency(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: imoKeys.overridesByAgency(),
    queryFn: () => imoService.getOverridesByAgency(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get agency override commission summary
 * @param agencyId - Optional agency ID. Defaults to user's own agency.
 * @param dateRange - Optional date range for filtering by policy effective date
 * Only returns data if user is agency owner, IMO admin, or super admin
 */
export function useAgencyOverrideSummary(
  agencyId?: string,
  dateRange?: ReportDateRange,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.overrideSummary(agencyId, dateRange),
    queryFn: () => agencyService.getOverrideSummary(agencyId, dateRange),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get override commission breakdown by agent for agency owners
 * @param agencyId - Optional agency ID. Defaults to user's own agency.
 * Only returns data if user is agency owner, IMO admin, or super admin
 */
export function useAgencyOverridesByAgent(
  agencyId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.overridesByAgent(agencyId),
    queryFn: () => agencyService.getOverridesByAgent(agencyId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

// =============================================================================
// RECRUITING SUMMARY HOOKS (Phase 8)
// =============================================================================

/**
 * Get IMO recruiting summary (funnel metrics across entire IMO)
 * Only returns data if user is IMO admin, IMO owner, or super admin
 */
export function useImoRecruitingSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: imoKeys.recruitingSummary(),
    queryFn: () => imoService.getRecruitingSummary(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get recruiting breakdown by agency for IMO admins
 * Only returns data if user is IMO admin, IMO owner, or super admin
 */
export function useImoRecruitingByAgency(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: imoKeys.recruitingByAgency(),
    queryFn: () => imoService.getRecruitingByAgency(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get agency recruiting summary (funnel metrics for one agency)
 * @param agencyId - Optional agency ID. Defaults to user's own agency.
 * Only returns data if user is agency owner, IMO admin, or super admin
 */
export function useAgencyRecruitingSummary(
  agencyId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.recruitingSummary(agencyId),
    queryFn: () => agencyService.getRecruitingSummary(agencyId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get recruiting breakdown by recruiter for agency owners
 * @param agencyId - Optional agency ID. Defaults to user's own agency.
 * Only returns data if user is agency owner, IMO admin, or super admin
 */
export function useAgencyRecruitingByRecruiter(
  agencyId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: agencyKeys.recruitingByRecruiter(agencyId),
    queryFn: () => agencyService.getRecruitingByRecruiter(agencyId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}
