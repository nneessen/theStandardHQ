// src/features/recruiting/admin/BooleanQuestionConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { HelpCircle, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BooleanQuestionMetadata,
  BooleanQuestionStyle,
} from "@/types/recruiting.types";
import {
  BOOLEAN_QUESTION_STYLE_LABELS,
  BOOLEAN_QUESTION_DEFAULT_LABELS,
} from "@/types/recruiting.types";
import { createBooleanQuestionMetadata } from "@/types/checklist-metadata.types";

interface BooleanQuestionConfigProps {
  metadata: BooleanQuestionMetadata | null;
  onChange: (
    metadata: BooleanQuestionMetadata & { _type: "boolean_question" },
  ) => void;
}

export function BooleanQuestionConfig({
  metadata,
  onChange,
}: BooleanQuestionConfigProps) {
  const [questionText, setQuestionText] = useState(
    metadata?.question_text ?? "",
  );
  const [questionStyle, setQuestionStyle] = useState<BooleanQuestionStyle>(
    metadata?.question_style ?? "yes_no",
  );
  const [positiveLabel, setPositiveLabel] = useState(
    metadata?.positive_label ?? "",
  );
  const [negativeLabel, setNegativeLabel] = useState(
    metadata?.negative_label ?? "",
  );
  const [requirePositive, setRequirePositive] = useState(
    metadata?.require_positive ?? false,
  );
  const [explanationRequired, setExplanationRequired] = useState(
    metadata?.explanation_required ?? false,
  );
  const [explanationPrompt, setExplanationPrompt] = useState(
    metadata?.explanation_prompt ?? "",
  );

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    if (!questionText.trim()) {
      // Don't emit until question is provided
      return;
    }

    const defaults = BOOLEAN_QUESTION_DEFAULT_LABELS[questionStyle];

    const data: BooleanQuestionMetadata = {
      question_text: questionText,
      question_style: questionStyle,
      positive_label:
        questionStyle === "custom" && positiveLabel
          ? positiveLabel
          : defaults.positive,
      negative_label:
        questionStyle === "custom" && negativeLabel
          ? negativeLabel
          : defaults.negative,
      require_positive: requirePositive,
      explanation_required: explanationRequired,
      explanation_prompt: explanationRequired ? explanationPrompt : undefined,
    };

    const newMetadata = createBooleanQuestionMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    questionText,
    questionStyle,
    positiveLabel,
    negativeLabel,
    requirePositive,
    explanationRequired,
    explanationPrompt,
  ]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  // Update custom labels when style changes (reset to defaults)
  useEffect(() => {
    if (questionStyle !== "custom") {
      setPositiveLabel("");
      setNegativeLabel("");
    }
  }, [questionStyle]);

  const defaults = BOOLEAN_QUESTION_DEFAULT_LABELS[questionStyle];

  return (
    <div className="space-y-3 p-2.5 bg-background rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Boolean Question Configuration
        </span>
      </div>

      {/* Question Text */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Question Text <span className="text-destructive">*</span>
        </Label>
        <Textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="e.g., Do you want to join our squad?"
          className="min-h-[60px] text-[11px] resize-none"
        />
        {!questionText.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <AlertCircle className="h-3 w-3" />
            Question text is required
          </div>
        )}
      </div>

      {/* Question Style */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Answer Style
        </Label>
        <Select
          value={questionStyle}
          onValueChange={(value: BooleanQuestionStyle) =>
            setQuestionStyle(value)
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BOOLEAN_QUESTION_STYLE_LABELS).map(
              ([value, label]) => (
                <SelectItem key={value} value={value} className="text-[11px]">
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <p className="text-[9px] text-muted-foreground">
          Preview: {defaults.positive} / {defaults.negative}
        </p>
      </div>

      {/* Custom Labels (only shown for custom style) */}
      {questionStyle === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Positive Label
            </Label>
            <Input
              type="text"
              value={positiveLabel}
              onChange={(e) => setPositiveLabel(e.target.value)}
              placeholder="e.g., Accept"
              className="h-7 text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Negative Label
            </Label>
            <Input
              type="text"
              value={negativeLabel}
              onChange={(e) => setNegativeLabel(e.target.value)}
              placeholder="e.g., Decline"
              className="h-7 text-[11px]"
            />
          </div>
        </div>
      )}

      {/* Require Positive Answer */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Require Positive Answer
          </Label>
          <p className="text-[9px] text-muted-foreground">
            Must select "{defaults.positive}" to complete this item
          </p>
        </div>
        <Switch
          checked={requirePositive}
          onCheckedChange={setRequirePositive}
          className="scale-75"
        />
      </div>

      {/* Require Explanation */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Require Explanation
          </Label>
          <p className="text-[9px] text-muted-foreground">
            Ask recruit to explain their answer
          </p>
        </div>
        <Switch
          checked={explanationRequired}
          onCheckedChange={setExplanationRequired}
          className="scale-75"
        />
      </div>

      {/* Explanation Prompt (only shown if explanation required) */}
      {explanationRequired && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Explanation Prompt (Optional)
          </Label>
          <Input
            type="text"
            value={explanationPrompt}
            onChange={(e) => setExplanationPrompt(e.target.value)}
            placeholder="e.g., Please explain your answer..."
            className="h-7 text-[11px]"
          />
        </div>
      )}

      {/* Preview */}
      <div className="p-2 bg-info/10 rounded border border-info/30">
        <p className="text-[9px] text-info">
          <strong>Preview:</strong> Recruit will see the question and select
          either "{defaults.positive}" or "{defaults.negative}"
          {requirePositive && ` (must select "${defaults.positive}")`}
          {explanationRequired && " with explanation required"}.
        </p>
      </div>
    </div>
  );
}
