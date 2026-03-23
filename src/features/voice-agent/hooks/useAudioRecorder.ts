// src/features/voice-agent/hooks/useAudioRecorder.ts
// Audio-only MediaRecorder hook for voice clone segment recording.

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

const MAX_DURATION_SECONDS = 600; // 10-minute segment limit

function detectSupportedAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of AUDIO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export type AudioRecorderState =
  | "idle"
  | "requesting"
  | "ready"
  | "recording"
  | "done"
  | "error";

export interface UseAudioRecorderReturn {
  /** Current state of the recorder */
  state: AudioRecorderState;
  /** Seconds elapsed since recording started */
  elapsed: number;
  /** The recorded audio Blob (available in "done" state) */
  recordedBlob: Blob | null;
  /** Object URL for <audio> playback (available in "done" state) */
  recordedUrl: string | null;
  /** The MIME type used for recording */
  mimeType: string;
  /** Error message if state is "error" */
  error: string | null;
  /** Whether the browser supports audio recording */
  isSupported: boolean;
  /** Request microphone permission — transitions idle→requesting→ready */
  requestMicrophone: () => Promise<void>;
  /** Start recording — transitions ready→recording */
  startRecording: () => void;
  /** Stop recording — transitions recording→done */
  stopRecording: () => void;
  /** Clear recorded blob/URL, return to "ready" (keeps microphone stream) */
  reset: () => void;
  /** Full teardown — stops stream tracks, releases all resources */
  cleanup: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<AudioRecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const supportedMime = useMemo(detectSupportedAudioMime, []);
  const isSupported = !!supportedMime;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const requestMicrophone = useCallback(async () => {
    if (streamRef.current) {
      setState("ready");
      return;
    }

    setState("requesting");
    setError(null);

    try {
      if (!isSupported) {
        throw new Error("Browser does not support audio recording.");
      }

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          location.protocol === "https:" || location.hostname === "localhost"
            ? "Microphone access is not available in this browser."
            : "Microphone requires HTTPS. Please use a secure connection.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = stream;
      setState("ready");
    } catch (err) {
      const msg =
        err instanceof DOMException
          ? err.name === "NotAllowedError"
            ? "Microphone permission denied. Please allow access in browser settings."
            : err.name === "NotFoundError"
              ? "No microphone found. Please connect a microphone."
              : err.name === "NotReadableError"
                ? "Microphone is in use by another application."
                : err.message
          : err instanceof Error
            ? err.message
            : "Failed to access microphone.";
      setError(msg);
      setState("error");
    }
  }, [isSupported]);

  const startRecording = useCallback(() => {
    if (!streamRef.current || !supportedMime) return;

    // Clear previous recording
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    chunksRef.current = [];

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: supportedMime,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: supportedMime });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setRecordedBlob(blob);
      setRecordedUrl(url);
      setState("done");

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    recorder.start(1000); // 1s timeslice for progressive data
    recorderRef.current = recorder;
    startTimeRef.current = Date.now();
    setElapsed(0);
    setState("recording");

    // Elapsed time ticker + auto-stop at max duration
    intervalRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= MAX_DURATION_SECONDS) {
        recorder.stop();
      }
    }, 1000);
  }, [supportedMime]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
    setError(null);
    chunksRef.current = [];

    // Return to "ready" if stream still active, otherwise "idle"
    if (streamRef.current && streamRef.current.active) {
      setState("ready");
    } else {
      streamRef.current = null;
      setState("idle");
    }
  }, []);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
    setError(null);
    chunksRef.current = [];
    setState("idle");
  }, []);

  return {
    state,
    elapsed,
    recordedBlob,
    recordedUrl,
    mimeType: supportedMime,
    error,
    isSupported,
    requestMicrophone,
    startRecording,
    stopRecording,
    reset,
    cleanup,
  };
}
