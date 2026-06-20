// src/features/policies/components/PolicyRunningEstimate.tsx

import React from "react";
import { Calculator } from "lucide-react";
import { PolicySectionHeader } from "./PolicySectionHeader";
import { PolicyMoneyPanel } from "./PolicyMoneyPanel";

interface PolicyRunningEstimateProps {
  annualPremium: number;
  commissionPercentage: number;
  expectedCommission: number;
  usingManualAdvance: boolean;
  /** Agent's stored contract level (read-only confirmation). `null` if unset. */
  contractLevel: number | null;
  contractLevelLoading?: boolean;
  /** Pro gate — when false, only the annual premium shows (no comp detail). */
  canViewCommissions: boolean;
}

/**
 * The persistent "Running estimate" rail (Direction A — Guided Wizard). Stays
 * pinned beside every step so the contract level and the live money panel
 * (annual premium / commission rate / green expected-advance hero) are always
 * visible without crowding the per-step inputs.
 */
export const PolicyRunningEstimate: React.FC<PolicyRunningEstimateProps> = ({
  annualPremium,
  commissionPercentage,
  expectedCommission,
  usingManualAdvance,
  contractLevel,
  contractLevelLoading = false,
  canViewCommissions,
}) => {
  return (
    <div className="space-y-3">
      <PolicySectionHeader
        icon={Calculator}
        label="Running estimate"
        tone="success"
      />

      {canViewCommissions && (
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
          <span className="text-xs text-muted-foreground">
            Your contract level
          </span>
          {contractLevelLoading ? (
            <span className="font-mono text-sm text-muted-foreground">…</span>
          ) : contractLevel != null ? (
            <span className="font-mono text-sm font-semibold text-foreground">
              {contractLevel}
            </span>
          ) : (
            <span className="text-[11px] italic text-muted-foreground">
              Not set — add it in Settings
            </span>
          )}
        </div>
      )}

      <PolicyMoneyPanel
        annualPremium={annualPremium}
        commissionPercentage={commissionPercentage}
        expectedCommission={expectedCommission}
        usingManualAdvance={usingManualAdvance}
        locked={!canViewCommissions}
      />

      {canViewCommissions && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Updates live as you fill in the form. The advance is a 9-month
          estimate from the product comp %.
        </p>
      )}
    </div>
  );
};
