/**
 * Custom Domains Hooks
 *
 * TanStack Query hooks for managing custom domains via Edge Functions.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import type {
  CustomDomain,
  CreateDomainResponse,
  VerifyDomainResponse,
  ProvisionDomainResponse,
  DomainStatusResponse,
  DeleteDomainResponse,
  DnsInstructions,
} from "@/types/custom-domain.types";

// Query keys
export const customDomainKeys = {
  all: ["custom-domains"] as const,
  list: (userId?: string) => [...customDomainKeys.all, "list", userId] as const,
  detail: (id: string) => [...customDomainKeys.all, "detail", id] as const,
};

/**
 * Get all custom domains for the current user
 *
 * SECURITY: Explicitly filters by user_id even though RLS policies exist.
 * This prevents super admins from seeing other users' domains in the UI
 * (the super admin RLS policy is for SQL debugging, not UI display).
 * Query key includes user_id to prevent cache pollution between users.
 */
export function useMyCustomDomains() {
  return useQuery({
    queryKey: customDomainKeys.list("current"),
    queryFn: async (): Promise<CustomDomain[]> => {
      // Get current user to filter explicitly (defense-in-depth for super admins)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("custom_domains")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch custom domains: ${error.message}`);
      }

      return data ?? [];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get a single custom domain by ID
 *
 * SECURITY: Explicitly filters by user_id to prevent super admins from
 * accessing other users' domain details in the UI.
 */
export function useCustomDomainDetail(domainId: string | null) {
  return useQuery({
    queryKey: customDomainKeys.detail(domainId ?? ""),
    queryFn: async (): Promise<CustomDomain | null> => {
      if (!domainId) return null;

      // Get current user for explicit ownership check
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data, error } = await supabase
        .from("custom_domains")
        .select("*")
        .eq("id", domainId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found or not owned
        throw new Error(`Failed to fetch domain: ${error.message}`);
      }

      return data;
    },
    enabled: !!domainId,
    staleTime: 10 * 1000, // 10 seconds
  });
}

/**
 * Create a new custom domain
 */
export function useCreateCustomDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      hostname: string,
    ): Promise<{ domain: CustomDomain; dns_instructions: DnsInstructions }> => {
      const { data, error } =
        await supabase.functions.invoke<CreateDomainResponse>(
          "custom-domain-create",
          {
            body: { hostname },
          },
        );

      if (error) {
        throw new Error(error.message || "Failed to create domain");
      }

      if (!data) {
        throw new Error("No response from server");
      }

      // Check for error in response body
      if ("error" in data && typeof data.error === "string") {
        throw new Error(data.error);
      }

      return {
        domain: data.domain,
        dns_instructions: data.dns_instructions,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customDomainKeys.all });
    },
  });
}

/**
 * Verify DNS for a custom domain
 */
export function useVerifyCustomDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domainId: string): Promise<VerifyDomainResponse> => {
      const { data, error } =
        await supabase.functions.invoke<VerifyDomainResponse>(
          "custom-domain-verify",
          {
            body: { domain_id: domainId },
          },
        );

      if (error) {
        throw new Error(error.message || "Failed to verify domain");
      }

      if (!data) {
        throw new Error("No response from server");
      }

      return data;
    },
    onSuccess: (_, domainId) => {
      queryClient.invalidateQueries({ queryKey: customDomainKeys.all });
      queryClient.invalidateQueries({
        queryKey: customDomainKeys.detail(domainId),
      });
    },
  });
}

/**
 * Provision a verified domain on Vercel
 */
export function useProvisionCustomDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domainId: string): Promise<ProvisionDomainResponse> => {
      const { data, error } =
        await supabase.functions.invoke<ProvisionDomainResponse>(
          "custom-domain-provision",
          {
            body: { domain_id: domainId },
          },
        );

      if (error) {
        throw new Error(error.message || "Failed to provision domain");
      }

      if (!data) {
        throw new Error("No response from server");
      }

      // Check for error in response body
      if ("error" in data && typeof data.error === "string") {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (_, domainId) => {
      queryClient.invalidateQueries({ queryKey: customDomainKeys.all });
      queryClient.invalidateQueries({
        queryKey: customDomainKeys.detail(domainId),
      });
    },
  });
}

/**
 * Check status of a provisioning domain
 */
export function useCheckDomainStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domainId: string): Promise<DomainStatusResponse> => {
      const { data, error } =
        await supabase.functions.invoke<DomainStatusResponse>(
          "custom-domain-status",
          {
            body: { domain_id: domainId },
          },
        );

      if (error) {
        throw new Error(error.message || "Failed to check domain status");
      }

      if (!data) {
        throw new Error("No response from server");
      }

      return data;
    },
    onSuccess: (_, domainId) => {
      // Always invalidate — status can change during provisioning/error cycles
      queryClient.invalidateQueries({ queryKey: customDomainKeys.all });
      queryClient.invalidateQueries({
        queryKey: customDomainKeys.detail(domainId),
      });
    },
  });
}

/**
 * Delete a custom domain
 */
export function useDeleteCustomDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domainId: string): Promise<DeleteDomainResponse> => {
      const { data, error } =
        await supabase.functions.invoke<DeleteDomainResponse>(
          "custom-domain-delete",
          {
            body: { domain_id: domainId },
          },
        );

      if (error) {
        throw new Error(error.message || "Failed to delete domain");
      }

      if (!data) {
        throw new Error("No response from server");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customDomainKeys.all });
    },
  });
}

/**
 * Hook for polling domain status during provisioning
 * Implements backoff: 10s → 20s → 30s → 60s, stops after 3 min
 */
export function useDomainStatusPolling(
  domainId: string | null,
  enabled: boolean,
) {
  const checkStatus = useCheckDomainStatus();

  return useQuery({
    queryKey: [...customDomainKeys.detail(domainId ?? ""), "polling"],
    queryFn: async () => {
      if (!domainId) return null;
      return checkStatus.mutateAsync(domainId);
    },
    enabled: enabled && !!domainId,
    refetchInterval: (query) => {
      // Stop polling if domain is no longer provisioning
      const data = query.state.data;
      if (data && data.status !== "provisioning") {
        return false;
      }

      // Implement backoff based on fetch count
      const fetchCount = query.state.dataUpdateCount;
      if (fetchCount <= 1) return 10000; // 10s
      if (fetchCount <= 3) return 20000; // 20s
      if (fetchCount <= 6) return 30000; // 30s
      if (fetchCount <= 9) return 60000; // 60s
      return false; // Stop after ~3 min
    },
    staleTime: 0,
    gcTime: 0,
  });
}
