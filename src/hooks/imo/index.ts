// src/hooks/imo/index.ts

export { useImo, ImoProvider, withImo } from "./useImo";
export {
  // Query keys
  imoKeys,
  agencyKeys,
  // IMO hooks
  useMyImo,
  useImoById,
  useImoWithAgencies,
  useAllActiveImos,
  useAllImos,
  useImoMetrics,
  useCreateImo,
  useUpdateImo,
  useDeactivateImo,
  // Agency hooks
  useMyAgency,
  useAgencyById,
  useAgencyWithOwner,
  useMyImoAgencies,
  useAgenciesByImo,
  useAgencyMetrics,
  useCreateAgency,
  useCreateAgencyWithCascade,
  usePreviewCascadeAssignment,
  useUpdateAgency,
  useDeleteAgency,
  useDeactivateAgency,
  useAssignAgentToAgency,
  useTransferAgencyOwnership,
  useAllActiveAgencies,
  // Dashboard metrics hooks (Phase 5)
  useImoDashboardMetrics,
  useImoProductionByAgency,
  useAgencyDashboardMetrics,
  useAgencyProductionByAgent,
  // Team performance report hooks (Phase 6)
  useImoPerformanceReport,
  // NOTE: useTeamComparisonReport removed - use useImoProductionByAgency instead
  useTopPerformersReport,
  useAgencyPerformanceReport,
  // Override summary hooks (Phase 7)
  useImoOverrideSummary,
  useImoOverridesByAgency,
  useAgencyOverrideSummary,
  useAgencyOverridesByAgent,
  // Recruiting summary hooks (Phase 8)
  useImoRecruitingSummary,
  useImoRecruitingByAgency,
  useAgencyRecruitingSummary,
  useAgencyRecruitingByRecruiter,
} from "./useImoQueries";
