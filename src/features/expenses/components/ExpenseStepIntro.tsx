// src/features/expenses/components/ExpenseStepIntro.tsx

import React from "react";

interface ExpenseStepIntroProps {
  title: string;
  children: React.ReactNode;
}

/**
 * The short intro line at the top of each wizard step — a title plus a one-line
 * description, so each step opens calm and oriented rather than as a wall of
 * fields. This is the core fix for "the agent doesn't know what to input".
 */
export const ExpenseStepIntro: React.FC<ExpenseStepIntroProps> = ({
  title,
  children,
}) => (
  <div className="space-y-1">
    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
      {title}
    </h3>
    <p className="text-sm text-muted-foreground">{children}</p>
  </div>
);
