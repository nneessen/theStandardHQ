// Jarvis realtime voice worker — LiveKit Agents entrypoint.
//
// Pipeline:  mic ─▶ Silero VAD + turn-detection ─▶ Deepgram STT ─▶ (Claude brain via
// assistant-orchestrator, using the USER's JWT) ─▶ ElevenLabs TTS ─▶ speaker, with
// barge-in. The worker keeps NO model of its own — the "LLM" node is a thin bridge to
// the existing orchestrator (src/orchestrator-bridge.ts), so all tools, grounding, and
// RLS-scoped data access are reused unchanged.
//
// ⚠️ SDK SURFACE: `@livekit/agents` (Node) evolves between minor versions. The plugin
// wiring + AgentSession/LLM symbols below are written to the AgentSession pattern; after
// `npm install`, run `npm run typecheck` and reconcile any renamed symbols against the
// RESOLVED types in node_modules/@livekit/agents. The orchestrator bridge + the JWT /
// data-channel flow (the parts that carry the security model) are SDK-agnostic and final.

import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import { callOrchestrator, type OrchestratorConfig } from "./orchestrator-bridge.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const ORCHESTRATOR: OrchestratorConfig = {
  url: `${SUPABASE_URL}/functions/v1/assistant-orchestrator`,
  anonKey: requireEnv("SUPABASE_ANON_KEY"),
};

/**
 * Per-session auth + conversation state. The browser publishes the signed-in user's
 * Supabase JWT over the LiveKit data channel as `{"type":"auth","jwt":"..."}` (and again
 * on every token refresh, since voice sessions outlive a ~1h JWT). We hold the latest one
 * and thread the orchestrator conversation id across turns. NO worker secret, NO
 * service-role — the user's own credential carries RLS scoping.
 */
class SessionState {
  jwt: string | null = null;
  conversationId: string | null = null;

  ingestData(payload: Uint8Array): void {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload)) as {
        type?: string;
        jwt?: string;
      };
      if (msg.type === "auth" && typeof msg.jwt === "string") this.jwt = msg.jwt;
    } catch {
      /* non-JSON data frames (if any) are ignored */
    }
  }
}

/**
 * The "LLM" node: bridges each user turn to the Claude orchestrator with the user's JWT.
 * It ignores the framework's accumulated chat history (the orchestrator owns persistence,
 * routing, and grounding) and forwards only the latest user utterance + the conversation id.
 *
 * ⚠️ Confirm `llm.LLM`'s abstract `chat()` signature + the chunk/stream shape against the
 * installed @livekit/agents types; emit each yielded string as a text delta.
 */
class OrchestratorLLM extends llm.LLM {
  constructor(private readonly session: SessionState) {
    super();
  }

  // The exact return type is the SDK's LLMStream; we adapt callOrchestrator's text
  // generator into it. Keep this thin — the real work is in orchestrator-bridge.ts.
  chat(opts: { chatCtx: llm.ChatContext }): llm.LLMStream {
    const session = this.session;
    const lastUser = [...opts.chatCtx.messages]
      .reverse()
      .find((m) => m.role === "user");
    const text =
      typeof lastUser?.content === "string" ? lastUser.content : "";

    async function* run(): AsyncGenerator<string> {
      if (!session.jwt) {
        yield "I'm not connected to your account yet — please reopen the assistant.";
        return;
      }
      try {
        yield* callOrchestrator(
          ORCHESTRATOR,
          session.jwt,
          text,
          session.conversationId,
          (id) => (session.conversationId = id),
        );
      } catch (_e) {
        yield "Sorry — I hit a problem reaching your data just now. Try again in a moment.";
      }
    }

    // ⚠️ Wrap `run()` in the SDK's LLMStream adapter (e.g. a helper that turns an async
    // text iterator into ChatChunks). Verify the exact constructor after install.
    return llm.LLMStream.fromTextStream
      ? // @ts-expect-error — adapter name/signature pending SDK verification
        llm.LLMStream.fromTextStream(this, run())
      : (run() as unknown as llm.LLMStream);
  }
}

export default defineAgent({
  // Load the VAD model once per worker process (heavy) and reuse across jobs.
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    await ctx.connect();
    const state = new SessionState();

    // Receive the user's JWT (and refreshes) over the data channel.
    ctx.room.on("dataReceived", (payload: Uint8Array) => state.ingestData(payload));

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: new deepgram.STT({
        model: "nova-2",
        // Boost the vocabulary Whisper kept mis-hearing (carriers, products, names).
        keywords: [
          ["Foresters", 2],
          ["Mutual of Omaha", 2],
          ["term life", 1],
          ["whole life", 1],
          ["IUL", 2],
          ["annual premium", 1],
        ],
      }),
      llm: new OrchestratorLLM(state),
      tts: new elevenlabs.TTS({ model: "eleven_turbo_v2_5" }),
      // Barge-in is on by default in AgentSession; turn-detection model is auto-wired.
    });

    await session.start({
      agent: new voice.Agent({
        instructions:
          "You are Jarvis, a voice assistant for an insurance agent. Keep spoken replies concise and natural.",
      }),
      room: ctx.room,
    });
  },
});

// Register this file as the agent worker; LiveKit Cloud auto-dispatches it into rooms.
cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
