// src/features/targets/components/PercentInput.tsx
//
// Number input for a 0–100 percent value backed by a 0–1 decimal in parent
// state. Holds its own local string state so the user can fully clear the
// field while editing — controlled-input parsing (`parseFloat("")` → NaN)
// would otherwise refuse to commit an empty string and the last char would
// pop right back in. On blur, falls back to the parent's saved value if the
// string is empty or out of range.
//
// Shared by the Targets Advanced realism panel and the Simple view's compact
// knobs so both edit the same decimal state identically.

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

export function PercentInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  "aria-label": ariaLabel,
}: {
  value: number; // decimal 0-1
  onChange: (next: number) => void; // decimal 0-1
  min: number; // percent (e.g. 0)
  max: number; // percent (e.g. 100)
  step?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const [local, setLocal] = useState(() => (value * 100).toFixed(0));
  const isFocusedRef = useRef(false);

  // Sync from parent only while NOT focused, so external resets (e.g. the
  // "Reset to defaults" button or DB hydration) propagate without stomping
  // on in-flight typing.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocal((value * 100).toFixed(0));
    }
  }, [value]);

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      value={local}
      aria-label={ariaLabel}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        const str = e.target.value;
        setLocal(str); // always reflect what user typed, including ""
        if (str === "") return; // allow temporary empty state
        const v = parseFloat(str);
        if (!isNaN(v) && v >= min && v <= max) {
          onChange(v / 100);
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        setLocal((value * 100).toFixed(0));
      }}
      className={className}
    />
  );
}
