// Jarvis realtime voice worker — LiveKit Agents entrypoint.
//
// Pipeline:  mic ─▶ Silero VAD + turn-detection ─▶ Deepgram STT ─▶ (Claude brain via
// assistant-orchestrator, using the USER's JWT) ─▶ ElevenLabs TTS ─▶ speaker, with
// barge-in. The worker keeps NO model of its own — instead of an `llm.LLM`, we subclass
// `voice.Agent` and override its `llmNode()` to bridge each user turn straight to the
// existing orchestrator (src/orchestrator-bridge.ts), so all tools, grounding, and
// RLS-scoped data access are reused unchanged.
//
// SDK pinned to @livekit/agents@1.4.5. The LLM bridge lives in `llmNode()` (the node the
// AgentSession pipes STT→TTS through) rather than a custom `llm.LLM`/`LLMStream`, because
// in 1.x `LLMStream` is an abstract class with no public text-stream adapter — overriding
// `llmNode` to return a `ReadableStream<string>` is the idiomatic, type-clean bridge. The
// orchestrator bridge + the JWT / data-channel flow (the parts that carry the security
// model) are SDK-agnostic and final.

import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as silero from "@livekit/agents-plugin-silero";
import {
  BackgroundVoiceCancellation,
  NoiseCancellation,
} from "@livekit/noise-cancellation-node";
import type { NoiseCancellationOptions } from "@livekit/rtc-node";
import { fileURLToPath } from "node:url";
import { ReadableStream } from "node:stream/web";
import {
  callOrchestrator,
  type OrchestratorConfig,
} from "./orchestrator-bridge.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

// Runtime-toggled inbound noise cancellation (env `NOISE_CANCELLATION`, restart to change):
//   "bvc" → Krisp Background Voice Cancellation (removes background HUMAN voices, e.g. a TV)
//   "nc"  → Krisp noise cancellation (stationary noise only)
//   unset/anything else → OFF (raw mic straight to VAD/STT)
// Both Krisp modes need the feature enabled on the LiveKit Cloud project; if it isn't, the
// inbound AudioStream can stall (frames consumed, none emitted) → VAD/STT hear silence and
// the agent never responds. Kept as a kill-switch so we can A/B it without a rebuild.
function resolveNoiseCancellation(): NoiseCancellationOptions | undefined {
  switch (process.env.NOISE_CANCELLATION) {
    case "bvc":
      return BackgroundVoiceCancellation();
    case "nc":
      return NoiseCancellation();
    default:
      return undefined;
  }
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

  // `ownerUid` is parsed from the LiveKit-signed room name (`jarvis-<uid>-<session>`).
  // We accept an auth JWT only if its `sub` matches it — so even though the data channel
  // hands us a bearer token, the worker can't be made to act as a *different* user
  // (defense-in-depth that enforces the token endpoint's stated identity anchor).
  constructor(private readonly ownerUid: string | null) {}

  ingestData(payload: Uint8Array): void {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload)) as {
        type?: string;
        jwt?: string;
      };
      if (msg.type !== "auth" || typeof msg.jwt !== "string") {
        console.log(`[jarvis] data frame ignored (type=${msg.type ?? "?"})`);
        return;
      }
      // Bind to the room owner. Decode (NOT verify — the orchestrator verifies the
      // signature) the `sub` and reject any token that isn't this room's user.
      const sub = decodeJwtSub(msg.jwt);
      if (this.ownerUid && sub && sub !== this.ownerUid) {
        console.log(
          `[jarvis] auth REJECTED: sub=${sub} != owner=${this.ownerUid}`,
        );
        return; // mismatch → reject silently
      }
      this.jwt = msg.jwt;
      console.log(`[jarvis] auth JWT stored (sub=${sub ?? "?"})`);
    } catch {
      /* non-JSON data frames (if any) are ignored */
    }
  }
}

/** Decode (without verifying) a JWT's `sub`. Signature verification is the orchestrator's job. */
function decodeJwtSub(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { sub?: string };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * Pull the latest user utterance out of the framework's chat context. In 1.x `ChatContext`
 * exposes `.items` (a union of message / function-call / etc. items); we want the most
 * recent `message` item with role `user` and its joined text (`.textContent`). The
 * orchestrator owns history/routing/grounding, so we forward only this single utterance.
 */
function latestUserText(chatCtx: llm.ChatContext): string {
  for (let i = chatCtx.items.length - 1; i >= 0; i--) {
    const item = chatCtx.items[i];
    if (item?.type === "message" && item.role === "user") {
      return item.textContent ?? "";
    }
  }
  return "";
}

/**
 * Stub LLM that exists ONLY to satisfy @livekit/agents@1.4.5's reply-pipeline guards.
 * `onUserTurnCompleted` returns early when `this.llm === undefined` and `generateReply`
 * throws "trying to generate reply without an LLM model" — so with NO `llm` the session
 * transcribes speech but never generates a reply (our `llmNode` is never called). We use no
 * real model — generation is bridged to the Claude orchestrator in `JarvisAgent.llmNode()` —
 * but the session must still be handed an `llm instanceof LLM` so the pipeline runs. The
 * plain-LLM reply path routes through `pipelineReplyTask → agent.llmNode` (verified in
 * agent_activity.js), so `chat()` below is never reached; `capabilities` is read only for a
 * RealtimeModel, so a plain LLM needs nothing more than `label()` + `chat()`.
 */
class BridgeLLM extends llm.LLM {
  label(): string {
    return "jarvis.BridgeLLM";
  }

  // Never invoked — llmNode handles generation. Throw loudly so an SDK change that ever
  // routes generation through chat() surfaces as a clear error instead of silent dead air.
  chat(): llm.LLMStream {
    throw new Error(
      "BridgeLLM.chat() should never be called — JarvisAgent.llmNode bridges to the orchestrator instead",
    );
  }
}

/**
 * The Jarvis voice agent. The AgentSession is handed a stub `llm` (BridgeLLM) purely to
 * unlock the reply pipeline; real generation happens HERE — we override `llmNode` (the stage
 * the session pipes the recognized user turn through on its way to TTS) and bridge it to the
 * Claude orchestrator with the user's JWT. Returning a `ReadableStream` of text deltas lets
 * TTS start speaking before the full reply is ready.
 */
class JarvisAgent extends voice.Agent {
  // NOTE: must NOT be named `session` — `voice.Agent` already exposes `get session()`
  // (the AgentSession); shadowing it would break the base class.
  constructor(private readonly authState: SessionState) {
    super({
      instructions:
        "You are Jarvis, a voice assistant for an insurance agent. Keep spoken replies concise and natural.",
    });
  }

  // Override the LLM node. The default implementation drives `this.llm`; we have none, so
  // we stream the orchestrator's text deltas instead. Params are annotated explicitly
  // (TS doesn't infer override param types under `strict`); `override` makes signature
  // drift across SDK bumps fail loudly. Return type unions `ChatChunk | string` to match
  // the base contract — we only ever enqueue `string` deltas.
  override async llmNode(
    chatCtx: llm.ChatContext,
    _toolCtx: llm.ToolContext,
    _modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    const authState = this.authState;
    const text = latestUserText(chatCtx);

    return new ReadableStream<llm.ChatChunk | string>({
      async start(controller) {
        console.log(
          `[jarvis] llmNode invoked; jwt=${authState.jwt ? "PRESENT" : "MISSING"}; text="${text}"`,
        );
        if (!authState.jwt) {
          controller.enqueue(
            "I'm not connected to your account yet — please reopen the assistant.",
          );
          controller.close();
          return;
        }
        try {
          let deltas = 0;
          for await (const delta of callOrchestrator(
            ORCHESTRATOR,
            authState.jwt,
            text,
            authState.conversationId,
            (id) => (authState.conversationId = id),
          )) {
            deltas += 1;
            controller.enqueue(delta);
          }
          console.log(`[jarvis] orchestrator stream done; ${deltas} delta(s)`);
        } catch (e) {
          console.log(
            `[jarvis] orchestrator ERROR: ${e instanceof Error ? e.message : String(e)}`,
          );
          controller.enqueue(
            "Sorry — I hit a problem reaching your data just now. Try again in a moment.",
          );
        }
        controller.close();
      },
    });
  }
}

export default defineAgent({
  // Load the VAD model once per worker process (heavy) and reuse across jobs.
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    await ctx.connect();
    // Rooms are minted as `jarvis-<uid>-<sessionUuid>`; pull the owner uid so we only
    // accept that user's JWT off the data channel (see SessionState).
    const ownerUid =
      ctx.room.name?.match(
        /^jarvis-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      )?.[1] ?? null;
    const state = new SessionState(ownerUid);

    // Receive the user's JWT (and refreshes) over the data channel.
    ctx.room.on("dataReceived", (payload: Uint8Array) =>
      state.ingestData(payload),
    );

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      // Stub LLM — unlocks the reply pipeline so our llmNode override is actually called.
      // See BridgeLLM. Real generation goes to the orchestrator in JarvisAgent.llmNode().
      llm: new BridgeLLM(),
      stt: new deepgram.STT({
        // `nova-2-general` (not `nova-2`, which isn't a valid model id): Nova-2 is the
        // model family that honors the weighted `keywords` boost below. Nova-3 ignores
        // `keywords` in favor of unweighted `keyterm`, so it would silently drop the
        // boosts — hence we stay on Nova-2 here.
        model: "nova-2-general",
        // Boost the vocabulary Deepgram kept mis-hearing (carriers, products, names).
        keywords: [
          ["Foresters", 2],
          ["Mutual of Omaha", 2],
          ["term life", 1],
          ["whole life", 1],
          ["IUL", 2],
          ["annual premium", 1],
        ],
      }),
      // No `llm` here — JarvisAgent.llmNode() bridges to the orchestrator instead.
      tts: new elevenlabs.TTS({
        // The ElevenLabs plugin's env fallback looks for ELEVEN_API_KEY, but our Fly secret
        // is named ELEVENLABS_API_KEY — pass it explicitly so the names don't have to match
        // (otherwise `new TTS()` throws "ElevenLabs API key is required"). Deepgram's plugin
        // already reads DEEPGRAM_API_KEY, which matches our secret, so STT needs no override.
        apiKey: requireEnv("ELEVENLABS_API_KEY"),
        model: "eleven_turbo_v2_5",
      }),
      // Barge-in is on by default in AgentSession; turn-detection model is auto-wired.
    });

    // Inbound noise cancellation is env-gated (see resolveNoiseCancellation): when enabled,
    // Krisp BVC strips background HUMAN voices (a TV, other people) before VAD/STT/turn-
    // detection — the browser's generic WebRTC noiseSuppression only kills stationary noise.
    // Shipped OFF by default while we confirm the base audio path; flip with the
    // NOISE_CANCELLATION fly secret + restart (no rebuild).
    await session.start({
      agent: new JarvisAgent(state),
      room: ctx.room,
      inputOptions: {
        noiseCancellation: resolveNoiseCancellation(),
      },
    });

    // Greet immediately. Beyond being decent UX (audible confirmation the agent is live),
    // this exercises the entire OUTBOUND plane — ElevenLabs TTS synthesis + agent→client
    // media — with zero dependence on the inbound mic/STT path. If the user hears this, the
    // outbound side works and any "no response" is purely an inbound problem; if they hear
    // nothing, the media plane is broken and STT is a red herring. Not awaited: `say()`
    // enqueues speech on the session and the job stays alive until the participant leaves.
    void session.say(
      "Hey, this is Jarvis. I can hear you — go ahead and ask your question.",
    );
  },
});

// Register this file as the agent worker; LiveKit Cloud auto-dispatches it into rooms.
// `ServerOptions` is the current name (the old `WorkerOptions` is a deprecated alias).
cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
