/**
 * Custom Domains Hooks
 *
 * TanStack Query hooks for managing custom domains via Edge Functions.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/services/base/supabase";
import type {
  CustomDomain,
  CreateDomainResponse,
  DomainStatusResponse,
  DeleteDomainResponse,
  DnsInstructions,
} from "@/types/custom-domain.types";

/**
 * Extract the human-readable message an edge function put in its `{ error }`
 * body. `supabase.functions.invoke` reports any non-2xx as a FunctionsHttpError
 * whose `.message` is the generic "Edge Function returned a non-2xx status
 * code" — the real message lives in the Response (`error.context`). Without
 * this, the clear errors the functions return (invalid token, domain in use,
 * etc.) never reach the user.
 */
async function edgeErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body && typeof body.error === "string") return body.error;
    } catch {
      // body wasn't JSON / already consumed — fall through to generic message
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

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
        throw new Error(
          await edgeErrorMessage(error, "Failed to create domain"),
        );
      }

      if (!data) {
        throw new Error("No response from server");
      }

      // Check for error in response body (soft errors returned with 2xx)
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
 * Check status of a domain awaiting DNS / SSL.
 *
 * There is no separate "verify" or "provision" step: the domain is registered
 * with Vercel at create time, the user adds a single CNAME, and this endpoint
 * watches Vercel until the domain is configured (auto-advancing to active).
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
        throw new Error(
          await edgeErrorMessage(error, "Failed to check domain status"),
        );
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
        throw new Error(
          await edgeErrorMessage(error, "Failed to delete domain"),
        );
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
