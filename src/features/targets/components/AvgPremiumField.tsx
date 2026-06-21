// src/features/targets/components/AvgPremiumField.tsx
//
// The "Premium Stat / Avg Premium" control, shared by the Targets Advanced
// realism panel and the Simple view. Lets each agent set their OWN average
// premium override (drives the divisor in both plans), or fall back to the
// computed cohort average via the Mean/Median toggle.
//
//  - Override active  → editable $ input + "Use auto" (clears to null).
//  - No override      → Mean/Median toggle + "Set custom $" affordance.
//
// State lives in the parent (override on user_targets, premiumStat in realism);
// this component only renders + calls back.

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AvgPremiumFieldProps {
  /** Active per-agent override value (> 0) or undefined when not set. */
  override: number | undefined;
  premiumStat: "mean" | "median";
  onPremiumStatChange: (stat: "mean" | "median") => void;
  /** Persist the override; pass null to clear it back to the computed cohort. */
  onSaveOverride: (value: number | null) => void;
  className?: string;
}

export function AvgPremiumField({
  override,
  premiumStat,
  onPremiumStatChange,
  onSaveOverride,
  className,
}: AvgPremiumFieldProps) {
  const hasOverride = !!override && override > 0;
  // When no override is set, the user can click "Set custom $" to reveal the
  // input without immediately writing a value.
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<string>(
    hasOverride ? String(override) : "",
  );

  const commit = () => {
    const parsed = parseFloat(draft.replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 0) {
      onSaveOverride(parsed);
      setAdding(false);
    } else {
      // Empty / invalid clears back to auto.
      onSaveOverride(null);
      setAdding(false);
      setDraft("");
    }
  };

  const showInput = hasOverride || adding;

  return (
    <label className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] text-muted-foreground">
        {hasOverride ? "Avg Premium (your override)" : "Premium Stat"}
      </span>

      {showInput ? (
        <>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              step={100}
              value={draft}
              autoFocus={adding && !hasOverride}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft(hasOverride ? String(override) : "");
                }
              }}
              onBlur={commit}
              aria-label="Average premium override"
              className="h-7 text-[13px] font-mono px-2"
            />
          </div>
          <button
            type="button"
            className="mt-0.5 self-start text-[10px] text-muted-foreground/80 underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              onSaveOverride(null);
              setAdding(false);
              setDraft("");
            }}
          >
            Use auto ({premiumStat})
          </button>
        </>
      ) : (
        <>
          <div className="flex h-7 rounded-v2-pill border border-border overflow-hidden">
            <button
              type="button"
              className={cn(
                "flex-1 text-[11px] font-medium transition-colors",
                premiumStat === "median"
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onPremiumStatChange("median")}
            >
              Median
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 text-[11px] font-medium transition-colors border-l border-border",
                premiumStat === "mean"
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onPremiumStatChange("mean")}
            >
              Mean
            </button>
          </div>
          <button
            type="button"
            className="mt-0.5 self-start text-[10px] text-muted-foreground/80 underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              setAdding(true);
              setDraft("");
            }}
          >
            Set custom $ premium
          </button>
        </>
      )}
    </label>
  );
}
