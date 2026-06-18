// src/features/inbound-crm/hooks/useInboundCallClient.ts
// Enrichment queries for the inbound-call screen-pop: resolve the popped caller's client record
// (name) and their on-file policy count. Both are gated on a non-null clientId, so they no-op for
// a brand-new caller that has no client linked yet. Read-only; reuse the existing service/repo paths.
import { useQuery } from "@tanstack/react-query";
import { clientService } from "@/services/clients/client";
import { supabase } from "@/services";

/** The popped caller's client record (name, etc.), when the call resolved to a client. */
export function useInboundCallClient(clientId: string | null) {
  return useQuery({
    queryKey: ["inbound-call", "client", clientId],
    queryFn: async () => {
      const res = await clientService.getById(clientId!);
      if (!res.success || !res.data) {
        throw res.error ?? new Error("Client not found");
      }
      return res.data;
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });
}

/** Count of policies on file for the popped caller's client (mirrors PolicyRepository.countPoliciesByClientId). */
export function useInboundCallPolicyCount(clientId: string | null) {
  return useQuery({
    queryKey: ["inbound-call", "policy-count", clientId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("policies")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId!);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });
}
