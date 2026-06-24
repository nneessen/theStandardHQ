// src/features/policies/queries.ts

import { queryOptions } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { policyService } from "@/services/policies/policyService";
import type { PolicyFilters, PolicySortConfig } from "@/types/policy.types";

/** Most policy data is fine for ~5 minutes. */
const POLICY_STALE_TIME = 5 * 60 * 1000;
/** Recently-unlinked policies refresh more often so attribution stays fresh. */
const RECENT_POLICY_STALE_TIME = 2 * 60 * 1000;

export const policyKeys = {
  all: ["policies"] as const,
  lists: () => [...policyKeys.all, "list"] as const,
  // Default filters to `{}` so `list()` and `list({})` produce the SAME key.
  list: (filters: PolicyFilters = {}) =>
    [...policyKeys.lists(), filters] as const,
  // Canonical paginated key. Used by both the query factory below and
  // usePoliciesPaginated so invalidation/prefetch/tests all derive the same key.
  // Composed from `list(filters)` so it nests under BOTH the broad `lists()`
  // prefix (used by mutation invalidation) AND the `list(filters)` prefix, which
  // keeps filter-scoped invalidation able to reach paginated queries.
  paginated: (
    page: number,
    pageSize: number,
    filters: PolicyFilters = {},
    sortConfig?: PolicySortConfig,
  ) =>
    [
      ...policyKeys.list(filters),
      "paginated",
      page,
      pageSize,
      sortConfig,
    ] as const,
  details: () => [...policyKeys.all, "detail"] as const,
  detail: (id: string) => [...policyKeys.details(), id] as const,
  // Default filters to `{}` so a bare `count()`/`metrics()` (used for broad
  // invalidation) matches the `{}`-keyed queries the hooks create — an
  // `undefined` third element does NOT partial-match an object one.
  count: (filters: PolicyFilters = {}) =>
    [...policyKeys.all, "count", filters] as const,
  metrics: (filters: PolicyFilters = {}) =>
    [...policyKeys.all, "metrics", filters] as const,
  byLeadPurchase: (leadPurchaseId: string) =>
    [...policyKeys.all, "by-lead-purchase", leadPurchaseId] as const,
  unlinkedRecent: (userId: string) =>
    [...policyKeys.all, "unlinked-recent", userId] as const,
};

export const policyQueries = {
  detail: (id: string) =>
    queryOptions({
      queryKey: policyKeys.detail(id),
      queryFn: () => policyService.getById(id),
      staleTime: POLICY_STALE_TIME,
    }),

  list: (filters: PolicyFilters = {}) =>
    queryOptions({
      queryKey: policyKeys.list(filters),
      queryFn: () => policyService.getFiltered(filters),
      staleTime: POLICY_STALE_TIME,
    }),

  paginated: (
    page: number,
    pageSize: number,
    filters: PolicyFilters = {},
    sortConfig?: PolicySortConfig,
  ) =>
    queryOptions({
      queryKey: policyKeys.paginated(page, pageSize, filters, sortConfig),
      queryFn: () =>
        policyService.getPaginated(page, pageSize, filters, sortConfig),
      staleTime: POLICY_STALE_TIME,
    }),

  count: (filters: PolicyFilters = {}) =>
    queryOptions({
      queryKey: policyKeys.count(filters),
      queryFn: () => policyService.getCount(filters),
      staleTime: POLICY_STALE_TIME,
    }),

  metrics: (filters: PolicyFilters = {}) =>
    queryOptions({
      queryKey: policyKeys.metrics(filters),
      queryFn: () => policyService.getAggregateMetrics(filters),
      staleTime: POLICY_STALE_TIME,
    }),

  byLeadPurchase: (leadPurchaseId: string) =>
    queryOptions({
      queryKey: policyKeys.byLeadPurchase(leadPurchaseId),
      queryFn: () => policyService.findByLeadPurchaseId(leadPurchaseId),
      staleTime: POLICY_STALE_TIME,
    }),

  unlinkedRecent: (userId: string) =>
    queryOptions({
      queryKey: policyKeys.unlinkedRecent(userId),
      queryFn: () => policyService.findUnlinkedRecent(userId),
      staleTime: RECENT_POLICY_STALE_TIME,
    }),
};
