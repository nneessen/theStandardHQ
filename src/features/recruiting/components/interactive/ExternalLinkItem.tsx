// src/features/recruiting/components/interactive/ExternalLinkItem.tsx

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type {
  ExternalLinkMetadata,
  ExternalLinkResponse,
} from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";

interface ExternalLinkItemProps {
  progressId: string;
  metadata: ExternalLinkMetadata;
  existingResponse?: ExternalLinkResponse | null;
  onComplete?: () => void;
}

export function ExternalLinkItem({
  progressId,
  metadata,
  existingResponse,
  onComplete,
}: ExternalLinkItemProps) {
  const [hasClicked, setHasClicked] = useState(
    existingResponse?.clicked ?? false,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenLink = useCallback(async () => {
    if (!metadata?.url) {
      toast.error("Link URL is missing");
      return;
    }

    window.open(metadata.url, "_blank");

    if (!hasClicked) {
      try {
        await checklistResponseService.recordExternalLinkClick(progressId);
        setHasClicked(true);
      } catch (error) {
        console.error("Failed to record link click:", error);
      }
    }

    if (metadata?.completion_method === "return_url") {
      try {
        const result =
          await checklistResponseService.completeExternalLink(progressId);
        if (result.success) {
          toast.success("Task completed!");
          onComplete?.();
        }
      } catch (error) {
        console.error("Failed to auto-complete:", error);
      }
    }
  }, [
    progressId,
    metadata?.url,
    metadata?.completion_method,
    hasClicked,
    onComplete,
  ]);

  const handleMarkComplete = useCallback(async () => {
    if (!hasClicked) {
      toast.error("Please visit the link first");
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        await checklistResponseService.completeExternalLink(progressId);
      if (!result.success) {
        toast.error(result.error || "Failed to complete");
        return;
      }
      toast.success("Completed!");
      onComplete?.();
    } catch (error) {
      console.error("Failed to complete external link:", error);
      toast.error("Failed to complete");
    } finally {
      setIsSubmitting(false);
    }
  }, [progressId, hasClicked, onComplete]);

  // Completed state - minimal inline indicator
  if (existingResponse?.returned) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
        <Check className="h-3.5 w-3.5" />
        Link completed
      </span>
    );
  }

  // Error state - missing URL
  if (!metadata?.url) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Link configuration error: Missing URL</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Primary action - open link */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenLink}
        className="h-7 text-xs px-3 gap-1.5 font-normal"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {metadata.link_text}
      </Button>

      {/* Status indicator */}
      {hasClicked && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
          <Check className="h-3.5 w-3.5" />
          Visited
        </span>
      )}

      {/* Manual completion */}
      {metadata.completion_method === "manual" && hasClicked && (
        <Button
          onClick={handleMarkComplete}
          disabled={isSubmitting}
          size="sm"
          variant="default"
          className="h-7 text-xs px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Complete
        </Button>
      )}

      {/* Description - subtle, secondary */}
      {metadata.description && (
        <p className="w-full text-xs text-v2-ink-muted mt-0.5">
          {metadata.description}
        </p>
      )}

      {/* Verification instructions - if needed */}
      {metadata.verification_instructions && hasClicked && (
        <p className="w-full text-xs text-v2-ink-muted mt-0.5 italic">
          {metadata.verification_instructions}
        </p>
      )}
    </div>
  );
}
