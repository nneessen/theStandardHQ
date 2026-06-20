// src/features/policies/components/WizardStepIntro.tsx

import React from "react";

interface WizardStepIntroProps {
  title: string;
  children: React.ReactNode;
}

/**
 * The short intro line at the top of each wizard step — an Archivo title plus a
 * one-line description, so each step opens calm and oriented rather than as a
 * wall of fields.
 */
export const WizardStepIntro: React.FC<WizardStepIntroProps> = ({
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
