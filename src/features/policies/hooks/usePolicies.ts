// src/features/policies/hooks/usePolicies.ts
// Hook for fetching policy lists with optional pagination/filtering

import {useQuery, useQueries, keepPreviousData} from '@tanstack/react-query';
import {policyKeys, policyQueries} from '../queries';
import {policyService} from '@/services/policies/policyService';
import type {PolicyFilters} from '@/types/policy.types';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

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
    sortConfig = { field: 'created_at', direction: 'desc' },
    enabled = true,
  } = options;

  // Parallel queries for the current page of data and the total count.
  // NOTE: the aggregate-metrics query was removed once the Policies page
  // dropped its inline stat strip — the insights band derives its figures from
  // the full filtered list instead, so fetching metrics here was pure waste
  // (and a metrics-RPC failure would wrongly surface as a table error).
  const [dataQuery, countQuery] = useQueries({
    queries: [
      {
        queryKey: [...policyKeys.list(filters), 'paginated', page, pageSize, sortConfig] as const,
        queryFn: () => policyService.getPaginated(page, pageSize, filters, sortConfig),
        staleTime: 1000 * 60 * 5,
        placeholderData: keepPreviousData,
        enabled,
      },
      {
        ...policyQueries.count(filters),
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

    // Loading states
    isLoading: dataQuery.isLoading || countQuery.isLoading,
    isFetching: dataQuery.isFetching || countQuery.isFetching,
    error: dataQuery.error || countQuery.error,

    // Refetch all
    refetch: () => {
      dataQuery.refetch();
      countQuery.refetch();
    },
  };
}
