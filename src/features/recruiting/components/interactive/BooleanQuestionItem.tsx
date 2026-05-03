// src/features/recruiting/components/interactive/BooleanQuestionItem.tsx

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type {
  BooleanQuestionMetadata,
  BooleanQuestionResponse,
} from "@/types/recruiting.types";
import { BOOLEAN_QUESTION_DEFAULT_LABELS } from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";

interface BooleanQuestionItemProps {
  progressId: string;
  metadata: BooleanQuestionMetadata;
  existingResponse?: BooleanQuestionResponse | null;
  onComplete?: () => void;
}

export function BooleanQuestionItem({
  progressId,
  metadata,
  existingResponse,
  onComplete,
}: BooleanQuestionItemProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(
    existingResponse?.answer ?? null,
  );
  const [explanation, setExplanation] = useState(
    existingResponse?.explanation ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaults = BOOLEAN_QUESTION_DEFAULT_LABELS[metadata.question_style];
  const positiveLabel = metadata.positive_label || defaults.positive;
  const negativeLabel = metadata.negative_label || defaults.negative;

  const handleSubmit = useCallback(async () => {
    if (selectedAnswer === null) {
      toast.error("Please select an answer");
      return;
    }

    if (metadata.explanation_required && !explanation.trim()) {
      toast.error("Please provide an explanation");
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        await checklistResponseService.submitBooleanQuestionResponse(
          progressId,
          selectedAnswer,
          explanation || undefined,
          metadata,
        );

      if (!result.success) {
        toast.error(result.error || "Failed to submit response");
        return;
      }

      if (result.autoComplete) {
        toast.success("Answer submitted!");
        onComplete?.();
      } else if (metadata.require_positive && !selectedAnswer) {
        toast.info(`You must select "${positiveLabel}" to complete this item`);
      } else {
        toast.success("Answer saved");
      }
    } catch (error) {
      console.error("Failed to submit boolean question response:", error);
      toast.error("Failed to submit response");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    progressId,
    selectedAnswer,
    explanation,
    metadata,
    positiveLabel,
    onComplete,
  ]);

  // Answered state - clean inline
  if (existingResponse && selectedAnswer !== null) {
    return (
      <div className="flex items-start gap-2">
        <Check className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-success dark:text-success">
            <strong>{selectedAnswer ? positiveLabel : negativeLabel}</strong>
          </span>
          {existingResponse.explanation && (
            <p className="text-xs text-v2-ink-muted mt-0.5 italic">
              "{existingResponse.explanation}"
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Question text */}
      <p className="text-xs font-medium text-v2-ink">
        {metadata.question_text}
      </p>

      {/* Answer buttons - compact inline */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={selectedAnswer === true ? "default" : "outline"}
          size="sm"
          className={`flex-1 h-7 text-xs ${
            selectedAnswer === true ? "bg-success hover:bg-success" : ""
          }`}
          onClick={() => setSelectedAnswer(true)}
          disabled={isSubmitting}
        >
          {positiveLabel}
        </Button>
        <Button
          type="button"
          variant={selectedAnswer === false ? "default" : "outline"}
          size="sm"
          className={`flex-1 h-7 text-xs ${
            selectedAnswer === false
              ? "bg-v2-ring-strong hover:bg-v2-ink-muted"
              : ""
          }`}
          onClick={() => setSelectedAnswer(false)}
          disabled={isSubmitting}
        >
          {negativeLabel}
        </Button>
      </div>

      {/* Explanation field - if required */}
      {metadata.explanation_required && (
        <div className="space-y-1">
          <label className="text-[10px] text-v2-ink-muted -subtle">
            {metadata.explanation_prompt || "Please explain your answer"}{" "}
            <span className="text-destructive">*</span>
          </label>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Enter your explanation..."
            className="min-h-[60px] text-xs"
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Requirement note - subtle */}
      {metadata.require_positive && (
        <p className="text-[10px] text-warning">
          Note: You must select "{positiveLabel}" to complete this item.
        </p>
      )}

      {/* Submit button - emerald for completion */}
      {selectedAnswer !== null && (
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="sm"
          variant="default"
          className="h-7 text-xs px-3 gap-1.5 bg-success hover:bg-success"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Submit Answer
        </Button>
      )}
    </div>
  );
}
