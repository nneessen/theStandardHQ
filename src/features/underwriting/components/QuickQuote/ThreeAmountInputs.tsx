// src/features/underwriting/components/QuickQuote/ThreeAmountInputs.tsx
// Three customizable amount inputs for Quick Quote comparison

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface ThreeAmountInputsProps {
  mode: "coverage" | "budget";
  values: [number, number, number];
  onChange: (values: [number, number, number]) => void;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatDisplayValue(
  value: number,
  mode: "coverage" | "budget",
): string {
  if (mode === "budget") {
    return value.toString();
  }
  return value.toLocaleString("en-US");
}

function parseInputValue(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// =============================================================================
// Single Input Component
// =============================================================================

function AmountInput({
  value,
  onChange,
  label,
  mode,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  mode: "coverage" | "budget";
}) {
  const [localValue, setLocalValue] = useState(formatDisplayValue(value, mode));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatDisplayValue(value, mode));
    }
  }, [value, mode, isFocused]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseInputValue(localValue);
    const clamped = Math.max(0, Math.round(parsed));
    onChange(clamped);
    setLocalValue(formatDisplayValue(clamped, mode));
  }, [localValue, onChange, mode]);

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      setLocalValue(value.toString());
      // Select all text so Tab-into immediately overwrites
      requestAnimationFrame(() => e.target.select());
    },
    [value],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    },
    [],
  );

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          type="text"
          inputMode="numeric"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            "pl-5 text-right tabular-nums h-8 text-sm bg-v2-card-tinted border-v2-ring-strong dark:border-v2-ring-strong",
            mode === "budget" && "pr-9",
          )}
        />
        {mode === "budget" && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            /mo
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ThreeAmountInputs({
  mode,
  values,
  onChange,
  className,
}: ThreeAmountInputsProps) {
  const handleSingleChange = useCallback(
    (index: number, newValue: number) => {
      const newValues = [...values] as [number, number, number];
      newValues[index] = newValue;
      onChange(newValues);
    },
    [values, onChange],
  );

  const labels =
    mode === "coverage"
      ? ["Low", "Mid", "High"]
      : ["Budget 1", "Budget 2", "Budget 3"];

  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      {values.map((value, idx) => (
        <AmountInput
          key={idx}
          value={value}
          onChange={(v) => handleSingleChange(idx, v)}
          label={labels[idx]}
          mode={mode}
        />
      ))}
    </div>
  );
}
