// src/features/clients/hooks/useClientDetail.ts
// One client + their policies (carrier join) for the client detail page. Data-access layer
// (features/**/hooks/** is exempt from the no-@/services eslint rule).
import { useQuery } from "@tanstack/react-query";
import { clientService } from "@/services/clients/client";

/** A single own-book client with their policies + stats (RLS-scoped to the agent). */
export function useClientDetail(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", "detail", clientId],
    queryFn: async () => {
      const res = await clientService.getWithPolicies(clientId!);
      if (!res.success || !res.data) {
        throw res.error ?? new Error("Client not found");
      }
      return res.data;
    },
    enabled: !!clientId,
  });
}
