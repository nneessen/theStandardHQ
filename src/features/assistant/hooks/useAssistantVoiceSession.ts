import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/services/base/supabase";
import {
  supabaseAnonKey,
  supabaseFunctionsUrl,
} from "@/services/base/supabase-config";

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
}

// --- Voice-activity detection tuning (hands-free turn-taking) -------------------
const SPEECH_RMS = 0.04; // amplitude above this = speech starting
const SILENCE_RMS = 0.025; // below this = silence (hysteresis vs SPEECH_RMS)
const SILENCE_HOLD_MS = 1100; // continuous silence this long ends the utterance
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

export function useAssistantVoiceSession({
  onUtterance,
  enabled = false,
}: UseVoiceOptions) {
  const [state, setState] = useState<VoiceSessionState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const stateRef = useRef<VoiceSessionState>("idle");
  const sessionRef = useRef<VoiceSession | null>(null);
  const levelRef = useRef(0); // last mic RMS (0–1), for visualization
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const setPhase = useCallback((s: VoiceSessionState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const authToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
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
    if (s.audio) {
      s.audio.pause();
      s.audio.src = "";
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

  const playReply = useCallback(
    async (text: string): Promise<void> => {
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
      const contentType = res.headers.get("Content-Type") ?? "";
      if (!res.ok || !contentType.includes("audio")) return; // degrade silently
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const s = sessionRef.current;
      if (!s) {
        URL.revokeObjectURL(url);
        return;
      }
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        s.audio = audio;
        const done = () => {
          URL.revokeObjectURL(url);
          if (s.audio === audio) s.audio = null;
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;
        void audio.play().catch(done);
      });
    },
    [authToken],
  );

  // Fires when an utterance has ended; runs STT → orchestrator → TTS, then loops.
  const processUtterance = useCallback(
    async (blob: Blob, ext: string) => {
      try {
        const text = await transcribe(blob, ext);
        if (!text || !sessionRef.current) return resumeListening();
        const reply = await onUtteranceRef.current(text);
        if (!sessionRef.current) return; // stopped while thinking
        if (reply && reply.trim()) {
          setPhase("speaking");
          await playReply(reply);
        }
      } catch {
        setMessage("Couldn't process that. Listening again…");
      } finally {
        resumeListening();
      }
    },
    [transcribe, playReply, resumeListening, setPhase],
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
      else if (now - s.lastVoiceAt > SILENCE_HOLD_MS) endCapture();
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

  return { state, message, available, start, stop, getFrequencyData, getLevel };
}

export type AssistantVoiceSession = ReturnType<typeof useAssistantVoiceSession>;
