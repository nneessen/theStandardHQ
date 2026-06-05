// Jarvis realtime voice worker — LiveKit Agents entrypoint.
//
// Pipeline:  mic ─▶ Silero VAD + turn-detection ─▶ Deepgram STT ─▶ (Claude brain via
// assistant-orchestrator, using the USER's JWT) ─▶ ElevenLabs TTS ─▶ speaker, with
// barge-in. The worker runs no real model — generation is bridged to the existing
// orchestrator (src/orchestrator-bridge.ts) by overriding `JarvisAgent.llmNode()`, so all
// tools, grounding, and RLS-scoped data access are reused unchanged.
//
// SDK pinned to @livekit/agents@1.4.5. The LLM bridge lives in `llmNode()` (the node the
// AgentSession pipes STT→TTS through) rather than a custom `llm.LLM`/`LLMStream`, because
// in 1.x `LLMStream` is an abstract class with no public text-stream adapter — overriding
// `llmNode` to return a `ReadableStream<string>` is the idiomatic, type-clean bridge.
// IMPORTANT: the session must STILL be handed an `llm` (see BridgeLLM) — in 1.4.5 the reply
// pipeline short-circuits when `this.llm === undefined` (it returns before ever calling
// `llmNode`), so a stub LLM is required to unlock the pipeline that then invokes our
// override. The orchestrator bridge + the JWT / data-channel flow (the parts that carry the
// security model) are SDK-agnostic and final.

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
import { buildReplyStream } from "./reply-stream.js";
import { normalizeSpeechStream } from "./speech-text.js";

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
      // signature) the `sub` and reject any token that isn't this room's user. Compare
      // case-insensitively: `ownerUid` is already lowercased and UUIDs are case-
      // insensitive, so casing can never be used to evade the match.
      const sub = decodeJwtSub(msg.jwt);
      if (this.ownerUid && sub && sub.toLowerCase() !== this.ownerUid) {
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

  // Override the LLM node. The default implementation drives `this.llm` (our stub, which
  // never runs); instead we stream the orchestrator's text deltas. `override` makes any
  // signature drift across SDK bumps fail loudly. Return type unions `ChatChunk | string` to
  // match the base contract — we only ever emit `string` deltas. The stream construction +
  // barge-in-safe teardown live in buildReplyStream (see reply-stream.ts); the orchestrator
  // call is injected so cancellation aborts the in-flight fetch.
  override async llmNode(
    chatCtx: llm.ChatContext,
    _toolCtx: llm.ToolContext,
    _modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    const authState = this.authState;
    const jwt = authState.jwt;
    const text = latestUserText(chatCtx);

    // Empty-STT guard: background noise / a false VAD trigger can produce a blank transcript.
    // Calling the orchestrator with it wastes a turn (and tokens) and surfaces a scary "I hit a
    // problem" fallback. Speak a gentle reprompt straight through TTS instead — no orchestrator
    // call. Returning a fixed ReadableStream (not session.say()) keeps us on the normal reply
    // path with no re-entrancy into the session from inside llmNode.
    if (!text.trim()) {
      return new ReadableStream<string>({
        start(controller) {
          controller.enqueue(
            "Sorry, I didn't catch that — could you say it again?",
          );
          controller.close();
        },
      });
    }

    return buildReplyStream({
      jwt,
      text,
      // Wrap the orchestrator's raw token deltas in the speech-text net: strip any residual
      // markdown/symbols and spell numbers, on COMPLETE sentences (so a figure split across
      // deltas is never mangled). The orchestrator's voice prompt is the primary cleanup; this
      // guarantees it. Cancellation still flows through the injected AbortSignal.
      stream: (signal) =>
        normalizeSpeechStream(
          callOrchestrator(
            ORCHESTRATOR,
            // Non-null: buildReplyStream only invokes `stream` when `jwt` is present.
            jwt as string,
            text,
            authState.conversationId,
            (id) => (authState.conversationId = id),
            signal,
          ),
        ),
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
    // accept that user's JWT off the data channel (see SessionState). Match case-
    // insensitively (so a legit room is always recognized → no fail-open when ownerUid
    // is null) but LOWERCASE the captured uid; the JWT `sub` is lowercased at comparison
    // too, so room-name casing can never be used to slip past the owner check.
    const ownerUid =
      ctx.room.name
        ?.match(
          /^jarvis-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
        )?.[1]
        ?.toLowerCase() ?? null;
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
        // `eleven_multilingual_v2` (was `eleven_turbo_v2_5`): the turbo tier is the weakest at
        // number/word prosody and was a source of the garbled-numbers complaint. Multilingual_v2
        // is the higher-quality tier — richer, clearer enunciation, at a small latency cost the
        // owner accepted. We deliberately do NOT set `applyTextNormalization: 'on'`: numbers are
        // already spelled by the orchestrator's voice prompt (primary) + speech-text.ts (the
        // deterministic net), so enabling it would be a third, redundant number engine.
        model: "eleven_multilingual_v2",
        // Stability ~0.5 keeps the voice steady (very low stability is a known mumble/wobble
        // source); speaker boost sharpens enunciation of figures and carrier names.
        voiceSettings: {
          stability: 0.5,
          similarity_boost: 0.75,
          use_speaker_boost: true,
        },
      }),
      // Barge-in: VAD-based interruption is on by default, but the framework suppresses ALL
      // audio-activity interruptions during an AEC (echo-cancellation) warmup window that
      // RESTARTS on every agent utterance — default 3000ms (@livekit/agents
      // AgentSessionOptions.aecWarmupDuration; enforced by agent_activity's
      // shouldDiscardInputAudio + interruptByAudioActivity). At 3s, any reply shorter than ~3s
      // can never be interrupted — exactly the "can't tell Jarvis to stop talking" complaint,
      // confirmed live in the worker logs ("aec warmup active, disabling interruptions"
      // warmupDurationMs:3000). Shorten to 800ms: long enough to keep the guard against the
      // agent hearing its own first syllables echo back (the client mic also runs
      // echoCancellation), short enough to barge in almost immediately. NOT null — null removes
      // the self-interruption guard and risks the agent interrupting itself on speakers.
      aecWarmupDuration: 800,
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

    // --- Lifecycle guards: don't let an abandoned room bill idle STT/TTS minutes. ----
    // The framework does NOT auto-end the job when the human leaves, so a closed tab or a
    // dropped connection would otherwise leave this worker holding open Deepgram + ElevenLabs
    // connections until LiveKit's slow GC. In a 1:1 Jarvis room the only remote participant is
    // the user, so when remoteParticipants empties, the human is gone → end the job. The
    // client mints a fresh token and rejoins to continue, so this is safe.
    const endIfEmpty = () => {
      if (ctx.room.remoteParticipants.size === 0) {
        console.log("[jarvis] human left the room — ending job");
        ctx.shutdown("participant_left");
      }
    };
    ctx.room.on("participantDisconnected", endIfEmpty);

    // Hard backstop: even a tab that is left open (held connection, user walked away) ends
    // after a fixed ceiling so it can't bill voice minutes indefinitely. The user can rejoin
    // to start a fresh session. Cleared if the job shuts down first.
    const MAX_SESSION_MS = 30 * 60_000;
    const maxTimer = setTimeout(() => {
      console.log("[jarvis] max session duration reached — ending job");
      ctx.shutdown("max_duration");
    }, MAX_SESSION_MS);
    // Tear down both guards on shutdown so a torn-down job leaves no live timer or room
    // listener behind (ctx.shutdown is itself idempotent, but don't leave the listener able
    // to re-fire). Mirrors orchestrator-bridge.ts's removeEventListener cleanup pattern.
    ctx.addShutdownCallback(async () => {
      clearTimeout(maxTimer);
      ctx.room.off("participantDisconnected", endIfEmpty);
    });
  },
});

// Register this file as the agent worker; LiveKit Cloud auto-dispatches it into rooms.
// `ServerOptions` is the current name (the old `WorkerOptions` is a deprecated alias).
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    // Cap one job's memory so a single leaking/abandoned room is killed in isolation instead
    // of OOM-ing the whole 1GB machine and dropping EVERY concurrent room with it (the default
    // jobMemoryLimitMB is 0 = unlimited). A normal voice job uses far less; only a leak hits
    // this. Real concurrency scales HORIZONTALLY (`fly scale count N`), not by packing this box.
    jobMemoryWarnMB: 500,
    jobMemoryLimitMB: 700,
  }),
);
