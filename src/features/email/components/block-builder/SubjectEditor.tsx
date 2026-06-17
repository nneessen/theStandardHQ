import { useState, useRef, useMemo } from "react";
import { ChevronDown, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    <div className={cn("space-y-1.5", className)}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <p
          className="font-mono text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--mut2)" }}
        >
          Subject Line
        </p>
        <span
          className="font-mono text-[10px]"
          style={{
            color: isRecommended
              ? "var(--green)"
              : !isAcceptable
                ? "var(--red)"
                : "var(--amber)",
          }}
        >
          {charCount}/50{" "}
          {isRecommended ? "✓" : charCount <= 100 ? "⚠" : "⚠ Too long"}
        </span>
      </div>

      <div className="flex gap-1.5">
        {/* Subject input */}
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter email subject..."
            className="h-8 pr-8 font-sans text-[13px]"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--line2)",
              color: "var(--ink)",
            }}
          />
          {value && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              {isRecommended ? (
                <CheckCircle
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--green)" }}
                />
              ) : isTooLong ? (
                <AlertCircle
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--red)" }}
                />
              ) : null}
            </span>
          )}
        </div>

        {/* Variable inserter */}
        <Popover open={variableOpen} onOpenChange={setVariableOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-1 rounded-lg px-2.5 font-mono text-[11px] font-semibold transition-colors hover:bg-[var(--surface-4)]"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
                color: "var(--mut)",
              }}
            >
              {"{{}}"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[220px] p-1"
            align="end"
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--line2)",
            }}
          >
            <p
              className="px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--mut2)" }}
            >
              Insert Variable
            </p>
            {SUBJECT_VARIABLES.map((v) => (
              <button
                key={v.key}
                onClick={() => insertVariable(v.key)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface-4)]"
              >
                <span
                  className="font-sans text-[12px]"
                  style={{ color: "var(--ink)" }}
                >
                  {v.label}
                </span>
                <code
                  className="font-mono text-[10px]"
                  style={{ color: "var(--mut2)" }}
                >
                  {`{{${v.key}}}`}
                </code>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Live preview */}
      {value && (
        <div
          className="rounded-lg px-2.5 py-1.5"
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--line)",
          }}
        >
          <span
            className="font-mono text-[10px]"
            style={{ color: "var(--mut2)" }}
          >
            Preview:{" "}
          </span>
          <span
            className="font-sans text-[12px]"
            style={{ color: "var(--ink)" }}
          >
            {previewText}
          </span>
        </div>
      )}

      {/* Tip when empty */}
      {!value && (
        <p className="font-sans text-[11px]" style={{ color: "var(--mut2)" }}>
          Keep under 50 characters for best open rates. Use variables like{" "}
          <code
            className="rounded px-1 font-mono text-[10px]"
            style={{
              background: "var(--surface-3)",
              color: "var(--mut)",
            }}
          >
            {"{{recruit_first_name}}"}
          </code>
        </p>
      )}
    </div>
  );
}
