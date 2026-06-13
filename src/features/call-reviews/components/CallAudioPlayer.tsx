// src/features/call-reviews/components/CallAudioPlayer.tsx
// Audio player for a call recording: play/pause/skip, a scrub bar with marker
// ticks + hover preview, playback-rate, volume, and keyboard shortcuts. Exposes
// an imperative handle so the transcript + markers panels can seek/pause and
// read the current time. Modeled on the training-modules PresentationMediaPlayer
// but audio-only and driven by the call-marker shape (start_seconds).

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CALL_MARKER_COLORS,
  formatClock,
  isCallMarkerType,
  type CallMarkerRow,
} from "../types";

export interface CallPlayerHandle {
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface CallAudioPlayerProps {
  signedUrl: string | null;
  isLoading: boolean;
  error: boolean;
  markers: CallMarkerRow[];
  onTimeUpdate?: (currentTime: number) => void;
  /** Fired when playback starts (every play). The parent decides what to do with
   *  it (e.g. record a once-per-session "listened" marker). */
  onPlay?: () => void;
  /** Audio was purged by the retention policy; show a transcript-only notice. */
  audioExpired?: boolean;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

export const CallAudioPlayer = forwardRef<
  CallPlayerHandle,
  CallAudioPlayerProps
>(function CallAudioPlayer(
  { signedUrl, isLoading, error, markers, onTimeUpdate, onPlay, audioExpired },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  useImperativeHandle(
    ref,
    () => ({
      seek: (seconds: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = seconds;
          setCurrentTime(seconds);
        }
      },
      play: () => void audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
      getCurrentTime: () => audioRef.current?.currentTime ?? 0,
      getDuration: () => audioRef.current?.duration ?? 0,
    }),
    [],
  );

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, []);

  const skip = useCallback((delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(
      0,
      Math.min(a.duration || 0, a.currentTime + delta),
    );
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") skip(-5);
      else if (e.code === "ArrowRight") skip(5);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, skip]);

  const seekFromClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const t = Math.max(0, Math.min(duration, ratio * duration));
    a.currentTime = t;
    setCurrentTime(t);
  };

  const setVol = (v: number) => {
    if (audioRef.current) {
      audioRef.current.volume = v;
      audioRef.current.muted = v === 0;
    }
    setVolume(v);
    setMuted(v === 0);
  };

  const setRate = (r: number) => {
    if (audioRef.current) audioRef.current.playbackRate = r;
    setPlaybackRate(r);
  };

  if (audioExpired) {
    return (
      <div className="rounded-xl border border-v2-ring bg-v2-canvas p-6 text-center">
        <p className="text-xs font-medium text-v2-ink">Audio expired</p>
        <p className="mt-1 text-[11px] text-v2-ink-muted">
          This recording&apos;s audio was removed after the 180-day retention
          window. The transcript and analysis below are kept permanently.
        </p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="rounded-xl border border-v2-ring bg-gradient-to-b from-card to-muted p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }
  if (error || !signedUrl) {
    return (
      <div className="rounded-xl border border-v2-ring bg-v2-canvas p-6 text-center">
        <p className="text-xs text-v2-ink-muted">Audio unavailable</p>
      </div>
    );
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-xl border border-v2-ring bg-gradient-to-b from-card to-muted/80 shadow-sm overflow-hidden">
      <audio
        ref={audioRef}
        src={signedUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          // Streamed webm/ogg can report Infinity until fully buffered; Infinity
          // is truthy, so `|| 0` wouldn't catch it and would break scrub/markers.
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) && d > 0 ? d : 0);
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          onTimeUpdate?.(t);
        }}
        onPlay={() => {
          setIsPlaying(true);
          onPlay?.();
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Scrubber with marker ticks */}
      <div className="px-4 pt-4">
        <div
          onClick={seekFromClick}
          onMouseMove={(e) => {
            if (!duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            setHoverTime(Math.max(0, Math.min(duration, ratio * duration)));
          }}
          onMouseLeave={() => setHoverTime(null)}
          className="relative h-2 bg-muted rounded-full cursor-pointer"
        >
          <div
            className="absolute top-0 left-0 h-full bg-primary/70 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
          {duration > 0 &&
            markers.map((m) => {
              const left = (m.start_seconds / duration) * 100;
              const colors = isCallMarkerType(m.marker_type)
                ? CALL_MARKER_COLORS[m.marker_type]
                : CALL_MARKER_COLORS.chapter;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (audioRef.current) {
                      audioRef.current.currentTime = m.start_seconds;
                      setCurrentTime(m.start_seconds);
                    }
                  }}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full ${colors.dot} ring-2 ${colors.ring} hover:scale-125 transition-transform z-10`}
                  style={{ left: `${left}%` }}
                  title={`${formatClock(m.start_seconds)} — ${m.label}`}
                />
              );
            })}
          {hoverTime !== null && duration > 0 && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-card-foreground pointer-events-none whitespace-nowrap"
              style={{ left: `${(hoverTime / duration) * 100}%` }}
            >
              {formatClock(hoverTime)}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => skip(-10)}
            title="Back 10s"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => skip(10)}
            title="Forward 10s"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
          <span className="ml-2 text-[11px] font-mono tabular-nums text-v2-ink-muted">
            {formatClock(currentTime)}
            <span className="text-v2-ink-subtle">
              {" "}
              / {formatClock(duration)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={playbackRate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="h-7 text-[11px] rounded border border-v2-ring bg-v2-card px-1.5 text-v2-ink font-mono"
            title="Playback speed"
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setVol(muted ? 1 : 0)}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(parseFloat(e.target.value))}
              className="w-16 h-1 accent-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
