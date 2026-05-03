// src/features/recruiting/components/interactive/AcknowledgmentItem.tsx

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type {
  AcknowledgmentMetadata,
  AcknowledgmentResponse,
} from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";

interface AcknowledgmentItemProps {
  progressId: string;
  metadata: AcknowledgmentMetadata;
  existingResponse?: AcknowledgmentResponse | null;
  onComplete?: () => void;
}

export function AcknowledgmentItem({
  progressId,
  metadata,
  existingResponse,
  onComplete,
}: AcknowledgmentItemProps) {
  const [acknowledged, setAcknowledged] = useState(
    existingResponse?.acknowledged ?? false,
  );
  const [scrollCompleted, setScrollCompleted] = useState(
    existingResponse?.scroll_completed ?? !metadata.require_scroll,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track scroll completion
  useEffect(() => {
    if (!metadata.require_scroll || scrollCompleted) return;

    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      // Consider scrolled if within 20px of bottom
      if (scrollTop + clientHeight >= scrollHeight - 20) {
        setScrollCompleted(true);
      }
    };

    scrollElement.addEventListener("scroll", handleScroll);
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [metadata.require_scroll, scrollCompleted]);

  const handleSubmit = useCallback(async () => {
    if (!acknowledged) {
      toast.error("Please check the acknowledgment box");
      return;
    }

    if (metadata.require_scroll && !scrollCompleted) {
      toast.error("Please scroll through the entire content first");
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        await checklistResponseService.submitAcknowledgmentResponse(
          progressId,
          acknowledged,
          scrollCompleted,
        );

      if (!result.success) {
        toast.error(result.error || "Failed to submit acknowledgment");
        return;
      }

      toast.success("Acknowledgment submitted!");
      onComplete?.();
    } catch (error) {
      console.error("Failed to submit acknowledgment:", error);
      toast.error("Failed to submit acknowledgment");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    progressId,
    acknowledged,
    scrollCompleted,
    metadata.require_scroll,
    onComplete,
  ]);

  // If already acknowledged and completed
  if (existingResponse?.acknowledged) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Acknowledged
      </span>
    );
  }

  const canComplete =
    acknowledged && (!metadata.require_scroll || scrollCompleted);

  return (
    <div className="space-y-2">
      {/* Content to acknowledge */}
      {metadata.content && (
        <ScrollArea
          ref={scrollRef}
          className="max-h-[120px] rounded border border-v2-ring p-2"
        >
          <div className="text-xs text-v2-ink-muted whitespace-pre-wrap">
            {metadata.content}
          </div>
        </ScrollArea>
      )}

      {/* Scroll requirement notice */}
      {metadata.require_scroll && !scrollCompleted && (
        <p className="text-[10px] text-warning">
          Scroll through entire content before acknowledging
        </p>
      )}

      {/* Acknowledgment checkbox with inline completion button */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-start gap-2">
          <Checkbox
            id={`ack-${progressId}`}
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            disabled={
              isSubmitting || (metadata.require_scroll && !scrollCompleted)
            }
            className="mt-0.5"
          />
          <label
            htmlFor={`ack-${progressId}`}
            className="text-xs text-v2-ink-muted cursor-pointer leading-tight"
          >
            {metadata.acknowledgment_text}
          </label>
        </div>

        {/* Complete button appears when ready */}
        {canComplete && (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="sm"
            className="h-7 text-xs px-3 gap-1.5 bg-success hover:bg-success"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Complete
          </Button>
        )}
      </div>
    </div>
  );
}
