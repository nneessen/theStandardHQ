import { useState, useRef, useMemo } from "react";
import { ChevronDown, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getVariablesByCategory } from "@/lib/templateVariables";

interface SubjectEditorProps {
  value: string;
  onChange: (value: string) => void;
  previewVariables?: Record<string, string>;
  className?: string;
}

export function SubjectEditor({
  value,
  onChange,
  previewVariables = {},
  className,
}: SubjectEditorProps) {
  const [variableOpen, setVariableOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive subject variables from shared source (email context)
  const SUBJECT_VARIABLES = useMemo(
    () =>
      getVariablesByCategory("email")
        .flatMap((group) => group.variables)
        .map((v) => ({ key: v.key, label: v.description, preview: v.preview })),
    [],
  );

  // Character count and recommendations
  const charCount = value.length;
  const isRecommended = charCount <= 50;
  const isAcceptable = charCount <= 100;
  const isTooLong = charCount > 100;

  // Preview with variables replaced
  const previewText = value.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) =>
      previewVariables[key] ||
      SUBJECT_VARIABLES.find((v) => v.key === key)?.preview ||
      `{{${key}}}`,
  );

  const insertVariable = (variable: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange(value + `{{${variable}}}`);
      return;
    }

    const start = input.selectionStart || value.length;
    const end = input.selectionEnd || value.length;
    const newValue =
      value.slice(0, start) + `{{${variable}}}` + value.slice(end);
    onChange(newValue);

    // Restore focus and cursor position
    setTimeout(() => {
      input.focus();
      const newPos = start + variable.length + 4; // {{}} = 4 chars
      input.setSelectionRange(newPos, newPos);
    }, 0);

    setVariableOpen(false);
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Subject Line</Label>
        <span
          className={cn(
            "text-[10px]",
            isRecommended && "text-success",
            !isRecommended && isAcceptable && "text-warning",
            isTooLong && "text-destructive",
          )}
        >
          {charCount}/50{" "}
          {isRecommended ? "✓" : charCount <= 100 ? "⚠️" : "⚠️ Too long"}
        </span>
      </div>

      <div className="flex gap-1">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter email subject..."
            className="h-8 pr-8 text-sm"
          />
          {value && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              {isRecommended ? (
                <CheckCircle className="h-3.5 w-3.5 text-success" />
              ) : isTooLong ? (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              ) : null}
            </span>
          )}
        </div>

        <Popover open={variableOpen} onOpenChange={setVariableOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 px-2">
              <span className="text-[10px]">{"{{}}"}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-1" align="end">
            <div className="text-[10px] font-medium text-muted-foreground px-2 py-1">
              Insert Variable
            </div>
            {SUBJECT_VARIABLES.map((v) => (
              <button
                key={v.key}
                onClick={() => insertVariable(v.key)}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
              >
                <span>{v.label}</span>
                <code className="text-[10px] text-muted-foreground">
                  {`{{${v.key}}}`}
                </code>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Preview */}
      {value && (
        <div className="rounded border bg-muted/50 px-2 py-1">
          <span className="text-[10px] text-muted-foreground">Preview: </span>
          <span className="text-xs">{previewText}</span>
        </div>
      )}

      {/* Tips */}
      {!value && (
        <p className="text-[10px] text-muted-foreground">
          Keep under 50 characters for best open rates. Use variables like{" "}
          <code className="rounded bg-muted px-1">
            {"{{recruit_first_name}}"}
          </code>
        </p>
      )}
    </div>
  );
}
