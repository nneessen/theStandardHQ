// src/features/policies/components/PolicyWizardStepper.tsx

import React from "react";
import { Check } from "lucide-react";

interface PolicyWizardStepperProps {
  /** Ordered step labels. */
  steps: string[];
  /** Index of the active step. */
  current: number;
  /** Highest step reached so far — steps up to here are clickable (back/jump). */
  furthest: number;
  onStepClick: (index: number) => void;
}

/**
 * Wizard stepper (Direction A — Guided Wizard). Numbered circles across the top:
 * the active step is blue with a glow ring, completed steps show a green check,
 * and the connector lines turn green as you pass them. Visited steps are
 * clickable so the Review step's "edit-jumps" (and plain back-nav) work.
 */
export const PolicyWizardStepper: React.FC<PolicyWizardStepperProps> = ({
  steps,
  current,
  furthest,
  onStepClick,
}) => {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const completed = i < current;
        const active = i === current;
        const reachable = i <= furthest;

        return (
          <React.Fragment key={label}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onStepClick(i)}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 ${reachable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={[
                  "flex h-7 w-7 flex-none items-center justify-center rounded-full border font-mono text-[12px] font-semibold transition-all",
                  completed
                    ? "border-success bg-success/15 text-success"
                    : active
                      ? "border-accent bg-accent/15 text-accent ring-4 ring-accent/15"
                      : "border-border/70 bg-background text-muted-foreground",
                ].join(" ")}
              >
                {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={[
                  "hidden whitespace-nowrap text-[12px] font-medium transition-colors sm:inline",
                  active
                    ? "text-foreground"
                    : completed
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70",
                ].join(" ")}
              >
                {label}
              </span>
            </button>

            {i < steps.length - 1 && (
              <span
                className={`mx-2.5 h-px min-w-[16px] flex-1 transition-colors ${
                  i < current ? "bg-success/50" : "bg-border/60"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
