import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import type { OrchestratorResponse } from "../types/assistant.types";

export const assistantKeys = {
  all: ["assistant"] as const,
  preferences: ["assistant", "preferences"] as const,
  pendingActions: ["assistant", "pending-actions"] as const,
  conversation: (id: string) => ["assistant", "conversation", id] as const,
};

interface SendVars {
  message: string;
  conversationId?: string | null;
}

/** Send a message to the orchestrator and return its grounded response. */
export function useSendAssistantMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: SendVars): Promise<OrchestratorResponse> => {
      const { data, error } =
        await supabase.functions.invoke<OrchestratorResponse>(
          "assistant-orchestrator",
          {
            body: {
              message: vars.message,
              conversationId: vars.conversationId ?? undefined,
            },
          },
        );
      if (error) throw error;
      if (!data) throw new Error("No response from the assistant.");
      return data;
    },
    onSuccess: () => {
      // A draft tool may have created a pending action; refresh the approval queue.
      qc.invalidateQueries({ queryKey: assistantKeys.pendingActions });
    },
  });
}
