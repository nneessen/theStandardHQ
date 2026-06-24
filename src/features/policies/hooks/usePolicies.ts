// src/features/policies/hooks/usePolicies.ts
// Hook for fetching policy lists with optional pagination/filtering

import { useQuery, useQueries, keepPreviousData } from "@tanstack/react-query";
import { policyKeys, policyQueries } from "../queries";
import { policyService } from "@/services/policies/policyService";
import type { PolicyFilters, PolicySortConfig } from "@/types/policy.types";

/** Alias kept so existing imports keep working; canonical type lives in policy.types. */
export type SortConfig = PolicySortConfig;

export interface UsePoliciesOptions {
  filters?: PolicyFilters;
  enabled?: boolean;
}

export interface UsePoliciesPaginatedOptions {
  page: number;
  pageSize: number;
  filters?: PolicyFilters;
  sortConfig?: SortConfig;
  enabled?: boolean;
}

/**
 * Fetch all policies with optional filtering (no pagination)
 *
 * @param options - Optional filters and query options
 * @returns TanStack Query result with policies array
 *
 * @example
 * const { data: policies } = usePolicies({ filters: { status: 'active' } });
 */
export function usePolicies(options: UsePoliciesOptions = {}) {
  const { filters = {}, enabled = true } = options;

  return useQuery({
    ...policyQueries.list(filters),
    enabled,
  });
}

/**
 * Fetch paginated policies with filtering, sorting, count, and metrics
 * Use this for table views that need pagination controls
 *
 * @param options - Pagination, filters, and sorting options
 * @returns Data, count, metrics, and loading states
 *
 * @example
 * const { policies, totalCount, metrics, isLoading } = usePoliciesPaginated({
 *   page: 1,
 *   pageSize: 10,
 *   filters: { status: 'active' },
 *   sortConfig: { field: 'created_at', direction: 'desc' }
 * });
 */
export function usePoliciesPaginated(options: UsePoliciesPaginatedOptions) {
  const {
    page,
    pageSize,
    filters = {},
    sortConfig = { field: "created_at", direction: "desc" },
    enabled = true,
  } = options;

  // Parallel queries for data, count, and metrics
  const [dataQuery, countQuery, metricsQuery] = useQueries({
    queries: [
      {
        queryKey: policyKeys.paginated(page, pageSize, filters, sortConfig),
        queryFn: () =>
          policyService.getPaginated(page, pageSize, filters, sortConfig),
        staleTime: 1000 * 60 * 5,
        placeholderData: keepPreviousData,
        enabled,
      },
      {
        ...policyQueries.count(filters),
        enabled,
      },
      {
        // Server-side aggregate (counts + premium + YTD + earned/pending
        // commission) — replaces client-side loading of all commissions/policies.
        ...policyQueries.dashboardMetrics(filters),
        enabled,
      },
    ],
  });

  const policies = dataQuery.data || [];
  const totalCount = countQuery.data || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    // Data
    policies,
    totalCount,
    totalPages,
    metrics: metricsQuery.data,

    // Loading states
    isLoading: dataQuery.isLoading || countQuery.isLoading,
    isFetching: dataQuery.isFetching || countQuery.isFetching,
    error: dataQuery.error || countQuery.error || metricsQuery.error,

    // Refetch all
    refetch: () => {
      dataQuery.refetch();
      countQuery.refetch();
      metricsQuery.refetch();
    },
  };
}
