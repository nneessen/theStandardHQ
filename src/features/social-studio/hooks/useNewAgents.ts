// src/features/social-studio/hooks/useNewAgents.ts
// Lists the agency's agents for the "New Agents" studio view + advances an agent's photo
// rotation cursor after a post (architecture: features → hooks → services, so the page
// never imports the service layer directly). Scoped by imo_id; disabled until the tenant
// resolves.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNewAgents,
  bumpAgentPhotoRotation,
  type NewAgentRow,
} from "@/services/social-studio";

export type { NewAgentRow };

export const NEW_AGENT_KEYS = {
  all: ["social-studio", "new-agents"] as const,
  list: (imoId: string | null) => [...NEW_AGENT_KEYS.all, imoId] as const,
};

export function useNewAgents(imoId: string | null) {
  return useQuery({
    queryKey: NEW_AGENT_KEYS.list(imoId),
    queryFn: () => listNewAgents(imoId as string),
    enabled: !!imoId,
  });
}

/** Advance an agent's rotation cursor after a successful welcome post/schedule so the next
 *  post uses the next photo. Best-effort — a bump failure must never surface after a
 *  successful post; on success the list refetches so the preview reflects the next photo. */
export function useBumpAgentRotation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (agentId) => bumpAgentPhotoRotation(agentId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: NEW_AGENT_KEYS.all }),
    onError: (e) => console.error("[useBumpAgentRotation] bump failed:", e),
  });
}
