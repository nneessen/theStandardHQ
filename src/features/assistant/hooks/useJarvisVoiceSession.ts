import { useCallback, useEffect, useRef, useState } from "react";
import {
  ParticipantKind,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
} from "livekit-client";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import {
  supabaseAnonKey,
  supabaseFunctionsUrl,
} from "@/services/base/supabase-config";
import type { VoiceSessionState, VoiceSessionUi } from "./voiceSession.types";

// ─────────────────────────────────────────────────────────────────────────────
// Realtime voice session — LiveKit transport.
//
// Unlike the legacy hook, this does NO STT/TTS in the browser. The persistent LiveKit
// Agents worker runs the whole pipeline (Deepgram STT → Claude orchestrator → ElevenLabs
// TTS) and the browser only: (1) mints a room token, (2) joins + publishes the mic,
// (3) hands the worker the user's Supabase JWT over the data channel (so the brain stays
// RLS-scoped), and (4) plays the agent's audio track. Turn-taking, endpointing, and
// barge-in are all server-side.
//
// SECURITY-CRITICAL: the JWT is published `reliable` and ADDRESSED TO THE AGENT IDENTITY
// ONLY (publishData defaults to an unaddressed broadcast). It is re-sent on every Supabase
// token refresh (a voice session can outlive the ~1h JWT) and re-sent a bounded number of
// times right after join to defeat the worker-handler registration race.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_ENDPOINT = `${supabaseFunctionsUrl}/assistant-voice-livekit-token`;

// @livekit/agents publishes the agent's lifecycle state on this participant attribute
// (values: "initializing" | "listening" | "thinking" | "speaking"). Verified against the
// installed @livekit/agents@1.4.5.
const AGENT_STATE_ATTR = "lk.agent.state";

// Join-race hardening: the worker registers its `dataReceived` handler AFTER it connects
// to the room, so a JWT published the instant the agent participant appears can be dropped
// (reliable delivery only covers receivers whose handler is attached at receive time).
// Re-send a few times until the agent leaves "initializing" (proof it is processing).
const AUTH_RESEND_INTERVAL_MS = 1200;
const AUTH_RESEND_MAX_TRIES = 8;

// How long after start() the session has to reach a real "listening"/"speaking" state before
// we tell the user voice is down. Covers BOTH the worker never joining AND the worker joining
// but never publishing a ready state (crash mid-init / lost attribute) — without this watchdog
// the UI could hang on "CONNECTING" forever. Cleared the moment a real state arrives.
// 25s (was 12s): the Fly worker is a single resident machine that is NOT kept warm on this
// path, so a fresh job's first dispatch (machine wake + model load + Deepgram/ElevenLabs +
// LiveKit registration + the greeting) can legitimately exceed 12s and was being killed as
// "didn't finish connecting" before it ever became ready. The overlay now shows honest
// "waking…" progress during this window and, on timeout, surfaces a Retry instead of vanishing.
const AGENT_READY_TIMEOUT_MS = 25000;

function isAgent(p: Participant): boolean {
  return p.kind === ParticipantKind.AGENT;
}

function mapAgentState(s: string | undefined): VoiceSessionState {
  switch (s) {
    case "listening":
      return "listening";
    case "thinking":
      return "thinking";
    case "speaking":
      return "speaking";
    case "initializing":
      return "checking";
    default:
      // Agent present but it hasn't published a real state yet (the attribute lands a beat
      // after the participant connects). Stay "checking" — NOT "listening" — so the UI never
      // tells the user "go ahead" before the worker's STT is actually up. A real "listening"
      // arrives once the agent is ready (after the greeting) and flips us forward; the
      // readiness watchdog (AGENT_READY_TIMEOUT_MS) catches a worker that joins but never
      // becomes ready, so the UI can't hang on "CONNECTING" forever.
      return "checking";
  }
}

interface UseRealtimeVoiceOptions {
  /** The user's voice_enabled preference; gates the on-mount availability probe. */
  enabled?: boolean;
}

export function useJarvisVoiceSession({
  enabled = false,
}: UseRealtimeVoiceOptions = {}): VoiceSessionUi {
  const [state, setState] = useState<VoiceSessionState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const stateRef = useRef<VoiceSessionState>("idle");
  const setPhase = useCallback((s: VoiceSessionState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  // Surface a start()/connect failure so the user actually sees WHY voice didn't start. The
  // immersion unmounts the instant we go "unavailable", taking its inline message with it — so
  // historically every failure looked identical: the voice screen just vanished, no console
  // error (the connect/mic catches are silent), no visible reason ("the screen just disappeared
  // instantly"). A sonner toast renders at the app root and survives the unmount, so the user
  // finally sees the specific reason. Failure mechanism reproduced via scripts/voice-repro.py
  // (DENY_MIC=1 → screen vanishes with no message).
  const fail = useCallback(
    (msg: string) => {
      setMessage(msg);
      setPhase("unavailable");
      toast.error(msg, { duration: 7000 });
    },
    [setPhase],
  );

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // The agent audio track currently attached to audioElRef — so a republished track
  // (after an internal reconnect) detaches the stale one instead of the live one.
  const agentTrackRef = useRef<RemoteTrack | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const tdBufRef = useRef<Uint8Array | null>(null);

  const agentIdentityRef = useRef<string | null>(null);
  const agentActiveRef = useRef(false); // agent has left "initializing"
  const authTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authUnsubRef = useRef<(() => void) | null>(null);

  // --- token ---------------------------------------------------------------------
  const accessToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  // --- JWT hand-off to the agent (addressed; never broadcast) ---------------------
  const publishAuthToAgent = useCallback(async () => {
    const room = roomRef.current;
    const agentId = agentIdentityRef.current;
    if (!room || !agentId) return;
    const jwt = await accessToken();
    if (!jwt) return;
    const payload = new TextEncoder().encode(
      JSON.stringify({ type: "auth", jwt }),
    );
    try {
      await room.localParticipant.publishData(payload, {
        reliable: true,
        destinationIdentities: [agentId], // ← agent ONLY; not a broadcast
      });
    } catch {
      /* best-effort; the resend loop / token-refresh will retry */
    }
  }, [accessToken]);

  const stopAuthResend = useCallback(() => {
    if (authTimerRef.current) {
      clearInterval(authTimerRef.current);
      authTimerRef.current = null;
    }
  }, []);

  // Re-send the JWT until the agent is processing (defeats the handler-registration race).
  const startAuthResend = useCallback(() => {
    stopAuthResend();
    let tries = 0;
    authTimerRef.current = setInterval(() => {
      tries += 1;
      if (agentActiveRef.current || tries >= AUTH_RESEND_MAX_TRIES) {
        stopAuthResend();
        return;
      }
      void publishAuthToAgent();
    }, AUTH_RESEND_INTERVAL_MS);
  }, [publishAuthToAgent, stopAuthResend]);

  // --- mic analyser (mic-only; the agent's audio plays via a media element) -------
  const setupMicAnalyser = useCallback((room: Room) => {
    try {
      const pub = room.localParticipant.getTrackPublication(
        Track.Source.Microphone,
      );
      const mst = pub?.track?.mediaStreamTrack;
      if (!mst) return;
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      // Created after the connect/mic awaits, so it's outside the click gesture and
      // Chrome boots it "suspended" — a suspended context never processes the graph,
      // so the analyser would read flat silence and the visualizer would stay dead.
      // Resume best-effort (no-op where already running, e.g. Safari).
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(new MediaStream([mst]));
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      audioCtxRef.current = ctx;
      analyserRef.current = an;
      tdBufRef.current = new Uint8Array(an.fftSize);
    } catch {
      /* visualization is non-essential; never block the session on it */
    }
  }, []);

  // --- agent discovery + state ----------------------------------------------------
  const applyAgentState = useCallback(
    (raw: string | undefined) => {
      if (raw && raw !== "initializing") {
        agentActiveRef.current = true;
        stopAuthResend();
        // A real ready state arrived → cancel the readiness watchdog.
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
      }
      // Don't clobber a terminal idle/unavailable phase with a late attribute event.
      if (stateRef.current === "idle" || stateRef.current === "unavailable") {
        return;
      }
      const next = mapAgentState(raw);
      // Never regress a live session back to "checking" on a missing/unknown attribute — once
      // the agent has been ready, an empty/garbage value is noise, not a reset to "connecting".
      if (next === "checking" && stateRef.current !== "checking") {
        return;
      }
      setPhase(next);
    },
    [setPhase, stopAuthResend],
  );

  const onAgentAvailable = useCallback(
    (agent: Participant) => {
      // NOTE: do NOT clear the readiness watchdog here — the agent JOINING isn't readiness, it
      // may still be initializing. applyAgentState clears the watchdog once a real
      // "listening"/"speaking" state arrives; until then it still guards a joined-but-never-
      // ready hang (the bug where the UI sat on "CONNECTING" forever).
      agentIdentityRef.current = agent.identity;
      applyAgentState(agent.attributes?.[AGENT_STATE_ATTR]);
      void publishAuthToAgent();
      startAuthResend();
    },
    [applyAgentState, publishAuthToAgent, startAuthResend],
  );

  const findAgent = useCallback((room: Room): RemoteParticipant | null => {
    for (const p of room.remoteParticipants.values()) {
      if (isAgent(p)) return p;
    }
    return null;
  }, []);

  // --- teardown -------------------------------------------------------------------
  const teardown = useCallback(() => {
    stopAuthResend();
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    if (authUnsubRef.current) {
      authUnsubRef.current();
      authUnsubRef.current = null;
    }
    const el = audioElRef.current;
    if (el) {
      el.pause();
      el.srcObject = null;
      el.remove();
      audioElRef.current = null;
    }
    const ctx = audioCtxRef.current;
    if (ctx) {
      void ctx.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    tdBufRef.current = null;
    agentIdentityRef.current = null;
    agentActiveRef.current = false;
    agentTrackRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      // Remove OUR listeners BEFORE disconnect. `disconnect()` is async and emits
      // RoomEvent.Disconnected on a later tick — if our handler were still attached it
      // would run setPhase("idle") AFTER this teardown, clobbering the "unavailable"
      // phase set by the mic-deny / join-timeout error paths and firing setState on an
      // unmounted component. A SERVER-initiated drop still reaches the handler because
      // teardown hasn't run yet in that case. We own this Room instance, so removing all
      // listeners is safe.
      room.removeAllListeners();
      void room.disconnect().catch(() => {});
    }
  }, [stopAuthResend]);

  // --- availability probe (does NOT prove LiveKit creds; only that the fn is live) -
  useEffect(() => {
    if (!enabled || available !== null) return;
    let cancelled = false;
    (async () => {
      try {
        // The gateway enforces verify_jwt on this function, so the warm ping needs the
        // user's Bearer token even though the warm short-circuit runs before app-level
        // auth — apikey alone returns 401 and would falsely mark voice unavailable.
        const jwt = await accessToken();
        const res = await fetch(`${TOKEN_ENDPOINT}?warm=1`, {
          method: "POST",
          headers: {
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
            apikey: supabaseAnonKey,
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        if (!cancelled) setAvailable(res.ok);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, available, accessToken]);

  // --- event wiring ---------------------------------------------------------------
  const wireEvents = useCallback(
    (room: Room) => {
      room
        .on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _pub, participant) => {
            if (track.kind !== Track.Kind.Audio || !isAgent(participant))
              return;
            let el = audioElRef.current;
            if (!el) {
              el = document.createElement("audio");
              el.autoplay = true;
              // iOS Safari needs this to play in-page rather than fullscreen.
              (el as HTMLAudioElement & { playsInline: boolean }).playsInline =
                true;
              el.style.display = "none";
              document.body.appendChild(el);
              audioElRef.current = el;
            }
            // Detach any previously-attached agent track first: if the agent republishes
            // its track (LiveKit internal reconnect), the OLD track still references `el`,
            // and its later TrackUnsubscribed would otherwise detach the live one.
            if (agentTrackRef.current && agentTrackRef.current !== track) {
              agentTrackRef.current.detach(el);
            }
            agentTrackRef.current = track;
            track.attach(el);
            void el.play().catch(() => {
              // Autoplay blocked — startAudio() + the playback-status handler recover it.
            });
          },
        )
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          // Only detach if THIS is the live track (a stale republished track's
          // unsubscribe must not yank the element from the current one).
          if (audioElRef.current && track === agentTrackRef.current) {
            track.detach(audioElRef.current);
            agentTrackRef.current = null;
          }
        })
        .on(
          RoomEvent.ParticipantConnected,
          (participant: RemoteParticipant) => {
            if (isAgent(participant)) onAgentAvailable(participant);
          },
        )
        .on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
          if (isAgent(participant)) {
            applyAgentState(participant.attributes?.[AGENT_STATE_ATTR]);
          }
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (!roomRef.current) return;
          if (!roomRef.current.canPlaybackAudio) {
            setMessage("Tap to enable audio.");
          } else {
            setMessage((m) => (m === "Tap to enable audio." ? null : m));
          }
        })
        .on(RoomEvent.Disconnected, () => {
          // Reaching here means an UNEXPECTED, server-initiated drop: LiveKit handles transient
          // reconnects internally, and our own stop()/teardown removes these listeners BEFORE
          // calling room.disconnect() — so a user-initiated end never fires this. Routing it to
          // the persistent error view (Try again / Use text) instead of setPhase("idle") is the
          // OTHER half of the "waves screen vanishes" fix: "idle" is not in VoiceImmersion's
          // active set, so dropping to it would unmount the overlay and silently dump the user
          // back on the Command Center — exactly the original complaint. fail() keeps the overlay
          // up with a reason + a one-tap reconnect.
          teardown();
          fail("Connection dropped. Tap Try again to reconnect.");
        });
    },
    [applyAgentState, fail, onAgentAvailable, teardown],
  );

  // --- start / stop ---------------------------------------------------------------
  const start = useCallback(async () => {
    if (stateRef.current !== "idle" && stateRef.current !== "unavailable")
      return;
    setMessage(null);
    setPhase("checking");

    const jwt = await accessToken();
    if (!jwt) {
      fail("Please sign in again to use voice.");
      return;
    }

    // 1. Mint a room token.
    let url: string;
    let token: string;
    try {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!res.ok) throw new Error(`token ${res.status}`);
      const data = (await res.json()) as { token?: string; url?: string };
      if (!data.token || !data.url) throw new Error("token payload");
      url = data.url;
      token = data.token;
    } catch {
      setAvailable(false);
      fail("Voice isn't available right now. Text chat still works.");
      return;
    }

    // 2. Join the room.
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    wireEvents(room);
    try {
      await room.connect(url, token);
    } catch {
      teardown();
      fail("Couldn't connect to voice. Try again.");
      return;
    }

    // 3. Publish the mic (prompts for permission). Explicit echoCancellation so the agent's own
    //    TTS played on the user's speakers isn't captured by the mic and mistaken for the user
    //    speaking — that would self-interrupt the agent now that the worker's AEC warmup window
    //    is short (aecWarmupDuration). noiseSuppression/autoGainControl match LiveKit's defaults;
    //    set explicitly so the capture behavior can't silently change under us.
    try {
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
    } catch {
      teardown();
      fail("Microphone access is needed for voice.");
      return;
    }
    setupMicAnalyser(room);

    // 4. Resume audio playout inside the click gesture (best-effort; the
    //    AudioPlaybackStatusChanged handler is the fallback if the browser blocks it).
    try {
      await room.startAudio();
    } catch {
      /* handled by the playback-status event */
    }

    // 5. Re-send the JWT on every Supabase token refresh (sessions outlive a ~1h JWT).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        void publishAuthToAgent();
      }
    });
    authUnsubRef.current = () => sub.subscription.unsubscribe();

    setAvailable(true);

    // 6. Arm the readiness watchdog, THEN wire up the agent (it may already be in the room or
    //    join momentarily). The watchdog fires only if the session is still "checking" at the
    //    deadline — covering BOTH "worker never dispatched" AND "worker joined but never became
    //    ready". applyAgentState clears it the instant a real "listening"/"speaking" arrives, so
    //    a healthy session never trips it.
    joinTimeoutRef.current = setTimeout(() => {
      if (stateRef.current === "checking" && roomRef.current) {
        teardown();
        fail("Jarvis didn't finish connecting. Try again, or use text.");
      }
    }, AGENT_READY_TIMEOUT_MS);

    const agent = findAgent(room);
    if (agent) onAgentAvailable(agent);
  }, [
    accessToken,
    fail,
    findAgent,
    onAgentAvailable,
    publishAuthToAgent,
    setPhase,
    setupMicAnalyser,
    teardown,
    wireEvents,
  ]);

  const stop = useCallback(() => {
    teardown();
    setMessage(null);
    setPhase("idle");
  }, [teardown, setPhase]);

  // Recover playout when the browser blocked autoplay. The immersion's audio-blocked banner
  // taps THIS — never stop() — so "Tap to enable audio" no longer ends the session. Best-effort:
  // startAudio() must run inside the click gesture, which this is.
  const resumeAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      await audioElRef.current?.play().catch(() => {});
      if (room.canPlaybackAudio) {
        setMessage((m) => (m === "Tap to enable audio." ? null : m));
      }
    } catch {
      /* the AudioPlaybackStatusChanged handler keeps the banner up if this fails */
    }
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  // --- visualization accessors (mic-only) -----------------------------------------
  const getFrequencyData = useCallback((out: Uint8Array): boolean => {
    const an = analyserRef.current;
    if (!an) return false;
    an.getByteFrequencyData(out);
    return true;
  }, []);

  const getLevel = useCallback((): number => {
    const an = analyserRef.current;
    const buf = tdBufRef.current;
    if (!an || !buf) return 0;
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = (buf[i] - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / buf.length);
  }, []);

  return {
    state,
    message,
    available,
    start,
    stop,
    resumeAudio,
    getFrequencyData,
    getLevel,
  };
}
