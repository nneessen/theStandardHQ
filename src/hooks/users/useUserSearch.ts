// src/hooks/users/useUserSearch.ts
// React Query hooks for server-side user search
// Follows patterns from docs/guides/tanstack-query.md

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import {
  searchUsersForAssignment,
  type UserSearchResult,
} from "@/services/users/userSearchService";

/**
 * Named input type for search queries (per guide section 4)
 */
export type SearchUsersInput = {
  searchTerm: string;
  roles?: string[];
  approvalStatus?: "approved" | "pending" | "denied" | null;
  excludeIds?: string[];
  limit?: number;
};

/**
 * Query key factory for user search (per guide section 8)
 * Provides structured, consistent query keys for cache management.
 */
export const userSearchKeys = {
  all: ["users"] as const,
  search: (
    params: Omit<SearchUsersInput, "searchTerm"> & { searchTerm: string },
  ) => ["users", "search", params] as const,
  byId: (id: string) => ["users", "byId", id] as const,
};

/**
 * Search users for assignment (upline selection, recruiter assignment, etc.)
 *
 * Uses 200ms debounce to prevent excessive API calls while typing.
 * Follows patterns from docs/guides/tanstack-query.md
 *
 * @param query - Search term (name or email)
 * @param options - Additional filter options (roles, approval status, exclusions)
 * @returns Query result with matching users
 *
 * @example
 * ```tsx
 * const { data: users, isLoading } = useSearchUsers(searchTerm, {
 *   roles: ['agent', 'admin', 'trainer'],
 *   excludeIds: [currentUserId],
 * });
 * ```
 */
export function useSearchUsers(
  query: string,
  options?: Omit<SearchUsersInput, "searchTerm">,
) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // 200ms debounce (proven pattern from ContactPicker)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const searchParams: SearchUsersInput = {
    searchTerm: debouncedQuery,
    ...options,
  };

  return useQuery({
    queryKey: userSearchKeys.search(searchParams),
    queryFn: async () => {
      // Service throws on error (per guide section 6)
      const result = await searchUsersForAssignment({
        searchTerm: debouncedQuery,
        roles: options?.roles,
        approvalStatus: options?.approvalStatus,
        excludeIds: options?.excludeIds,
        limit: options?.limit,
      });
      return result;
    },
    // Enable when:
    // - Empty string (show initial results)
    // - 2+ characters (meaningful search)
    enabled: debouncedQuery.length >= 2 || debouncedQuery === "",
    staleTime: 30000, // 30 second cache
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}

/**
 * Fetch single user by ID for displaying current selection.
 *
 * One hook = one intent (per TANSTACK_QUERY_IMPLEMENTATION_GUIDE.md)
 *
 * @param userId - The user ID to fetch, or null
 * @returns Query result with user data
 *
 * @example
 * ```tsx
 * const { data: selectedUser } = useUserById(selectedUserId);
 * ```
 */
export function useUserById(userId: string | null) {
  return useQuery({
    queryKey: userSearchKeys.byId(userId || ""),
    queryFn: async (): Promise<UserSearchResult | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, roles, agent_status")
        .eq("id", userId)
        .single();

      // Throw errors, don't return them (guide section 6)
      if (error) {
        throw new Error(`Failed to fetch user: ${error.message}`);
      }

      return {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        roles: (data.roles as string[]) || [],
        agent_status: data.agent_status,
      };
    },
    enabled: !!userId,
    staleTime: 60000, // Cache for 1 minute
  });
}
