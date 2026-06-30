// src/features/social-studio/components/ReelClipCard.tsx
// Presentational card for a single reel clip: video preview + download button.

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReelClip } from "@/types/reel.types";

interface ReelClipCardProps {
  clip: ReelClip;
  onDownload: (clip: ReelClip) => void;
  downloading?: boolean;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ReelClipCard({
  clip,
  onDownload,
  downloading,
}: ReelClipCardProps) {
  const duration = formatDuration(clip.duration_ms);

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/40 p-2">
      {/* Video preview — vertical aspect, capped height */}
      <div className="relative overflow-hidden rounded bg-black">
        <video
          controls
          src={clip.source_url ?? undefined}
          preload="metadata"
          className="mx-auto max-h-64 w-full object-contain"
          aria-label={clip.title ?? "Reel clip"}
        />
      </div>

      {/* Metadata row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {clip.title && (
            <p
              className="truncate text-xs font-medium text-foreground"
              title={clip.title}
            >
              {clip.title}
            </p>
          )}
          <div className="mt-0.5 flex items-center gap-2">
            {clip.viral_score != null && (
              <span className="rounded-full bg-orange-500/15 px-1.5 py-0 text-[9px] font-semibold text-orange-500">
                🔥 {clip.viral_score.toFixed(1)}
              </span>
            )}
            {duration && (
              <span className="text-[10px] text-muted-foreground">
                {duration}
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={downloading}
          onClick={() => onDownload(clip)}
          className="h-7 flex-none px-2 text-[11px]"
          title="Download this clip as an MP4"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {downloading ? "…" : "Download"}
        </Button>
      </div>
    </div>
  );
}
