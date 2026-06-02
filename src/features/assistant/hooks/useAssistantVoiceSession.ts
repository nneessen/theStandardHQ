import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/services/base/supabase";
import {
  supabaseAnonKey,
  supabaseFunctionsUrl,
} from "@/services/base/supabase-config";
import { createSpeechQueue, type SpeechQueue } from "../lib/speechQueue";

export type VoiceSessionState =
  | "idle"
  | "checking"
  | "unavailable"
  | "listening" // mic open, waiting for speech
  | "capturing" // user is speaking
  | "thinking" // transcribing + orchestrator running
  | "speaking"; // playing the spoken reply

interface UseVoiceOptions {
  /**
   * Bridge to the orchestrator. Receives the transcribed utterance, renders the
   * turn, and returns the reply text to speak (or null to stay silent). The text
   * path is fully reused — voice just feeds it transcribed speech.
   */
  onUtterance: (text: string) => Promise<string | null>;
  /** The user's voice_enabled preference; gates the on-mount availability probe. */
  enabled?: boolean;
  /**
   * How long (ms) of continuous silence ends an utterance. Defaults to
   * DEFAULT_SILENCE_HOLD_MS. Lower = snappier turn-end; too low truncates slow
   * talkers. Exposed so it can be tuned or wired to a user preference.
   */
  silenceHoldMs?: number;
}

// --- Voice-activity detection tuning (hands-free turn-taking) -------------------
const SPEECH_RMS = 0.04; // amplitude above this = speech starting
const SILENCE_RMS = 0.025; // below this = silence (hysteresis vs SPEECH_RMS)
// Continuous silence this long ends the utterance. Lowered from 1100ms — this is
// the single largest avoidable delay per voice turn (the user waits it out every
// time before STT even starts). Overridable via options.silenceHoldMs; don't go too
// low or it truncates slow/pausing talkers.
const DEFAULT_SILENCE_HOLD_MS = 800;
const MIN_UTTERANCE_MS = 350; // discard blips shorter than this (coughs, clicks)
const MIN_BLOB_BYTES = 1200; // discard near-empty recordings
const VAD_INTERVAL_MS = 60;

interface VoiceSession {
  stream: MediaStream;
  audioCtx: AudioContext;
  analyser: AnalyserNode;
  buf: Uint8Array;
  monitor: ReturnType<typeof setInterval> | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  speechStartAt: number;
  lastVoiceAt: number;
  audio: HTMLAudioElement | null;
}

function recorderExt(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

// --- Progressive (streaming) reply playback -------------------------------------
// The TTS function streams audio/mpeg as ElevenLabs synthesizes it
// (optimize_streaming_latency=3). Feeding that stream into a MediaSource lets the
// reply start speaking after the FIRST chunk arrives instead of waiting for the
// whole MP3 to download — which is what `await res.blob()` did, throwing the
// server-side streaming away. Falls back to buffered blob playback where MSE for
// MPEG isn't supported (notably Safari).
const TTS_MIME = "audio/mpeg";
const canStreamAudio =
  typeof MediaSource !== "undefined" &&
  typeof MediaSource.isTypeSupported === "function" &&
  MediaSource.isTypeSupported(TTS_MIME);

// Bound the wait for the first audio byte; if MSE setup wedges before playback
// starts, settle so the voice loop never hangs in "speaking". Does not cap a
// long-but-healthy reply — the watchdog is cleared the moment audio begins.
const FIRST_AUDIO_WATCHDOG_MS = 8000;

// Streams the audio body through a MediaSource and resolves when playback ends.
// `session.audio` is set so teardown can stop it; if the session is torn down
// mid-stream, the reader is cancelled and the promise resolves.
function playStreamingAudio(
  body: ReadableStream<Uint8Array>,
  session: VoiceSession,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    const audio = new Audio();
    session.audio = audio;

    let settled = false;
    let started = false;
    const watchdog = window.setTimeout(() => {
      if (!started) fail(new Error("first-audio timeout"));
    }, FIRST_AUDIO_WATCHDOG_MS);

    const cleanup = () => {
      window.clearTimeout(watchdog);
      URL.revokeObjectURL(url);
      if (session.audio === audio) session.audio = null;
    };
    function finish() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }
    function fail(e: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e instanceof Error ? e : new Error("stream playback failed"));
    }

    audio.onended = finish;
    // If audio never started, an element error means MSE couldn't play this stream
    // (e.g. non-frame-aligned MP3 chunks) — reject so the caller can fall back to
    // buffered playback. Once audio is flowing, a tail hiccup just ends cleanly.
    audio.onerror = () =>
      started ? finish() : fail(new Error("audio element error"));

    mediaSource.addEventListener("sourceopen", () => {
      let sb: SourceBuffer;
      try {
        sb = mediaSource.addSourceBuffer(TTS_MIME);
      } catch (e) {
        return fail(e);
      }
      const reader = body.getReader();

      const pump = async (): Promise<void> => {
        // Session was stopped while the reply was streaming.
        if (session.audio !== audio) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          return finish();
        }
        const { done, value } = await reader.read();
        if (done) {
          const close = () => {
            if (mediaSource.readyState === "open") mediaSource.endOfStream();
          };
          if (sb.updating)
            sb.addEventListener("updateend", close, { once: true });
          else close();
          return;
        }
        await new Promise<void>((res, rej) => {
          sb.addEventListener("updateend", () => res(), { once: true });
          sb.addEventListener("error", () => rej(new Error("sourcebuffer")), {
            once: true,
          });
          try {
            sb.appendBuffer(value);
          } catch (e) {
            rej(e);
          }
        });
        if (!started) {
          started = true;
          window.clearTimeout(watchdog);
          void audio.play().catch(() => {});
        }
        return pump();
      };

      pump().catch(fail);
    });

    audio.src = url; // triggers "sourceopen"
  });
}

// Buffered playback: download the whole MP3, then play. The reliable fallback for
// browsers without MSE-for-MPEG (Safari) and when streaming setup fails.
async function playBuffered(
  res: Response,
  session: VoiceSession,
): Promise<void> {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve) => {
    const audio = new Audio(url);
    session.audio = audio;
    const done = () => {
      URL.revokeObjectURL(url);
      if (session.audio === audio) session.audio = null;
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    void audio.play().catch(done);
  });
}

export function useAssistantVoiceSession({
  onUtterance,
  enabled = false,
  silenceHoldMs,
}: UseVoiceOptions) {
  const [state, setState] = useState<VoiceSessionState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const stateRef = useRef<VoiceSessionState>("idle");
  const sessionRef = useRef<VoiceSession | null>(null);
  const levelRef = useRef(0); // last mic RMS (0–1), for visualization
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  // Always-current silence-hold, read inside the VAD tick without re-creating it.
  const silenceHoldRef = useRef(silenceHoldMs ?? DEFAULT_SILENCE_HOLD_MS);
  silenceHoldRef.current = silenceHoldMs ?? DEFAULT_SILENCE_HOLD_MS;

  // --- Spoken-reply TTS queue (sentence pipeline) --------------------------------
  // A fresh queue instance is created per utterance (resetSpeech); AssistantPage
  // feeds it sentences via enqueueSpeech as the reply streams in.
  const speechQueueRef = useRef<SpeechQueue | null>(null);

  const setPhase = useCallback((s: VoiceSessionState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  // JWT cache: a voice turn calls authToken once for STT and again for EVERY TTS
  // sentence (3+ getSession() round-trips per reply). getSession() reads local
  // storage but is still async overhead on the hot path. Cache the token briefly so
  // a turn reuses it; the window is far shorter than the token's validity, and
  // getSession() auto-refreshes on the next miss, so a rotated token is picked up.
  const tokenCacheRef = useRef<{ token: string; at: number } | null>(null);
  const TOKEN_CACHE_MS = 30_000;
  const authToken = useCallback(async () => {
    const cached = tokenCacheRef.current;
    if (cached && performance.now() - cached.at < TOKEN_CACHE_MS) {
      return cached.token;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? "";
    tokenCacheRef.current = { token, at: performance.now() };
    return token;
  }, []);

  // --- Availability probe (no synthesis) so the orb reflects truth pre-click -----
  useEffect(() => {
    if (!enabled || available !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await authToken();
        const res = await fetch(`${supabaseFunctionsUrl}/assistant-voice-tts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ probe: true }),
        });
        const data = (await res.json().catch(() => null)) as {
          available?: boolean;
        } | null;
        if (!cancelled) setAvailable(data?.available === true);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, available, authToken]);

  const teardown = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (s.monitor) clearInterval(s.monitor);
    try {
      if (s.recorder && s.recorder.state !== "inactive") s.recorder.stop();
    } catch {
      /* ignore */
    }
    // Stop any queued/playing spoken reply; cancel() also releases speechIdle()
    // waiters so an in-flight drain loop exits cleanly.
    speechQueueRef.current?.cancel();
    if (s.audio) {
      s.audio.pause();
      s.audio.src = "";
      // Null it so an in-flight streaming pump sees the session ended, cancels
      // its reader, and settles (it guards on `session.audio !== audio`).
      s.audio = null;
    }
    s.stream.getTracks().forEach((t) => t.stop());
    void s.audioCtx.close().catch(() => {});
    sessionRef.current = null;
  }, []);

  const resumeListening = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return; // session was stopped mid-flight
    s.recorder = null;
    s.chunks = [];
    s.lastVoiceAt = performance.now();
    setPhase("listening");
  }, [setPhase]);

  const transcribe = useCallback(
    async (blob: Blob, ext: string): Promise<string> => {
      const token = await authToken();
      const form = new FormData();
      form.append("file", blob, `speech.${ext}`);
      const res = await fetch(`${supabaseFunctionsUrl}/assistant-voice-stt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
        body: form,
      });
      if (!res.ok) throw new Error("stt failed");
      const data = (await res.json()) as { text?: string };
      return typeof data.text === "string" ? data.text.trim() : "";
    },
    [authToken],
  );

  // Fetch TTS audio for one sentence; null if unavailable/failed.
  const fetchTts = useCallback(
    async (text: string): Promise<Response | null> => {
      try {
        const token = await authToken();
        const res = await fetch(`${supabaseFunctionsUrl}/assistant-voice-tts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });
        const ct = res.headers.get("Content-Type") ?? "";
        if (!res.ok || !ct.includes("audio")) return null;
        return res;
      } catch {
        return null;
      }
    },
    [authToken],
  );

  // Play one already-fetched TTS response: streaming MSE first, blob fallback if
  // MSE can't play the stream (never goes silently mute).
  const playAudioResponse = useCallback(
    async (res: Response): Promise<void> => {
      const s = sessionRef.current;
      if (!s) return;
      if (canStreamAudio && res.body) {
        const fallback = res.clone();
        try {
          await playStreamingAudio(res.body, s);
          return;
        } catch {
          if (!sessionRef.current) return;
          await playBuffered(fallback, s);
          return;
        }
      }
      await playBuffered(res, s);
    },
    [],
  );

  // A fresh ordered/double-buffered queue per utterance (cancel() permanently
  // kills an instance, so resetSpeech() makes a new one). Logic + ordering live
  // in the unit-tested createSpeechQueue module.
  const resetSpeech = useCallback(() => {
    speechQueueRef.current = createSpeechQueue<Response>({
      fetchAudio: fetchTts,
      playAudio: playAudioResponse,
      onActive: () => setPhase("speaking"),
      isAlive: () => !!sessionRef.current,
    });
  }, [fetchTts, playAudioResponse, setPhase]);

  const enqueueSpeech = useCallback((sentence: string) => {
    speechQueueRef.current?.enqueue(sentence);
  }, []);

  const finishSpeech = useCallback(() => {
    speechQueueRef.current?.finish();
  }, []);

  const cancelSpeech = useCallback(() => {
    speechQueueRef.current?.cancel();
    // Stop the currently-playing element too, for an immediate barge-in.
    const s = sessionRef.current;
    if (s?.audio) {
      s.audio.pause();
      s.audio.src = "";
      s.audio = null;
    }
  }, []);

  // Resolves once the queue is drained and finishSpeech() has been signalled, so
  // the voice loop doesn't reopen the mic mid-reply.
  const speechIdle = useCallback(
    (): Promise<void> => speechQueueRef.current?.idle() ?? Promise.resolve(),
    [],
  );

  // Fires when an utterance has ended; runs STT → orchestrator → TTS, then loops.
  const processUtterance = useCallback(
    async (blob: Blob, ext: string) => {
      try {
        const text = await transcribe(blob, ext);
        if (!text || !sessionRef.current) return resumeListening();
        resetSpeech(); // fresh speech state for this turn
        // onUtterance streams the reply and feeds sentences to the TTS queue via
        // enqueueSpeech/finishSpeech, then awaits speechIdle() internally — so by
        // the time it resolves, the spoken reply has finished playing.
        await onUtteranceRef.current(text);
      } catch {
        setMessage("Couldn't process that. Listening again…");
      } finally {
        resumeListening();
      }
    },
    [transcribe, resumeListening, resetSpeech],
  );

  const beginCapture = useCallback(
    (now: number) => {
      const s = sessionRef.current;
      if (!s) return;
      s.speechStartAt = now;
      s.lastVoiceAt = now;
      s.chunks = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(s.stream);
      } catch {
        return;
      }
      s.recorder = recorder;
      const ext = recorderExt(recorder.mimeType || "");
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) s.chunks.push(e.data);
      };
      recorder.onstop = () => {
        const cur = sessionRef.current;
        if (!cur) return;
        const dur = performance.now() - cur.speechStartAt;
        const blob = new Blob(cur.chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        if (dur < MIN_UTTERANCE_MS || blob.size < MIN_BLOB_BYTES) {
          return resumeListening();
        }
        void processUtterance(blob, ext);
      };
      recorder.start();
      setPhase("capturing");
    },
    [processUtterance, resumeListening, setPhase],
  );

  const endCapture = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    setPhase("thinking"); // freeze the VAD loop while we process
    try {
      if (s.recorder && s.recorder.state !== "inactive") s.recorder.stop();
    } catch {
      resumeListening();
    }
  }, [setPhase, resumeListening]);

  const tick = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    s.analyser.getByteTimeDomainData(s.buf);
    let sum = 0;
    for (let i = 0; i < s.buf.length; i++) {
      const x = (s.buf[i] - 128) / 128;
      sum += x * x;
    }
    const rms = Math.sqrt(sum / s.buf.length);
    levelRef.current = rms;
    const now = performance.now();
    const phase = stateRef.current;
    if (phase === "listening") {
      if (rms > SPEECH_RMS) beginCapture(now);
    } else if (phase === "capturing") {
      if (rms > SILENCE_RMS) s.lastVoiceAt = now;
      else if (now - s.lastVoiceAt > silenceHoldRef.current) endCapture();
    }
  }, [beginCapture, endCapture]);

  const start = useCallback(async () => {
    if (stateRef.current !== "idle" && stateRef.current !== "unavailable")
      return;
    setMessage(null);
    setPhase("checking");

    const supportsMedia =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined";
    const AudioCtx =
      typeof window !== "undefined"
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
        : undefined;
    if (!supportsMedia || !AudioCtx) {
      setAvailable(false);
      setMessage("This browser can't run voice. Use Chrome or Safari.");
      setPhase("unavailable");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setMessage("Microphone access is needed for voice.");
      setPhase("unavailable");
      return;
    }

    const audioCtx = new AudioCtx();
    const sourceNode = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode.connect(analyser);

    const session: VoiceSession = {
      stream,
      audioCtx,
      analyser,
      buf: new Uint8Array(analyser.fftSize),
      monitor: null,
      recorder: null,
      chunks: [],
      speechStartAt: 0,
      lastVoiceAt: performance.now(),
      audio: null,
    };
    sessionRef.current = session;
    setAvailable(true);
    setPhase("listening");
    session.monitor = setInterval(tick, VAD_INTERVAL_MS);
  }, [setPhase, tick]);

  const stop = useCallback(() => {
    teardown();
    setMessage(null);
    setPhase("idle");
  }, [teardown, setPhase]);

  // Clean up on unmount.
  useEffect(() => () => teardown(), [teardown]);

  // --- Visualization accessors (read-only; do not affect the VAD loop) -----------
  // Fills `out` with byte frequency data from the live mic analyser; returns false
  // when no session is active so callers can fall back to a synthetic animation.
  const getFrequencyData = useCallback((out: Uint8Array): boolean => {
    const s = sessionRef.current;
    if (!s) return false;
    s.analyser.getByteFrequencyData(out);
    return true;
  }, []);

  // Last measured mic RMS amplitude (0–1).
  const getLevel = useCallback((): number => levelRef.current, []);

  return {
    state,
    message,
    available,
    start,
    stop,
    getFrequencyData,
    getLevel,
    // Spoken-reply pipeline (driven by AssistantPage as the reply streams in).
    enqueueSpeech,
    finishSpeech,
    cancelSpeech,
    speechIdle,
  };
}

export type AssistantVoiceSession = ReturnType<typeof useAssistantVoiceSession>;
