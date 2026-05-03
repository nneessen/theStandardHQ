// src/features/targets/components/TargetInputDialog.tsx

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Calculator, Target } from "lucide-react";

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-info" />
            {isFirstTime
              ? "Welcome to Your Targets Dashboard"
              : "Set Your Annual Income Target"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isFirstTime ? (
              <>
                Let's start by setting your commission income goal for{" "}
                {targetYear}. Everything else will be calculated automatically
                based on your historical data.
              </>
            ) : (
              <>
                Enter your annual commission income target for {targetYear}. All
                other metrics will be calculated automatically.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isFirstTime && (
            <div className="bg-info/10 border border-info/20 rounded-lg p-3 flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
              <div className="text-info">
                <strong>How it works:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>
                    • We'll use your historical commission rates and policy data
                  </li>
                  <li>
                    • Calculate how many policies you need to hit your target
                  </li>
                  <li>• Break it down by quarter, month, week, and day</li>
                  <li>• Show you exactly what you need to achieve</li>
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="annual-target" className="text-foreground">
              Annual Commission Income Target for {targetYear}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="annual-target"
                type="text"
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
                className="pl-7 text-lg font-semibold"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              This is your total commission income goal for the year, not
              including expenses.
            </p>
          </div>

          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  What we'll calculate for you:
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  <li>• Quarterly target: Annual ÷ 4</li>
                  <li>• Monthly target: Annual ÷ 12</li>
                  <li>
                    • Policies needed based on your average commission rate
                  </li>
                  <li>• Daily and weekly pace requirements</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !inputValue}>
            {isLoading ? "Saving..." : "Set Target"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
