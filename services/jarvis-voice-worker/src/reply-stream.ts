// Builds the per-turn assistant reply stream for the Jarvis voice agent, with barge-in-safe
// teardown. Extracted from agent.ts (a) so the cancel/teardown logic lives in one tested
// place, and (b) so it can be unit-tested WITHOUT importing agent.ts (which boots the worker
// and reads env at module load).
//
// THE BUG THIS FIXES: the AgentSession TTS pipeline CANCELS this stream on barge-in / turn
// interruption. After a cancel the ReadableStream controller is already closed, so a later
// controller.enqueue()/close() throws "Invalid state: Controller is already closed" — seen in
// prod logs as `[jarvis] orchestrator ERROR: Invalid state: Controller is already closed`.
// We track cancellation, guard every controller op, and abort the in-flight orchestrator
// fetch via the AbortSignal handed to `stream` so the upstream call is torn down promptly.

export interface ReplyTurn {
  /** The user's verified Supabase JWT, or null if it never arrived over the data channel. */
  jwt: string | null;
  /** The recognized user utterance for this turn. */
  text: string;
  /**
   * Produces the assistant's text deltas. Injected (rather than calling the orchestrator
   * bridge directly) so tests can drive cancellation deterministically. The passed
   * AbortSignal fires when the consumer cancels the stream (barge-in); the implementation
   * MUST forward it to its fetch so the upstream call is torn down.
   */
  stream: (signal: AbortSignal) => AsyncGenerator<string>;
}

const NO_AUTH_MESSAGE =
  "I'm not connected to your account yet — please reopen the assistant.";
const ERROR_MESSAGE =
  "Sorry — I hit a problem reaching your data just now. Try again in a moment.";

export function buildReplyStream(turn: ReplyTurn): ReadableStream<string> {
  // `cancelled` flips when the consumer cancels the stream OR if an enqueue throws because the
  // controller was closed out from under us. `abort` tears down the upstream orchestrator fetch.
  let cancelled = false;
  const abort = new AbortController();

  return new ReadableStream<string>({
    async start(controller) {
      const enqueue = (chunk: string): void => {
        if (cancelled) return;
        try {
          controller.enqueue(chunk);
        } catch {
          // Consumer closed the stream between the guard check and here — stop emitting.
          cancelled = true;
        }
      };
      const close = (): void => {
        if (cancelled) return;
        try {
          controller.close();
        } catch {
          /* already closed by the consumer; nothing to do */
        }
      };

      console.log(
        `[jarvis] llmNode invoked; jwt=${turn.jwt ? "PRESENT" : "MISSING"}; text="${turn.text}"`,
      );

      if (!turn.jwt) {
        enqueue(NO_AUTH_MESSAGE);
        close();
        return;
      }

      try {
        let deltas = 0;
        for await (const delta of turn.stream(abort.signal)) {
          if (cancelled) break;
          deltas += 1;
          enqueue(delta);
        }
        console.log(
          `[jarvis] orchestrator stream done; ${deltas} delta(s)${cancelled ? " (cancelled)" : ""}`,
        );
      } catch (e) {
        // A cancel aborts the fetch, which surfaces here as an AbortError — that is expected
        // teardown, not a failure, so stay silent and do not try to speak a fallback into a
        // dead stream.
        if (!cancelled) {
          console.log(
            `[jarvis] orchestrator ERROR: ${e instanceof Error ? e.message : String(e)}`,
          );
          enqueue(ERROR_MESSAGE);
        }
      }
      close();
    },

    cancel() {
      // Consumer (AgentSession TTS) abandoned the stream — barge-in or turn interruption.
      // Stop enqueuing and tear down the upstream orchestrator fetch.
      cancelled = true;
      abort.abort();
    },
  });
}

// Exposed for tests only.
export const _internal = { NO_AUTH_MESSAGE, ERROR_MESSAGE };
