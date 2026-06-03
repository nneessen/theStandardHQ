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
  // Caller's cancel signal (barge-in / turn interruption). Combined with the 45s hang-guard
  // so an abandoned turn tears the fetch down immediately instead of streaming to a dead
  // consumer. Optional so existing callers/tests keep working.
  externalSignal?: AbortSignal,
): AsyncGenerator<string> {
  const signal = externalSignal
    ? anySignal([AbortSignal.timeout(45_000), externalSignal])
    : AbortSignal.timeout(45_000);
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The USER's JWT — RLS scoping rides on this, never a worker secret.
      Authorization: `Bearer ${userJwt}`,
      apikey: cfg.anonKey,
      // Tag this as a voice turn so the orchestrator uses the higher-capacity voice
      // request rate-limit bucket instead of the 30/hr typed cap (a spoken session
      // runs 10+ turns/min). The per-user token budget still bounds real spend.
      "x-jarvis-surface": "voice",
    },
    body: JSON.stringify({ message, conversationId }),
    // Hang-guard (45s turn ceiling) OR'd with the caller's cancel signal — the caller
    // catches the AbortError and speaks a graceful fallback (or, on barge-in, stays silent).
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`assistant-orchestrator responded ${res.status}`);
  }

  // Cap the accumulator: a stream that never emits a frame separator (hung or hostile
  // upstream) would otherwise grow `buf` without bound and OOM a worker that hosts other
  // users' rooms. Throw → the caller speaks the graceful fallback.
  const MAX_SSE_BUFFER = 1_000_000;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  // try/finally so EVERY exit path releases the reader lock and cancels the body: the
  // `done`-frame early return, a thrown buffer-overflow, AND the consumer abandoning this
  // generator mid-stream (barge-in → AgentSession calls `.return()` on the iterator). In a
  // persistent worker hosting many rooms, an un-cancelled body holds its connection open
  // until TCP timeout; under load that leaks the fetch/connection pool.
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      if (buf.length > MAX_SSE_BUFFER) {
        throw new Error(
          "assistant-orchestrator stream exceeded buffer ceiling",
        );
      }

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
        } else if (frame.event === "error") {
          // The orchestrator signals per-turn generation failure with an `error` event on an
          // already-200 body, then closes. If we ignored it (as an "other event") the stream
          // would just end with done:true and the generator would return with NO exception —
          // so the caller's catch never fires and the user hears SILENCE instead of the
          // graceful fallback. Throw so buildReplyStream speaks ERROR_MESSAGE.
          const msg =
            typeof frame.data?.message === "string"
              ? frame.data.message
              : "assistant-orchestrator emitted an error event";
          throw new Error(msg);
        }
        // `tool` (chip activity) and other events carry no speakable text — ignore.
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
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

/**
 * Abort when ANY of the given signals aborts. (`AbortSignal.any` is not in our ES2022 lib
 * target, so combine manually with an AbortController — available everywhere.)
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  // Detach our listener from the LOSING signals once the controller aborts. Without this, on
  // the common barge-in path (externalSignal wins at ~2s) the still-pending 45s timeout signal
  // keeps `onAbort` — and the whole closure — retained until its timer fires, needless
  // per-turn retention in a worker hosting many rooms.
  const cleanup = () => {
    for (const s of signals) s.removeEventListener("abort", onAbort);
  };
  for (const s of signals) {
    if (s.aborted) {
      ac.abort();
      cleanup();
      return ac.signal;
    }
  }
  for (const s of signals) s.addEventListener("abort", onAbort, { once: true });
  ac.signal.addEventListener("abort", cleanup, { once: true });
  return ac.signal;
}
