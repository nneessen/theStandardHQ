// src/features/recruiting/components/interactive/AcknowledgmentItem.tsx

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, ExternalLink, FileText } from "lucide-react";
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
  // Scroll completion only makes sense for inline text. Persisted require_scroll
  // can linger after the content type changes (AcknowledgmentConfig keeps the
  // flag), so derive an effective flag that is false for non-inline content —
  // otherwise document_url / terms_reference items can never be completed.
  const scrollRequired =
    metadata.require_scroll === true &&
    (metadata.content_type ?? "inline_text") === "inline_text";

  const [acknowledged, setAcknowledged] = useState(
    existingResponse?.acknowledged ?? false,
  );
  const [scrollCompleted, setScrollCompleted] = useState(
    existingResponse?.scroll_completed ?? !scrollRequired,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track scroll completion
  useEffect(() => {
    if (!scrollRequired || scrollCompleted) return;

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
  }, [scrollRequired, scrollCompleted]);

  const handleSubmit = useCallback(async () => {
    if (!acknowledged) {
      toast.error("Please check the acknowledgment box");
      return;
    }

    if (scrollRequired && !scrollCompleted) {
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
  }, [progressId, acknowledged, scrollCompleted, scrollRequired, onComplete]);

  // If already acknowledged and completed
  if (existingResponse?.acknowledged) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Acknowledged
      </span>
    );
  }

  const canComplete = acknowledged && (!scrollRequired || scrollCompleted);

  const contentType = metadata.content_type ?? "inline_text";

  return (
    <div className="space-y-2">
      {/* Document title / heading, when provided */}
      {metadata.document_title && (
        <p className="text-xs font-medium text-v2-ink leading-tight">
          {metadata.document_title}
        </p>
      )}

      {/* Content to acknowledge — rendered according to content_type */}
      {metadata.content && contentType === "inline_text" && (
        <ScrollArea
          ref={scrollRef}
          className="max-h-[120px] rounded border border-v2-ring p-2"
        >
          <div className="text-xs text-v2-ink-muted whitespace-pre-wrap">
            {metadata.content}
          </div>
        </ScrollArea>
      )}

      {metadata.content && contentType === "document_url" && (
        <div className="rounded border border-v2-ring p-2">
          <a
            href={metadata.content}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 hover:no-underline"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            Open document
          </a>
        </div>
      )}

      {metadata.content && contentType === "terms_reference" && (
        <div className="rounded border border-v2-ring p-2 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-v2-ink-muted" />
          <span className="text-xs text-v2-ink-muted">
            {metadata.document_title
              ? `${metadata.document_title} (${metadata.content})`
              : metadata.content}
          </span>
        </div>
      )}

      {/* Scroll requirement notice */}
      {scrollRequired && !scrollCompleted && (
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
            disabled={isSubmitting || (scrollRequired && !scrollCompleted)}
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
