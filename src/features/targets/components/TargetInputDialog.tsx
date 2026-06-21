// src/features/targets/components/TargetInputDialog.tsx
//
// Set / edit the annual commission income target. Styled to match the rest of
// the app (v2 board surfaces): eyebrow cap, bold display title, one prominent
// $ input, a compact "what gets calculated" panel, and PillButton actions.
// Used for BOTH first-time setup and later edits (opened from the obvious
// "Edit Goal" button in the Targets header).

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PillButton } from "@/components/v2";
import { TrendingUp, Calculator, Target, AlertCircle } from "lucide-react";

interface TargetInputDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (annualTarget: number) => Promise<void>;
  currentTarget?: number;
  isFirstTime?: boolean;
}

export function TargetInputDialog({
  open,
  onClose,
  onSave,
  currentTarget = 0,
  isFirstTime = false,
}: TargetInputDialogProps) {
  const [inputValue, setInputValue] = useState<string>(
    currentTarget > 0 ? currentTarget.toString() : "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // If we're in Q4 (Oct-Dec), suggest next year's target
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const isQ4 = currentMonth >= 9; // October, November, December
  const targetYear = isQ4 ? now.getFullYear() + 1 : now.getFullYear();

  const handleSubmit = async () => {
    const value = parseFloat(inputValue.replace(/,/g, ""));

    if (isNaN(value) || value <= 0) {
      setError("Please enter a valid income target greater than 0");
      return;
    }

    if (value < 10000) {
      setError("Income target should be at least $10,000");
      return;
    }

    if (value > 10000000) {
      setError("Income target seems too high. Please verify the amount.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await onSave(value);
      onClose();
    } catch (_err) {
      setError("Failed to save target. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatInputValue = (value: string) => {
    // Remove non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, "");

    // Add thousand separators for display
    if (numericValue) {
      const parts = numericValue.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return parts.join(".");
    }
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] gap-0 overflow-hidden p-0">
        {/* ── Header band ──────────────────────────────────────────────── */}
        <DialogHeader className="space-y-1.5 border-b border-border bg-muted/30 px-5 py-4 text-left">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Income Plan · {targetYear}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {isFirstTime ? "Set your income goal" : "Edit your income goal"}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
            {isFirstTime
              ? `Set your commission income goal for ${targetYear}. Everything else — policies, apps to write, and pace — is calculated automatically from your book.`
              : `Update your annual commission income target for ${targetYear}. Every other target recalculates automatically.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          {/* ── The one input that matters ──────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="annual-target"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Annual commission income target
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                $
              </span>
              <Input
                id="annual-target"
                type="text"
                inputMode="numeric"
                value={formatInputValue(inputValue)}
                onChange={(e) =>
                  setInputValue(e.target.value.replace(/,/g, ""))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    handleSubmit();
                  }
                }}
                placeholder="400,000"
                className="h-12 pl-8 text-2xl font-bold tabular-nums"
                autoFocus
              />
            </div>
            {error ? (
              <div className="flex items-center gap-1.5 text-[12px] text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Your total commission income goal for the year — before
                expenses.
              </p>
            )}
          </div>

          {/* ── What gets calculated ────────────────────────────────────── */}
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Calculated for you
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-foreground/80">
              <li>• Quarterly &amp; monthly targets</li>
              <li>• Policies &amp; apps to write</li>
              <li>• Daily / weekly pace</li>
              <li>• Realistic vs. optimistic plans</li>
            </ul>
          </div>

          {isFirstTime && (
            <div className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 p-3">
              <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Uses your historical commission rates and policy data to turn
                this goal into a concrete monthly activity plan.
              </p>
            </div>
          )}
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <DialogFooter className="gap-2 border-t border-border px-5 py-3">
          <PillButton tone="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </PillButton>
          <PillButton
            tone="black"
            onClick={handleSubmit}
            disabled={isLoading || !inputValue}
            leadingIcon={<Target className="h-3.5 w-3.5" />}
          >
            {isLoading ? "Saving…" : isFirstTime ? "Set goal" : "Save goal"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
