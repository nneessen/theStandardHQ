// src/features/training-modules/components/presentations/PresentationRecorder.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_RECORDING_MS = 20 * 60 * 1000; // 20 minutes
const TIMESLICE_MS = 5000; // 5-second chunks

/** MIME type candidates in order of preference (video only — no audio-only types) */
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
] as const;

/**
 * Detect the best supported MIME type for MediaRecorder.
 * Pure function — deterministic per browser, safe to memoize.
 */
function detectSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

interface PresentationRecorderProps {
  onRecordingComplete: (
    blob: Blob,
    mimeType: string,
    durationSeconds: number,
  ) => void;
}

export function PresentationRecorder({
  onRecordingComplete,
}: PresentationRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const [state, setState] = useState<
    "idle" | "previewing" | "recording" | "done"
  >("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const supportedMime = useMemo(detectSupportedMimeType, []);
  const supported = !!supportedMime;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24 },
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      setState("previewing");
    } catch (err) {
      const mediaErr = err as DOMException;
      if (mediaErr.name === "NotAllowedError") {
        setError(
          "Camera/microphone permission was denied. Check your browser's site settings and allow access, then try again.",
        );
      } else if (mediaErr.name === "NotFoundError") {
        setError(
          "No camera or microphone found. Please connect a device or use the Upload option instead.",
        );
      } else if (mediaErr.name === "NotReadableError") {
        setError(
          "Camera/microphone is in use by another application. Close it and try again.",
        );
      } else if (
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost"
      ) {
        setError(
          "Camera access requires a secure connection (HTTPS). Please use the Upload option instead.",
        );
      } else {
        setError(
          `Could not access camera/microphone: ${mediaErr.message || "Unknown error"}. Try the Upload option instead.`,
        );
      }
      console.error("getUserMedia error:", err);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current || !supportedMime) return;
    setMimeType(supportedMime);
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: supportedMime,
      videoBitsPerSecond: 1_500_000,
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
      // Stop camera
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    recorderRef.current = recorder;
    recorder.start(TIMESLICE_MS);
    startTimeRef.current = Date.now();
    setElapsed(0);
    setState("recording");
    intervalRef.current = setInterval(() => {
      const ms = Date.now() - startTimeRef.current;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) {
        recorder.stop();
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 500);
  }, [supportedMime]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback(() => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
    setState("idle");
  }, []);

  const confirmRecording = useCallback(() => {
    if (!recordedBlob) return;
    const durationSeconds = Math.round(elapsed / 1000);
    onRecordingComplete(recordedBlob, mimeType, durationSeconds);
  }, [recordedBlob, elapsed, mimeType, onRecordingComplete]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (!supported) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-v2-ink-muted">
          Browser recording is not supported. Please use the upload option
          instead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Video preview / playback */}
      <div className="rounded-lg overflow-hidden border border-v2-ring dark:border-v2-ring-strong bg-black">
        {state === "done" && recordedUrl ? (
          <video src={recordedUrl} controls className="w-full aspect-video" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-video"
          />
        )}
      </div>

      {/* Timer */}
      {(state === "recording" || state === "done") && (
        <div className="text-center">
          <span
            className={`text-sm font-mono font-medium ${state === "recording" ? "text-red-500" : "text-v2-ink-muted dark:text-v2-ink-subtle"}`}
          >
            {formatTime(elapsed)} / {formatTime(MAX_RECORDING_MS)}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {state === "idle" && (
          <Button size="sm" className="h-8 text-xs" onClick={startCamera}>
            Start Camera
          </Button>
        )}
        {state === "previewing" && (
          <Button
            size="sm"
            className="h-8 text-xs bg-red-600 hover:bg-red-700"
            onClick={startRecording}
          >
            <Circle className="h-3 w-3 mr-1 fill-current" />
            Start Recording
          </Button>
        )}
        {state === "recording" && (
          <Button
            size="sm"
            className="h-8 text-xs"
            variant="destructive"
            onClick={stopRecording}
          >
            <Square className="h-3 w-3 mr-1 fill-current" />
            Stop
          </Button>
        )}
        {state === "done" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={reset}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Re-record
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={confirmRecording}
            >
              Use This Recording
            </Button>
          </>
        )}
      </div>

      {error && <p className="text-[10px] text-red-500 text-center">{error}</p>}
    </div>
  );
}
