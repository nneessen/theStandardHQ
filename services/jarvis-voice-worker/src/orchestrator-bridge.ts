// Bridges one Jarvis voice turn to the Claude brain (the `assistant-orchestrator`
// edge function). This is SDK-agnostic (plain fetch + SSE), so it is the stable,
// fully-testable core of the worker regardless of LiveKit Agents API churn.
//
// SECURITY (the model the review mandated): the worker NEVER holds a service role and
// NEVER impersonates via a header. It calls the orchestrator with the END USER's own
// Supabase JWT — delivered to the worker over the LiveKit data channel by that user's
// browser — so `ctx.db` stays RLS-scoped exactly like the browser's typed path. RLS
// remains the ceiling; the `revocation_deny` kill switch keeps working. See
// plans/active/continue-20260602-jarvis-voice-secondbrain-master-plan.md
// ("Worker → brain auth model").

export interface OrchestratorConfig {
  /** https://<ref>.supabase.co/functions/v1/assistant-orchestrator */
  url: string;
  /** Project anon key — the gateway (verify_jwt) still requires an apikey alongside the user Bearer. */
  anonKey: string;
}

interface SseFrame {
  event: string;
  data: Record<string, unknown> | null;
}

/**
 * Stream one assistant turn. Yields assistant text as `delta` events arrive (so TTS can
 * start speaking before the full reply is ready). Calls `onConversationId` with the id
 * the orchestrator used so the caller can thread the next turn into the same conversation.
 * Throws on a non-2xx / bodyless response — the caller speaks a graceful fallback.
 */
export async function* callOrchestrator(
  cfg: OrchestratorConfig,
  userJwt: string,
  message: string,
  conversationId: string | null,
  onConversationId: (id: string) => void,
): AsyncGenerator<string> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The USER's JWT — RLS scoping rides on this, never a worker secret.
      Authorization: `Bearer ${userJwt}`,
      apikey: cfg.anonKey,
    },
    body: JSON.stringify({ message, conversationId }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`assistant-orchestrator responded ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; emit text as `delta`s arrive.
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const frame = parseSseFrame(buf.slice(0, sep));
      buf = buf.slice(sep + 2);
      if (!frame) continue;

      if (frame.event === "delta") {
        const text = frame.data?.text;
        if (typeof text === "string" && text) yield text;
      } else if (frame.event === "done") {
        const id =
          (frame.data?.conversationId as string | undefined) ??
          (frame.data?.conversation_id as string | undefined);
        if (typeof id === "string") onConversationId(id);
        return;
      }
      // `tool` (chip activity) and other events carry no speakable text — ignore.
    }
  }
}

/** Parse one `event: <name>\ndata: <json>` SSE frame. Returns null if it has no JSON data. */
function parseSseFrame(frame: string): SseFrame | null {
  let event = "message";
  let dataLine = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine) as Record<string, unknown> };
  } catch {
    return null;
  }
}
