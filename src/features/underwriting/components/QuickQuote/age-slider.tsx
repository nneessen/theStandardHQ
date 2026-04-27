// src/features/underwriting/components/QuickQuote/age-slider.tsx

import { useState, useCallback, useEffect, useRef } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

interface AgeSliderProps {
  value: number;
  onChange: (age: number) => void;
  min?: number;
  max?: number;
}

const CLAMP_MIN = 18;
const CLAMP_MAX = 89;

/** Major tick positions for visual reference */
const TICKS = [20, 30, 40, 50, 60, 70, 80, 89];

/**
 * Combined age slider + editable number badge.
 * Click the badge to type a value directly.
 */
export function AgeSlider({
  value,
  onChange,
  min = CLAMP_MIN,
  max = CLAMP_MAX,
}: AgeSliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const parsed = parseInt(editValue, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
  }, [editValue, onChange, min, max]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(value.toString());
  }, [value]);

  const handleBadgeClick = useCallback(() => {
    setEditValue(value.toString());
    setIsEditing(true);
  }, [value]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setEditValue(raw);
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= min && parsed <= max) {
        onChange(parsed);
      }
    },
    [onChange, min, max],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );

  const range = max - min;

  return (
    <div className="flex items-center gap-2.5">
      {/* Custom-styled slider with visible track & ticks */}
      <div className="relative w-[200px] pt-0.5 pb-3">
        <SliderPrimitive.Root
          min={min}
          max={max}
          step={1}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="relative flex w-full touch-none select-none items-center h-5"
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-v2-ring dark:bg-v2-ring-strong">
            <SliderPrimitive.Range className="absolute h-full bg-zinc-600 dark:bg-zinc-400" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-v2-ring-strong dark:border-v2-ring-strong bg-v2-card-tinted shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-ring-strong focus-visible:ring-offset-1 hover:border-v2-ink dark:hover:border-v2-ring cursor-grab active:cursor-grabbing" />
        </SliderPrimitive.Root>

        {/* Tick marks */}
        <div className="absolute bottom-0 left-0 right-0 h-2.5 pointer-events-none">
          {TICKS.map((tick) => {
            const pct = ((tick - min) / range) * 100;
            return (
              <div
                key={tick}
                className="absolute flex flex-col items-center"
                style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
              >
                <div className="w-px h-1 bg-v2-ring-strong dark:bg-v2-ring-strong" />
                <span className="text-[8px] tabular-nums text-v2-ink-subtle dark:text-v2-ink-muted leading-none mt-px">
                  {tick}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editable age badge */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min={min}
          max={max}
          value={editValue}
          onChange={handleInputChange}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="h-7 w-10 rounded-md border border-v2-ring-strong dark:border-v2-ring-strong bg-v2-card-tinted text-center text-xs font-semibold tabular-nums outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <button
          type="button"
          onClick={handleBadgeClick}
          className="h-7 min-w-[36px] px-1.5 rounded-md bg-v2-card-tinted dark:bg-v2-card-tinted border border-v2-ring dark:border-v2-ring-strong text-xs font-semibold tabular-nums text-v2-ink dark:text-v2-ink-muted hover:bg-v2-ring dark:hover:bg-v2-ring-strong transition-colors cursor-text"
          title="Click to type age"
        >
          {value}
        </button>
      )}
    </div>
  );
}
