import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { assistantKeys } from "./useAssistant";
import type {
  ActionDraftPayload,
  ActionRequest,
} from "../types/assistant.types";

const ACTION_COLUMNS =
  "id, channel, tool_name, draft_payload, recipient, status, created_at, error";

/** Pending (awaiting-approval) action requests for the current user. */
export function usePendingActionRequests() {
  return useQuery({
    queryKey: assistantKeys.pendingActions,
    queryFn: async (): Promise<ActionRequest[]> => {
      const { data, error } = await supabase
        .from("assistant_action_requests")
        .select(ACTION_COLUMNS)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActionRequest[];
    },
    staleTime: 15 * 1000,
  });
}

interface ApproveVars {
  id: string;
  recipient: string;
  payload: ActionDraftPayload;
}

interface ExecuteResult {
  ok?: boolean;
  status?: string;
  error?: string;
}

/** Persist the human's edits, mark approved, then execute the send. */
export function useApproveActionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: ApproveVars): Promise<ExecuteResult> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: upErr } = await supabase
        .from("assistant_action_requests")
        .update({
          draft_payload: vars.payload,
          recipient: vars.recipient,
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", vars.id)
        .eq("status", "pending_approval");
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke<ExecuteResult>(
        "assistant-action-execute",
        { body: { actionRequestId: vars.id } },
      );
      if (error) throw error;
      return data ?? {};
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: assistantKeys.pendingActions }),
  });
}

/** Cancel a pending action (no send). */
export function useCancelActionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("assistant_action_requests")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("status", "pending_approval");
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: assistantKeys.pendingActions }),
  });
}
