// src/features/recruiting/components/interactive/FileDownloadItem.tsx

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Check, File, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type {
  FileDownloadMetadata,
  FileDownloadResponse,
} from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";

interface FileDownloadItemProps {
  progressId: string;
  metadata: FileDownloadMetadata;
  existingResponse?: FileDownloadResponse | null;
  onComplete?: () => void;
}

export function FileDownloadItem({
  progressId,
  metadata,
  existingResponse,
  onComplete,
}: FileDownloadItemProps) {
  const [hasDownloaded, setHasDownloaded] = useState(
    existingResponse?.downloaded ?? false,
  );
  const [acknowledged, setAcknowledged] = useState(
    existingResponse?.acknowledged ?? false,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // minimum_review_time_seconds enforcement
  const reviewSeconds = metadata?.minimum_review_time_seconds ?? 0;
  // Track remaining dwell time. Start at full value only if download already
  // recorded when the component mounts; otherwise starts at 0 and resets on
  // first download click.
  const [reviewSecondsRemaining, setReviewSecondsRemaining] = useState<number>(
    () => {
      if (reviewSeconds > 0 && (existingResponse?.downloaded ?? false)) {
        // Download was already recorded before this mount; begin countdown
        // immediately so returning users still have to wait the full time
        // (or 0 if this is a re-render after a previous complete — but
        // existingResponse?.acknowledged guards that path above).
        return reviewSeconds;
      }
      return 0;
    },
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setReviewSecondsRemaining(seconds);
    timerRef.current = setInterval(() => {
      setReviewSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // If the component mounts with a pre-existing download and a review time,
  // begin the countdown immediately (handles page-refresh mid-dwell scenario).
  useEffect(() => {
    if (reviewSeconds > 0 && (existingResponse?.downloaded ?? false)) {
      startCountdown(reviewSeconds);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // Run only on mount; startCountdown is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = useCallback(async () => {
    if (!metadata?.file_url) {
      toast.error("File URL is missing");
      return;
    }
    window.open(metadata.file_url, "_blank");

    if (!hasDownloaded) {
      try {
        await checklistResponseService.recordFileDownload(progressId);
        setHasDownloaded(true);
        toast.success("Download started");
        // Begin the dwell-time countdown on first download
        if (reviewSeconds > 0) {
          startCountdown(reviewSeconds);
        }
      } catch (error) {
        console.error("Failed to record download:", error);
      }
    }
  }, [
    progressId,
    metadata?.file_url,
    hasDownloaded,
    reviewSeconds,
    startCountdown,
  ]);

  // require_download: when true (or absent — treated as true for back-compat
  // since the previous code always required download), block completion until
  // the recruit has actually clicked the download button. When explicitly
  // false, completion is allowed without downloading.
  const requireDownload = metadata?.require_download !== false;
  const downloadBlocked = requireDownload && !hasDownloaded;

  // Dwell-time gate: only active after the download has happened AND the
  // configured minimum has not yet elapsed.
  const dwellBlocked =
    reviewSeconds > 0 && hasDownloaded && reviewSecondsRemaining > 0;

  const handleAcknowledge = useCallback(async () => {
    if (downloadBlocked) {
      toast.error("Please download the file first");
      return;
    }

    if (dwellBlocked) {
      toast.error(
        `Please wait ${reviewSecondsRemaining}s more before completing`,
      );
      return;
    }

    if (metadata?.acknowledgment_text && !acknowledged) {
      toast.error("Please confirm you have reviewed the file");
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        await checklistResponseService.acknowledgeFileDownload(progressId);
      if (!result.success) {
        toast.error(result.error || "Failed to complete");
        return;
      }
      toast.success("Completed!");
      onComplete?.();
    } catch (error) {
      console.error("Failed to acknowledge file download:", error);
      toast.error("Failed to complete");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    progressId,
    downloadBlocked,
    dwellBlocked,
    reviewSecondsRemaining,
    acknowledged,
    metadata?.acknowledgment_text,
    onComplete,
  ]);

  // Completed state
  if (existingResponse?.acknowledged) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success dark:text-success">
        <Check className="h-3.5 w-3.5" />
        Downloaded & reviewed
      </span>
    );
  }

  // Error state - missing file URL
  if (!metadata?.file_url || !metadata?.file_name) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>File configuration error: Missing file URL or name</span>
      </div>
    );
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileInfo = [
    metadata.file_type?.toUpperCase(),
    metadata.file_size_bytes && formatFileSize(metadata.file_size_bytes),
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="flex items-start gap-2 flex-wrap">
      {/* File info with download button */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <File className="h-4 w-4 text-v2-ink-subtle flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-v2-ink truncate">
            {metadata.file_name}
          </div>
          {fileInfo && (
            <div className="text-[10px] text-v2-ink-muted">{fileInfo}</div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="h-7 text-xs px-3 gap-1.5 font-normal flex-shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </div>

      {/* Status indicator */}
      {hasDownloaded && !metadata.acknowledgment_text && (
        <span className="inline-flex items-center gap-1 text-xs text-success dark:text-success">
          <Check className="h-3.5 w-3.5" />
          Downloaded
        </span>
      )}

      {/* Acknowledgment requirement — shown once download gate is satisfied */}
      {metadata.acknowledgment_text && !downloadBlocked && (
        <div className="w-full flex items-start gap-2 mt-1">
          <Checkbox
            id={`file-ack-${progressId}`}
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            disabled={isSubmitting || dwellBlocked}
            className="h-4 w-4 mt-0.5"
          />
          <label
            htmlFor={`file-ack-${progressId}`}
            className="text-xs text-v2-ink-muted cursor-pointer flex-1"
          >
            {metadata.acknowledgment_text}
          </label>
        </div>
      )}

      {/* Dwell-time countdown — shown while the timer is running */}
      {dwellBlocked && (
        <span className="w-full text-xs text-v2-ink-muted">
          Please review the file — complete available in{" "}
          {reviewSecondsRemaining}s
        </span>
      )}

      {/* Complete button — visible whenever download gate + ack gate are met;
          disabled while dwell timer is running */}
      {!downloadBlocked && (!metadata.acknowledgment_text || acknowledged) && (
        <Button
          onClick={handleAcknowledge}
          disabled={isSubmitting || dwellBlocked}
          size="sm"
          variant="default"
          className="h-7 text-xs px-3 gap-1.5 bg-success hover:bg-success ml-auto"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {dwellBlocked ? `Wait ${reviewSecondsRemaining}s` : "Complete"}
        </Button>
      )}
    </div>
  );
}
