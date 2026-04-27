// src/features/recruiting/admin/MultipleChoiceConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { List, Plus, Trash2, AlertCircle, GripVertical } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MultipleChoiceMetadata,
  MultipleChoiceOption,
  MultipleChoiceSelectionType,
} from "@/types/recruiting.types";
import { MULTIPLE_CHOICE_SELECTION_TYPE_LABELS } from "@/types/recruiting.types";
import { createMultipleChoiceMetadata } from "@/types/checklist-metadata.types";

interface MultipleChoiceConfigProps {
  metadata: MultipleChoiceMetadata | null;
  onChange: (
    metadata: MultipleChoiceMetadata & { _type: "multiple_choice" },
  ) => void;
}

function generateOptionId(): string {
  return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function MultipleChoiceConfig({
  metadata,
  onChange,
}: MultipleChoiceConfigProps) {
  const [questionText, setQuestionText] = useState(
    metadata?.question_text ?? "",
  );
  const [selectionType, setSelectionType] =
    useState<MultipleChoiceSelectionType>(metadata?.selection_type ?? "single");
  const [options, setOptions] = useState<MultipleChoiceOption[]>(
    metadata?.options ?? [
      { id: generateOptionId(), label: "" },
      { id: generateOptionId(), label: "" },
    ],
  );
  const [randomizeOrder, setRandomizeOrder] = useState(
    metadata?.randomize_order ?? false,
  );
  const [requireCorrect, setRequireCorrect] = useState(
    metadata?.require_correct ?? false,
  );
  const [minSelections, setMinSelections] = useState<number | undefined>(
    metadata?.min_selections,
  );
  const [maxSelections, setMaxSelections] = useState<number | undefined>(
    metadata?.max_selections,
  );

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    const validOptions = options.filter((o) => o.label.trim());
    if (!questionText.trim() || validOptions.length < 2) {
      return;
    }

    const data: MultipleChoiceMetadata = {
      question_text: questionText,
      selection_type: selectionType,
      options: validOptions,
      randomize_order: randomizeOrder,
      require_correct: requireCorrect,
      min_selections: selectionType === "multiple" ? minSelections : undefined,
      max_selections: selectionType === "multiple" ? maxSelections : undefined,
    };

    const newMetadata = createMultipleChoiceMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    questionText,
    selectionType,
    options,
    randomizeOrder,
    requireCorrect,
    minSelections,
    maxSelections,
  ]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  const addOption = () => {
    setOptions([...options, { id: generateOptionId(), label: "" }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (
    index: number,
    field: keyof MultipleChoiceOption,
    value: string | boolean,
  ) => {
    setOptions(
      options.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)),
    );
  };

  const handleNumberChange = (
    value: string,
    setter: (val: number | undefined) => void,
  ) => {
    if (value === "") {
      setter(undefined);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) {
        setter(num);
      }
    }
  };

  const validOptionsCount = options.filter((o) => o.label.trim()).length;

  return (
    <div className="space-y-3 p-2.5 bg-v2-canvas rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <List className="h-3.5 w-3.5 text-v2-ink-muted" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted">
          Multiple Choice Configuration
        </span>
      </div>

      {/* Question Text */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Question Text <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="e.g., What is your preferred work schedule?"
          className="min-h-[60px] text-[11px] resize-none"
        />
        {!questionText.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            Question text is required
          </div>
        )}
      </div>

      {/* Selection Type */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Selection Type
        </Label>
        <Select
          value={selectionType}
          onValueChange={(value: MultipleChoiceSelectionType) =>
            setSelectionType(value)
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MULTIPLE_CHOICE_SELECTION_TYPE_LABELS).map(
              ([value, label]) => (
                <SelectItem key={value} value={value} className="text-[11px]">
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Options <span className="text-red-500">*</span> (min 2)
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addOption}
            className="h-6 text-[10px] gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Option
          </Button>
        </div>

        <div className="space-y-2">
          {options.map((option, index) => (
            <div
              key={option.id}
              className="flex items-start gap-2 p-2 bg-v2-card rounded border"
            >
              <GripVertical className="h-4 w-4 text-v2-ink-subtle mt-1.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(index, "label", e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="h-7 text-[11px]"
                />
                <Input
                  type="text"
                  value={option.description ?? ""}
                  onChange={(e) =>
                    updateOption(index, "description", e.target.value)
                  }
                  placeholder="Description (optional)"
                  className="h-6 text-[10px]"
                />
                <div className="flex items-center gap-3">
                  {requireCorrect && (
                    <label className="flex items-center gap-1 text-[9px] text-v2-ink-muted">
                      <Checkbox
                        checked={option.is_correct ?? false}
                        onCheckedChange={(checked) =>
                          updateOption(index, "is_correct", checked === true)
                        }
                        className="h-3 w-3"
                      />
                      Correct
                    </label>
                  )}
                  <label className="flex items-center gap-1 text-[9px] text-v2-ink-muted">
                    <Checkbox
                      checked={option.is_disqualifying ?? false}
                      onCheckedChange={(checked) =>
                        updateOption(
                          index,
                          "is_disqualifying",
                          checked === true,
                        )
                      }
                      className="h-3 w-3"
                    />
                    Disqualifying
                  </label>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeOption(index)}
                disabled={options.length <= 2}
                className="h-6 w-6 p-0 text-v2-ink-subtle hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {validOptionsCount < 2 && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            At least 2 options with labels are required
          </div>
        )}
      </div>

      {/* Selection Limits (for multiple selection) */}
      {selectionType === "multiple" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Min Selections
            </Label>
            <Input
              type="number"
              min={0}
              value={minSelections ?? ""}
              onChange={(e) =>
                handleNumberChange(e.target.value, setMinSelections)
              }
              placeholder="Optional"
              className="h-7 text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Max Selections
            </Label>
            <Input
              type="number"
              min={0}
              value={maxSelections ?? ""}
              onChange={(e) =>
                handleNumberChange(e.target.value, setMaxSelections)
              }
              placeholder="Optional"
              className="h-7 text-[11px]"
            />
          </div>
        </div>
      )}

      {/* Require Correct Answer */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Require Correct Answer
          </Label>
          <p className="text-[9px] text-v2-ink-muted">
            Must select the marked correct option(s) to complete
          </p>
        </div>
        <Switch
          checked={requireCorrect}
          onCheckedChange={setRequireCorrect}
          className="scale-75"
        />
      </div>

      {/* Randomize Order */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Randomize Option Order
          </Label>
          <p className="text-[9px] text-v2-ink-muted">
            Shuffle options each time the question is displayed
          </p>
        </div>
        <Switch
          checked={randomizeOrder}
          onCheckedChange={setRandomizeOrder}
          className="scale-75"
        />
      </div>

      {/* Info */}
      <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
        <p className="text-[9px] text-blue-700 dark:text-blue-400">
          <strong>Note:</strong>{" "}
          {selectionType === "single"
            ? "Recruit will select one option."
            : "Recruit can select multiple options."}
          {requireCorrect && " Must select correct answer(s) to complete."}
        </p>
      </div>
    </div>
  );
}
