// src/features/training-modules/components/presentations/PresentationMediaPlayer.tsx
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useCallback,
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
import { usePresentationSignedUrl } from "../../hooks/usePresentationSubmissions";
import {
  formatTimestamp,
  MARKER_TYPE_COLORS,
  type PresentationMarker,
} from "../../types/presentation-marker.types";

export interface MediaPlayerHandle {
  seek: (seconds: number) => void;
  pause: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface PresentationMediaPlayerProps {
  storagePath: string;
  mimeType?: string;
  markers?: PresentationMarker[];
  onTimeUpdate?: (currentTime: number) => void;
}

export const PresentationMediaPlayer = forwardRef<
  MediaPlayerHandle,
  PresentationMediaPlayerProps
>(function PresentationMediaPlayer(
  { storagePath, mimeType, markers = [], onTimeUpdate },
  ref,
) {
  const {
    data: signedUrl,
    isLoading,
    error,
  } = usePresentationSignedUrl(storagePath);

  const isAudio = mimeType?.startsWith("audio/");
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

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
        if (mediaRef.current) {
          mediaRef.current.currentTime = seconds;
          setCurrentTime(seconds);
        }
      },
      pause: () => mediaRef.current?.pause(),
      getCurrentTime: () => mediaRef.current?.currentTime ?? 0,
      getDuration: () => mediaRef.current?.duration ?? 0,
    }),
    [],
  );

  const togglePlay = useCallback(() => {
    const m = mediaRef.current;
    if (!m) return;
    if (m.paused) m.play();
    else m.pause();
  }, []);

  const skip = useCallback((delta: number) => {
    const m = mediaRef.current;
    if (!m) return;
    m.currentTime = Math.max(
      0,
      Math.min(m.duration || 0, m.currentTime + delta),
    );
  }, []);

  // Keyboard shortcuts (space / arrows) — only when player is in viewport
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        skip(-5);
      } else if (e.code === "ArrowRight") {
        skip(5);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, skip]);

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const m = mediaRef.current;
    if (!m || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const t = Math.max(0, Math.min(duration, ratio * duration));
    m.currentTime = t;
    setCurrentTime(t);
  };

  const handleScrubberHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHoverTime(Math.max(0, Math.min(duration, ratio * duration)));
  };

  const setVol = (v: number) => {
    if (mediaRef.current) {
      mediaRef.current.volume = v;
      mediaRef.current.muted = v === 0;
    }
    setVolume(v);
    setMuted(v === 0);
  };

  const setRate = (r: number) => {
    if (mediaRef.current) mediaRef.current.playbackRate = r;
    setPlaybackRate(r);
  };

  const activeMarker = useMemo(() => {
    if (!markers.length) return null;
    let active: PresentationMarker | null = null;
    for (const m of markers) {
      if (m.timestamp_seconds <= currentTime) active = m;
      else break;
    }
    return active;
  }, [markers, currentTime]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-center">
        <p className="text-xs text-zinc-500">Failed to load media</p>
      </div>
    );
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playbackRates = [0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-white to-zinc-50/80 dark:from-zinc-900 dark:to-zinc-950 shadow-sm overflow-hidden">
      {/* Hidden native element drives audio/video; we render our own UI */}
      {isAudio ? (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={signedUrl}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setCurrentTime(t);
            onTimeUpdate?.(t);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      ) : (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={signedUrl}
          preload="metadata"
          className="w-full aspect-video bg-black"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setCurrentTime(t);
            onTimeUpdate?.(t);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
        />
      )}

      {/* Active marker label */}
      {activeMarker && (
        <div className="px-4 pt-3 flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${MARKER_TYPE_COLORS[activeMarker.marker_type as keyof typeof MARKER_TYPE_COLORS]?.dot || "bg-zinc-400"}`}
          />
          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
            {activeMarker.label}
          </span>
        </div>
      )}

      {/* Scrubber with marker ticks */}
      <div className="px-4 pt-3">
        <div
          ref={scrubberRef}
          onClick={handleScrubberClick}
          onMouseMove={handleScrubberHover}
          onMouseLeave={() => setHoverTime(null)}
          className="relative h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer group"
        >
          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 h-full bg-zinc-900 dark:bg-zinc-200 rounded-full transition-[width] duration-150 ease-linear"
            style={{ width: `${progressPct}%` }}
          />

          {/* Marker ticks */}
          {duration > 0 &&
            markers.map((marker) => {
              const left = (marker.timestamp_seconds / duration) * 100;
              const colors =
                MARKER_TYPE_COLORS[
                  marker.marker_type as keyof typeof MARKER_TYPE_COLORS
                ];
              return (
                <button
                  key={marker.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mediaRef.current) {
                      mediaRef.current.currentTime = marker.timestamp_seconds;
                      setCurrentTime(marker.timestamp_seconds);
                    }
                  }}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full ${colors?.dot || "bg-zinc-400"} ring-2 ${colors?.ring || "ring-zinc-300"} hover:scale-125 transition-transform z-10`}
                  style={{ left: `${left}%` }}
                  title={`${formatTimestamp(marker.timestamp_seconds)} — ${marker.label}`}
                />
              );
            })}

          {/* Hover preview tooltip */}
          {hoverTime !== null && duration > 0 && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 pointer-events-none whitespace-nowrap"
              style={{ left: `${(hoverTime / duration) * 100}%` }}
            >
              {formatTimestamp(hoverTime)}
            </div>
          )}
        </div>
      </div>

      {/* Controls bar */}
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
          <span className="ml-2 text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
            {formatTimestamp(currentTime)}
            <span className="text-zinc-400 dark:text-zinc-600">
              {" "}
              / {formatTimestamp(duration)}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Playback rate */}
          <select
            value={playbackRate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="h-7 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 text-zinc-700 dark:text-zinc-300 font-mono"
            title="Playback speed"
          >
            {playbackRates.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>

          {/* Volume */}
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
              className="w-16 h-1 accent-zinc-700 dark:accent-zinc-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
