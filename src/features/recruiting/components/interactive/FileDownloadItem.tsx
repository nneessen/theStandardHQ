// src/features/recruiting/components/interactive/FileDownloadItem.tsx

import { useState, useCallback } from "react";
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
      } catch (error) {
        console.error("Failed to record download:", error);
      }
    }
  }, [progressId, metadata?.file_url, hasDownloaded]);

  const handleAcknowledge = useCallback(async () => {
    if (!hasDownloaded) {
      toast.error("Please download the file first");
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
    hasDownloaded,
    acknowledged,
    metadata?.acknowledgment_text,
    onComplete,
  ]);

  // Completed state
  if (existingResponse?.acknowledged) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
        <Check className="h-3.5 w-3.5" />
        Downloaded & reviewed
      </span>
    );
  }

  // Error state - missing file URL
  if (!metadata?.file_url || !metadata?.file_name) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
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
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
          <Check className="h-3.5 w-3.5" />
          Downloaded
        </span>
      )}

      {/* Acknowledgment requirement */}
      {metadata.acknowledgment_text && hasDownloaded && (
        <div className="w-full flex items-start gap-2 mt-1">
          <Checkbox
            id={`file-ack-${progressId}`}
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            disabled={isSubmitting}
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

      {/* Complete button */}
      {hasDownloaded && (!metadata.acknowledgment_text || acknowledged) && (
        <Button
          onClick={handleAcknowledge}
          disabled={isSubmitting}
          size="sm"
          variant="default"
          className="h-7 text-xs px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700 ml-auto"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Complete
        </Button>
      )}
    </div>
  );
}
