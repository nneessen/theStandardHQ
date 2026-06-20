// src/features/policies/components/PolicyMoneyPanel.tsx

import React from "react";
import { Lock } from "lucide-react";

interface PolicyMoneyPanelProps {
  /** Annualized premium (premium × frequency multiplier). */
  annualPremium: number;
  /** Product comp the agent entered, as a whole number (e.g. 95 for 95%). */
  commissionPercentage: number;
  /** Resolved advance: the manual override when present, else the 9-mo figure. */
  expectedCommission: number;
  /** True when a flat-dollar advance override replaces the %-derived advance. */
  usingManualAdvance: boolean;
  /**
   * Pro gate. When locked, only the annual premium is shown (commission detail
   * is a paid feature) — the computed rate/advance are hidden.
   */
  locked?: boolean;
}

/**
 * The computed Financial Summary — a visually distinct inset tile that reads as
 * a *readout*, never an editable field. This separation (math out of the input
 * flow, green hero for the advance) is the core of the Direction B redesign: the
 * commission math no longer looks like another field to fill in.
 *
 * Currency is rendered with a plain `$X.XX` (no thousands separators) to match
 * the rest of the form and the existing financial-summary test fixtures.
 */
export const PolicyMoneyPanel: React.FC<PolicyMoneyPanelProps> = ({
  annualPremium,
  commissionPercentage,
  expectedCommission,
  usingManualAdvance,
  locked = false,
}) => {
  if (locked) {
    return (
      <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 shadow-inner">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Annual premium</span>
          <strong className="font-mono text-sm font-semibold text-info">
            ${annualPremium.toFixed(2)}
          </strong>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Commission details available on Pro plan</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 shadow-inner">
      {/* Annual premium */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Annual premium</span>
        <strong className="font-mono text-sm font-semibold text-info">
          ${annualPremium.toFixed(2)}
        </strong>
      </div>

      {/* Commission rate (or a note when a flat advance overrides the %) */}
      <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2.5">
        <span className="text-xs text-muted-foreground">Commission rate</span>
        {usingManualAdvance ? (
          <span className="text-[11px] italic text-muted-foreground">
            flat advance entered
          </span>
        ) : (
          <strong className="text-sm font-semibold text-foreground tabular-nums">
            {commissionPercentage.toFixed(2)}%
          </strong>
        )}
      </div>

      {/* Hero — the expected advance, the number agents care about most. */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {usingManualAdvance
            ? "Expected Advance (manual)"
            : "Expected Advance (9 mo)"}
        </span>
        <strong className="font-display text-xl font-extrabold text-success tabular-nums">
          ${expectedCommission.toFixed(2)}
        </strong>
      </div>
    </div>
  );
};
