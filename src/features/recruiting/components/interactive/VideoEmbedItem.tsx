// src/features/recruiting/components/interactive/VideoEmbedItem.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type {
  VideoEmbedMetadata,
  VideoEmbedResponse,
} from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";

interface VideoEmbedItemProps {
  progressId: string;
  metadata: VideoEmbedMetadata;
  existingResponse?: VideoEmbedResponse | null;
  isDisabled?: boolean;
  onComplete?: () => void;
}

/**
 * Get the embed URL for a video based on platform
 */
function getEmbedUrl(platform: string, videoId: string): string {
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/embed/${videoId}`;
    case "vimeo":
      return `https://player.vimeo.com/video/${videoId}`;
    case "loom":
      return `https://www.loom.com/embed/${videoId}`;
    default:
      return "";
  }
}

/**
 * Get display name for video platform
 */
function getPlatformName(platform: string): string {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "vimeo":
      return "Vimeo";
    case "loom":
      return "Loom";
    default:
      return "Video";
  }
}

export function VideoEmbedItem({
  progressId,
  metadata,
  existingResponse,
  isDisabled = false,
  onComplete,
}: VideoEmbedItemProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const embedUrl =
    metadata?.platform && metadata?.video_id
      ? getEmbedUrl(metadata.platform, metadata.video_id)
      : "";
  const platformName = metadata?.platform
    ? getPlatformName(metadata.platform)
    : "Video";

  // Defined unconditionally before any early return
  const handleMarkWatched = async () => {
    setIsSubmitting(true);
    try {
      const result = await checklistResponseService.submitVideoWatchResponse(
        progressId,
        metadata,
      );

      if (!result.success) {
        toast.error(result.error || "Failed to mark video as watched");
        return;
      }

      toast.success("Video marked as watched!");
      onComplete?.();
    } catch (error) {
      console.error("Failed to mark video as watched:", error);
      toast.error("Failed to mark video as watched");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle null/missing platform or video_id
  if (!metadata?.platform || !metadata?.video_id) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Video configuration error: Missing platform or video ID</span>
      </div>
    );
  }

  // If already watched
  if (existingResponse?.watched) {
    return (
      <div className="space-y-2">
        {/* Video embed - still show it so they can rewatch */}
        {embedUrl && (
          <div className="relative aspect-video w-full rounded overflow-hidden bg-v2-card-dark">
            <iframe
              src={embedUrl}
              title={metadata.title || `${platformName} Video`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {/* Completed state */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Video watched
          </span>
          {existingResponse.watched_at && (
            <span className="text-[10px] text-v2-ink-muted">
              {new Date(existingResponse.watched_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Not yet watched
  return (
    <div className="space-y-2">
      {/* Video title */}
      {metadata.title && (
        <p className="text-xs font-medium text-v2-ink">{metadata.title}</p>
      )}

      {/* Video embed */}
      {embedUrl ? (
        <div className="relative aspect-video w-full rounded overflow-hidden bg-v2-card-dark">
          <iframe
            src={embedUrl}
            title={metadata.title || `${platformName} Video`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="aspect-video w-full rounded bg-v2-ring flex items-center justify-center">
          <div className="text-center text-v2-ink-muted">
            <AlertCircle className="h-5 w-5 mx-auto mb-1" />
            <p className="text-xs">Video unavailable</p>
          </div>
        </div>
      )}

      {/* Requirement note and button inline */}
      <div className="flex items-center gap-2 flex-wrap">
        {metadata.require_full_watch && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Watch entire video
          </p>
        )}

        {/* Mark as Watched Button */}
        <Button
          onClick={handleMarkWatched}
          disabled={isSubmitting || isDisabled || !embedUrl}
          size="sm"
          className="h-7 text-xs px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {isDisabled ? "Complete previous" : "Mark Watched"}
        </Button>
      </div>
    </div>
  );
}
