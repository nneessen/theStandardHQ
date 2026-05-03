// src/features/recruiting/admin/TextResponseConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { MessageSquare, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  TextResponseMetadata,
  TextResponseType,
} from "@/types/recruiting.types";
import { TEXT_RESPONSE_TYPE_LABELS } from "@/types/recruiting.types";
import { createTextResponseMetadata } from "@/types/checklist-metadata.types";

interface TextResponseConfigProps {
  metadata: TextResponseMetadata | null;
  onChange: (
    metadata: TextResponseMetadata & { _type: "text_response" },
  ) => void;
}

export function TextResponseConfig({
  metadata,
  onChange,
}: TextResponseConfigProps) {
  const [prompt, setPrompt] = useState(metadata?.prompt ?? "");
  const [responseType, setResponseType] = useState<TextResponseType>(
    metadata?.response_type ?? "short",
  );
  const [minLength, setMinLength] = useState<number | undefined>(
    metadata?.min_length,
  );
  const [maxLength, setMaxLength] = useState<number | undefined>(
    metadata?.max_length,
  );
  const [placeholder, setPlaceholder] = useState(metadata?.placeholder ?? "");
  const [validationPattern, setValidationPattern] = useState(
    metadata?.validation_pattern ?? "",
  );
  const [requiredKeywords, setRequiredKeywords] = useState(
    metadata?.required_keywords?.join(", ") ?? "",
  );

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    if (!prompt.trim()) {
      return;
    }

    const keywords = requiredKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const data: TextResponseMetadata = {
      prompt: prompt,
      response_type: responseType,
      min_length: minLength,
      max_length: maxLength,
      placeholder: placeholder || undefined,
      validation_pattern: validationPattern || undefined,
      required_keywords: keywords.length > 0 ? keywords : undefined,
    };

    const newMetadata = createTextResponseMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    prompt,
    responseType,
    minLength,
    maxLength,
    placeholder,
    validationPattern,
    requiredKeywords,
  ]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

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

  return (
    <div className="space-y-3 p-2.5 bg-background rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Text Response Configuration
        </span>
      </div>

      {/* Prompt */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Question/Prompt <span className="text-destructive">*</span>
        </Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., What are your goals for the first 90 days?"
          className="min-h-[60px] text-[11px] resize-none"
        />
        {!prompt.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <AlertCircle className="h-3 w-3" />
            Prompt is required
          </div>
        )}
      </div>

      {/* Response Type */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Response Type
        </Label>
        <Select
          value={responseType}
          onValueChange={(value: TextResponseType) => setResponseType(value)}
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TEXT_RESPONSE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-[11px]">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Length Constraints */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Minimum Characters
          </Label>
          <Input
            type="number"
            min={0}
            value={minLength ?? ""}
            onChange={(e) => handleNumberChange(e.target.value, setMinLength)}
            placeholder="Optional"
            className="h-7 text-[11px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Maximum Characters
          </Label>
          <Input
            type="number"
            min={0}
            value={maxLength ?? ""}
            onChange={(e) => handleNumberChange(e.target.value, setMaxLength)}
            placeholder="Optional"
            className="h-7 text-[11px]"
          />
        </div>
      </div>

      {/* Placeholder */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Placeholder Text (Optional)
        </Label>
        <Input
          type="text"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder="e.g., Enter your response here..."
          className="h-7 text-[11px]"
        />
      </div>

      {/* Required Keywords */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Required Keywords (Optional)
        </Label>
        <Input
          type="text"
          value={requiredKeywords}
          onChange={(e) => setRequiredKeywords(e.target.value)}
          placeholder="e.g., commitment, growth, team (comma-separated)"
          className="h-7 text-[11px]"
        />
        <p className="text-[9px] text-muted-foreground">
          Response must contain all specified keywords (comma-separated)
        </p>
      </div>

      {/* Validation Pattern (advanced) */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Validation Pattern (Optional, Advanced)
        </Label>
        <Input
          type="text"
          value={validationPattern}
          onChange={(e) => setValidationPattern(e.target.value)}
          placeholder="e.g., ^[A-Za-z ]+$ (regex)"
          className="h-7 text-[11px]"
        />
        <p className="text-[9px] text-muted-foreground">
          Regular expression pattern for validation (leave empty for no pattern
          validation)
        </p>
      </div>

      {/* Info */}
      <div className="p-2 bg-info/10 rounded border border-info/30">
        <p className="text-[9px] text-info">
          <strong>Note:</strong> Recruit will see the prompt and provide a{" "}
          {responseType === "short" ? "single-line" : "multi-line"} text
          response.
          {minLength && ` Minimum ${minLength} characters required.`}
          {maxLength && ` Maximum ${maxLength} characters allowed.`}
        </p>
      </div>
    </div>
  );
}
