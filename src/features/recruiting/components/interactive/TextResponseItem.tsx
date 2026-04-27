// src/features/recruiting/components/interactive/TextResponseItem.tsx

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type {
  TextResponseMetadata,
  TextResponseData,
} from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";

interface TextResponseItemProps {
  progressId: string;
  metadata: TextResponseMetadata;
  existingResponse?: TextResponseData | null;
  onComplete?: () => void;
}

export function TextResponseItem({
  progressId,
  metadata,
  existingResponse,
  onComplete,
}: TextResponseItemProps) {
  const [text, setText] = useState(existingResponse?.text ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const characterCount = text.length;
  const minLength = metadata.min_length ?? 0;
  const maxLength = metadata.max_length;

  const handleSubmit = useCallback(async () => {
    // Validate
    const validation = checklistResponseService.validateTextResponse(
      text,
      metadata.min_length,
      metadata.max_length,
      metadata.required_keywords,
      metadata.validation_pattern,
    );

    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await checklistResponseService.submitTextResponse(
        progressId,
        text,
      );

      if (!result.success) {
        toast.error(result.error || "Failed to submit response");
        return;
      }

      toast.success("Response submitted!");
      onComplete?.();
    } catch (error) {
      console.error("Failed to submit text response:", error);
      toast.error("Failed to submit response");
    } finally {
      setIsSubmitting(false);
    }
  }, [progressId, text, metadata, onComplete]);

  // If already submitted
  if (existingResponse?.text) {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Response submitted
        </span>
        <p className="text-[10px] text-v2-ink-muted italic line-clamp-2 pl-5">
          "{existingResponse.text}"
        </p>
      </div>
    );
  }

  const canSubmit = characterCount >= minLength;

  return (
    <div className="space-y-1">
      {/* Prompt */}
      <p className="text-xs font-medium text-v2-ink">{metadata.prompt}</p>

      {/* Text Area */}
      <div className="space-y-1">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={metadata.placeholder || "Enter your response..."}
          className={`min-h-[${metadata.response_type === "long" ? "100" : "60"}px] text-xs`}
          disabled={isSubmitting}
          maxLength={maxLength}
        />
        <div className="flex justify-between items-center text-[10px] text-v2-ink-muted">
          <span>
            {minLength > 0 && characterCount < minLength && (
              <span className="text-amber-600">
                {minLength - characterCount} more required
              </span>
            )}
            {metadata.required_keywords &&
              metadata.required_keywords.length > 0 && (
                <span>Include: {metadata.required_keywords.join(", ")}</span>
              )}
          </span>
          <span>
            {characterCount}
            {maxLength ? ` / ${maxLength}` : ""}
          </span>
        </div>
      </div>

      {/* Submit Button - appears inline when ready */}
      {canSubmit && (
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="sm"
          className="h-7 text-xs px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Submit
        </Button>
      )}
    </div>
  );
}
