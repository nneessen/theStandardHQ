// src/features/policies/components/PolicyFormFinancialSection.tsx

import React from "react";
import { Coins, Calculator } from "lucide-react";
import { useFeatureAccess } from "@/hooks/subscription";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewPolicyForm } from "../../../types/policy.types";
import { PolicySectionHeader } from "./PolicySectionHeader";
import { PolicyMoneyPanel } from "./PolicyMoneyPanel";
import {
  FIELD,
  LABEL,
  HELPER,
  ERROR_TEXT,
  fieldClass,
} from "./policyFormStyles";

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

/**
 * Compensation rail (Direction B — Two-Pane Linear). Lives in the sticky right
 * rail, OUT of the main field flow, because comp *feeds* the summary so they
 * belong together. Two stacked groups:
 *
 *   1. Compensation — the agent's read-only contract level + the editable
 *      Product Comp % and optional flat Advance $ override.
 *   2. Financial summary — the computed MoneyPanel (annual premium / commission
 *      rate / green expected-advance hero), which never reads as an input.
 *
 * Commission detail is a Pro feature: without access we show only the locked
 * summary (annual premium + upsell), no comp inputs — preserving prior behavior.
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

  // Commission details are a Pro feature.
  const { hasAccess: canViewCommissions } = useFeatureAccess("dashboard");

  if (!canViewCommissions) {
    return (
      <div className="space-y-3">
        <PolicySectionHeader
          icon={Calculator}
          label="Financial summary"
          tone="success"
        />
        <PolicyMoneyPanel
          annualPremium={annualPremium}
          commissionPercentage={formData.commissionPercentage || 0}
          expectedCommission={expectedCommission}
          usingManualAdvance={usingManualAdvance}
          locked
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Compensation (inputs) ─────────────────────────────────────── */}
      <div className="space-y-3">
        <PolicySectionHeader icon={Coins} label="Compensation" />

        {/* Read-only confirmation of the agent's stored contract level. It is NOT
            multiplied into the rate — the Product Comp % the agent enters is the
            rate the advance is calculated from. */}
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
              className={fieldClass(!!displayErrors.commissionPercentage)}
              placeholder="100"
              step="0.01"
              min="0"
              max="200"
            />
            {displayErrors.commissionPercentage && (
              <span className={ERROR_TEXT}>
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
        <p className={HELPER}>
          Enter the product comp % — the advance is calculated from it. Your
          contract level above is already saved in your profile.
          {!policyId && " Or type a flat advance to override."}
        </p>
      </div>

      {/* ─── Financial summary (computed) ──────────────────────────────── */}
      <div className="space-y-3">
        <PolicySectionHeader
          icon={Calculator}
          label="Financial summary"
          tone="success"
        />
        <PolicyMoneyPanel
          annualPremium={annualPremium}
          commissionPercentage={formData.commissionPercentage || 0}
          expectedCommission={expectedCommission}
          usingManualAdvance={usingManualAdvance}
        />
      </div>
    </div>
  );
};
