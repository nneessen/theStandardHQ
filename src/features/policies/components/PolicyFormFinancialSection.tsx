// src/features/policies/components/PolicyFormFinancialSection.tsx

import React from "react";
import { Lock } from "lucide-react";
import { Cap } from "@/components/board";
import { useFeatureAccess } from "@/hooks/subscription";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewPolicyForm } from "../../../types/policy.types";

interface PolicyFormFinancialSectionProps {
  formData: NewPolicyForm;
  displayErrors: Record<string, string>;
  policyId?: string;
  annualPremium: number;
  expectedCommission: number;
  /** Agent's stored contract level (read-only confirmation). `null` if unset. */
  contractLevel: number | null;
  contractLevelLoading?: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FIELD = "h-9 text-sm bg-background border-border/60 focus:border-accent";
const LABEL = "text-xs text-muted-foreground";

/**
 * Computed Financial Summary column. Re-skinned from the old amber-gradient card
 * to "The Board" charcoal language: a flat recessed panel with mono-cap header,
 * soft hairlines, and semantic (blue/green) figures — no amber, no hard borders.
 */
export const PolicyFormFinancialSection: React.FC<
  PolicyFormFinancialSectionProps
> = ({
  formData,
  displayErrors,
  policyId,
  annualPremium,
  expectedCommission,
  contractLevel,
  contractLevelLoading = false,
  onInputChange,
}) => {
  // Whether the agent typed a flat-dollar advance that overrides the % math.
  const usingManualAdvance =
    !!formData.manualAdvanceAmount && formData.manualAdvanceAmount > 0;

  // Commission details are a Pro feature
  const { hasAccess: canViewCommissions } = useFeatureAccess("dashboard");

  if (!canViewCommissions) {
    return (
      <div className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-3">
        <Cap style={{ fontSize: 11 }}>Financial Summary</Cap>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Annual Premium</span>
          <strong className="font-semibold font-mono text-[hsl(var(--info))]">
            ${annualPremium.toFixed(2)}
          </strong>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t border-border/40">
          <Lock className="h-3 w-3" />
          <span>Commission details available on Pro plan</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-3.5">
      <Cap style={{ fontSize: 11 }}>Financial Summary</Cap>

      {/* Read-only confirmation of the agent's stored contract level. It is NOT
          multiplied into the rate — the Product Comp % the agent enters is the
          rate the advance is calculated from. */}
      <div className="flex items-center justify-between rounded-md border border-border/50 bg-background px-3 py-2">
        <span className="text-xs text-muted-foreground">
          Your contract level
        </span>
        {contractLevelLoading ? (
          <span className="text-sm text-muted-foreground font-mono">…</span>
        ) : contractLevel != null ? (
          <span className="text-sm font-semibold text-foreground font-mono">
            {contractLevel}
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground">
            Not set — add it in Settings
          </span>
        )}
      </div>

      {/* Manual commission entry — the agent enters the PRODUCT comp, which is
          the rate the advance is calculated from. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commissionPercentage" className={LABEL}>
            Product Comp %
          </Label>
          <Input
            id="commissionPercentage"
            type="number"
            inputMode="decimal"
            name="commissionPercentage"
            value={formData.commissionPercentage || ""}
            onChange={onInputChange}
            className={`${FIELD} ${displayErrors.commissionPercentage ? "border-destructive" : ""}`}
            placeholder="100"
            step="0.01"
            min="0"
            max="200"
          />
          {displayErrors.commissionPercentage && (
            <span className="text-[11px] text-destructive">
              {displayErrors.commissionPercentage}
            </span>
          )}
        </div>
        {!policyId && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manualAdvanceAmount" className={LABEL}>
              Advance $ (optional)
            </Label>
            <Input
              id="manualAdvanceAmount"
              type="number"
              inputMode="decimal"
              name="manualAdvanceAmount"
              value={formData.manualAdvanceAmount || ""}
              onChange={onInputChange}
              className={FIELD}
              placeholder="auto"
              step="0.01"
              min="0"
            />
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Enter the product comp % — the advance is calculated from it. Your
        contract level above is already saved in your profile, so you don't need
        to re-enter it.
        {!policyId && " Or type a flat advance to override."}
      </p>

      <div className="flex justify-between items-center text-sm pt-2.5 border-t border-border/40">
        <span className="text-muted-foreground">Annual Premium</span>
        <strong className="text-[hsl(var(--info))] font-semibold font-mono">
          ${annualPremium.toFixed(2)}
        </strong>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Commission Rate</span>
        {usingManualAdvance ? (
          <span className="text-xs italic text-muted-foreground">
            flat advance entered
          </span>
        ) : (
          <strong className="text-foreground font-semibold">
            {(formData.commissionPercentage || 0).toFixed(2)}%
          </strong>
        )}
      </div>
      <div className="flex justify-between items-center text-sm pt-2.5 border-t border-border/40">
        <span className="text-muted-foreground">
          {usingManualAdvance
            ? "Expected Advance (manual)"
            : "Expected Advance (9 mo)"}
        </span>
        <strong className="text-success font-semibold font-mono text-base">
          ${expectedCommission.toFixed(2)}
        </strong>
      </div>
    </div>
  );
};
