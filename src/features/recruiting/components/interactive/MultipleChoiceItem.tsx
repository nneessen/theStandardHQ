// src/features/recruiting/components/interactive/MultipleChoiceItem.tsx

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  MultipleChoiceMetadata,
  MultipleChoiceResponse,
} from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";

interface MultipleChoiceItemProps {
  progressId: string;
  metadata: MultipleChoiceMetadata;
  existingResponse?: MultipleChoiceResponse | null;
  onComplete?: () => void;
}

export function MultipleChoiceItem({
  progressId,
  metadata,
  existingResponse,
  onComplete,
}: MultipleChoiceItemProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    existingResponse?.selected_option_ids ?? [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMultiSelect = metadata.selection_type === "multiple";
  const minSelections = metadata.min_selections ?? 1;
  const maxSelections = metadata.max_selections;

  const handleToggleOption = useCallback(
    (optionId: string) => {
      if (isMultiSelect) {
        setSelectedIds((prev) => {
          if (prev.includes(optionId)) {
            return prev.filter((id) => id !== optionId);
          }
          if (maxSelections && prev.length >= maxSelections) {
            toast.error(`Maximum ${maxSelections} selections allowed`);
            return prev;
          }
          return [...prev, optionId];
        });
      } else {
        setSelectedIds([optionId]);
      }
    },
    [isMultiSelect, maxSelections],
  );

  const handleSubmit = useCallback(async () => {
    // Validate selection count
    const validation = checklistResponseService.validateMultipleChoiceSelection(
      selectedIds,
      minSelections,
      maxSelections,
    );

    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        await checklistResponseService.submitMultipleChoiceResponse(
          progressId,
          selectedIds,
          metadata,
        );

      if (!result.success) {
        toast.error(result.error || "Failed to submit selection");
        return;
      }

      // Check for disqualifying selections
      if (result.completionDetails?.disqualifying_selections) {
        const disqualifying = result.completionDetails
          .disqualifying_selections as string[];
        toast.warning(
          `Note: Your selection of "${disqualifying.join(", ")}" may affect your eligibility.`,
        );
      }

      if (result.autoComplete) {
        toast.success("Selection submitted!");
        onComplete?.();
      } else if (metadata.require_correct) {
        toast.info(
          "Your selection has been recorded, but it may not be the correct answer.",
        );
      } else {
        toast.success("Selection submitted!");
        onComplete?.();
      }
    } catch (error) {
      console.error("Failed to submit multiple choice response:", error);
      toast.error("Failed to submit selection");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    progressId,
    selectedIds,
    metadata,
    minSelections,
    maxSelections,
    onComplete,
  ]);

  // If already submitted
  if (existingResponse?.selected_option_ids?.length) {
    const selectedLabels = (metadata?.options || [])
      .filter((o) => existingResponse.selected_option_ids.includes(o.id))
      .map((o) => o.label);

    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Selection submitted
        </span>
        <p className="text-[10px] text-v2-ink-muted pl-5">
          {selectedLabels.join(", ")}
        </p>
      </div>
    );
  }

  // Error state - no options
  if (
    !metadata?.options ||
    !Array.isArray(metadata.options) ||
    metadata.options.length === 0
  ) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Question configuration error: No options available</span>
      </div>
    );
  }

  const canSubmit = selectedIds.length >= minSelections;

  return (
    <div className="space-y-1">
      {/* Question */}
      <p className="text-xs font-medium text-v2-ink">
        {metadata?.question_text}
      </p>

      {/* Selection hint */}
      {isMultiSelect && (
        <p className="text-[10px] text-v2-ink-muted">
          {minSelections > 1
            ? `Select at least ${minSelections}`
            : "Select all that apply"}
          {maxSelections ? ` (max ${maxSelections})` : ""}
        </p>
      )}

      {/* Options */}
      <div className="space-y-1">
        {metadata.options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          const isDisqualifying = option.is_disqualifying;

          return (
            <div
              key={option.id}
              className={`flex items-start gap-2 p-1.5 rounded border cursor-pointer transition-colors ${
                isSelected
                  ? "bg-primary/10 border-primary"
                  : "bg-white  border-v2-ring hover:border-v2-ring"
              }`}
              onClick={() => !isSubmitting && handleToggleOption(option.id)}
            >
              {isMultiSelect ? (
                <Checkbox
                  checked={isSelected}
                  disabled={isSubmitting}
                  className="mt-0.5"
                />
              ) : (
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                    isSelected ? "border-primary bg-primary" : "border-v2-ring "
                  }`}
                >
                  {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-v2-ink">{option.label}</span>
                  {isDisqualifying && isSelected && (
                    <AlertTriangle className="h-3 w-3 text-warning" />
                  )}
                </div>
                {option.description && (
                  <p className="text-[10px] text-v2-ink-muted mt-0.5">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shuffle note and submit button inline */}
      <div className="flex items-center gap-2 flex-wrap">
        {metadata.randomize_order && (
          <p className="text-[10px] text-v2-ink-subtle italic">Random order</p>
        )}

        {/* Submit Button */}
        {canSubmit && (
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
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}
