// src/hooks/policies/index.ts
// Re-export from new location for backward compatibility
// TODO: Update imports throughout codebase to use @/features/policies/hooks directly

export {
  usePolicy,
  usePolicies,
  usePoliciesPaginated,
  useCreatePolicy,
  useUpdatePolicy,
  useDeletePolicy,
  useCheckSharedClient,
  usePolicySummary,
} from "../../features/policies/hooks";

export type {
  UsePoliciesOptions,
  UsePoliciesPaginatedOptions,
  SortConfig as PolicySortConfig,
  UpdatePolicyParams,
} from "../../features/policies/hooks";

// Re-export query keys for invalidation
export { policyKeys, policyQueries } from "../../features/policies/queries";

// Anniversary persistency buckets (3/6/9/12-month)
export { usePersistency, useTeamPersistency } from "./usePersistency";
export type { PersistencyBucket } from "./usePersistency";

// DEPRECATED: These hooks have been merged into useUpdatePolicy
// useCancelPolicy → useUpdatePolicy({ id, status: 'cancelled', reason })
// useLapsePolicy → useUpdatePolicy({ id, status: 'lapsed' })
// useReinstatePolicy → useUpdatePolicy({ id, status: 'active', previousStatus })

// DEPRECATED: Use usePoliciesPaginated instead
// usePoliciesView → usePoliciesPaginated

// DEPRECATED: Use usePolicies with filters instead
// useInfinitePolicies → removed (over-engineered)
