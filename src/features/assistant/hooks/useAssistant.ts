import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import {
  supabaseAnonKey,
  supabaseFunctionsUrl,
} from "@/services/base/supabase-config";
import type {
  OrchestratorResponse,
  ToolActivityItem,
} from "../types/assistant.types";

export const assistantKeys = {
  all: ["assistant"] as const,
  preferences: ["assistant", "preferences"] as const,
  pendingActions: ["assistant", "pending-actions"] as const,
  conversation: (id: string) => ["assistant", "conversation", id] as const,
};

interface SendVars {
  message: string;
  conversationId?: string | null;
  /** Called for each text delta as the reply streams in. */
  onDelta?: (text: string) => void;
  /** Called when a tool finishes, for live activity chips. */
  onTool?: (item: ToolActivityItem) => void;
}

interface DonePayload {
  conversationId: string;
  agentKey: string;
  actionRequests: OrchestratorResponse["actionRequests"];
  toolActivity: ToolActivityItem[];
}

// Parse the orchestrator's Server-Sent Events stream, dispatching delta/tool
// events to the caller and returning the assembled final response. The transport
// is SSE (not functions.invoke) so the reply can render + speak as it generates.
async function streamOrchestrator(
  vars: SendVars,
): Promise<OrchestratorResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";

  const res = await fetch(`${supabaseFunctionsUrl}/assistant-orchestrator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: vars.message,
      conversationId: vars.conversationId ?? undefined,
    }),
  });

  if (!res.ok || !res.body) {
    // Errors come back as JSON (auth/gate/validation), not a stream.
    const err = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? "The assistant failed to respond.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullMessage = "";
  let done: DonePayload | null = null;
  let streamError: string | null = null;

  const handleEvent = (event: string | undefined, payload: unknown) => {
    if (event === "delta") {
      const text = (payload as { text?: string }).text ?? "";
      fullMessage += text;
      vars.onDelta?.(text);
    } else if (event === "tool") {
      vars.onTool?.(payload as ToolActivityItem);
    } else if (event === "done") {
      done = payload as DonePayload;
    } else if (event === "error") {
      streamError = (payload as { error?: string }).error ?? "stream error";
    }
  };

  // SSE frames are separated by a blank line; each frame is `event: X` + `data: Y`.
  for (;;) {
    const { done: rdone, value } = await reader.read();
    if (rdone) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const eventMatch = frame.match(/^event: (.*)$/m);
      const dataMatch = frame.match(/^data: (.*)$/m);
      if (!dataMatch) continue;
      let payload: unknown;
      try {
        payload = JSON.parse(dataMatch[1]);
      } catch {
        continue;
      }
      handleEvent(eventMatch?.[1], payload);
    }
  }

  if (streamError) throw new Error(streamError);
  if (!done) throw new Error("The assistant did not complete its response.");
  const completed: DonePayload = done;

  return {
    conversationId: completed.conversationId,
    agentKey: completed.agentKey,
    message: fullMessage,
    toolActivity: completed.toolActivity ?? [],
    actionRequests: completed.actionRequests ?? [],
  };
}

/** Send a message to the orchestrator and stream its grounded response. */
export function useSendAssistantMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: SendVars): Promise<OrchestratorResponse> =>
      streamOrchestrator(vars),
    onSuccess: () => {
      // A draft tool may have created a pending action; refresh the approval queue.
      qc.invalidateQueries({ queryKey: assistantKeys.pendingActions });
    },
  });
}
