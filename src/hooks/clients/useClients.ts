// src/hooks/clients/useClients.ts
// Own-book client list for the current agent. RLS scopes `clients` to user_id = auth.uid(),
// so this returns only the signed-in agent's clients (+ policy stats). Data-access layer:
// lives under src/hooks/** so it may import the service directly (eslint exemption).
import { useQuery } from "@tanstack/react-query";
import { clientService } from "@/services/clients/client";
import type { ClientFilters } from "@/types/client.types";

export const ownClientKeys = {
  all: ["clients", "own"] as const,
  list: (filters?: ClientFilters) => [...ownClientKeys.all, filters] as const,
};

/** The signed-in agent's own-book clients with policy stats (count / active / premium). */
export function useClients(filters?: ClientFilters) {
  return useQuery({
    queryKey: ownClientKeys.list(filters),
    queryFn: async () => {
      const res = await clientService.getAllWithStats(filters);
      if (!res.success) {
        throw res.error ?? new Error("Failed to load clients");
      }
      return res.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
