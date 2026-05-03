// src/features/policies/components/PolicyFormPolicySection.tsx

import React from "react";
import { FileText, Lock } from "lucide-react";
import { useFeatureAccess } from "@/hooks/subscription";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NewPolicyForm,
  PolicyStatus,
  PolicyLifecycleStatus,
  PaymentFrequency,
} from "../../../types/policy.types";
import { isToday } from "../hooks/usePolicyForm";

interface PolicyFormPolicySectionProps {
  formData: NewPolicyForm;
  displayErrors: Record<string, string>;
  policyId?: string;
  annualPremium: number;
  expectedCommission: number;
  productCommissionRates: Record<string, number>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (name: string, value: string) => void;
}

export const PolicyFormPolicySection: React.FC<
  PolicyFormPolicySectionProps
> = ({
  formData,
  displayErrors,
  policyId,
  annualPremium,
  expectedCommission,
  productCommissionRates,
  onInputChange,
  onSelectChange,
}) => {
  // Show lifecycle status dropdown only when status is approved
  const showLifecycleStatus = formData.status === "approved";

  // Commission details are a Pro feature
  const { hasAccess: canViewCommissions } = useFeatureAccess("dashboard");

  return (
    <div className="bg-card-tinted rounded-lg border border-border/80 dark:border-border/60 shadow-sm">
      {/* Section header strip */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30 dark:to-transparent border-b border-border/60 dark:border-border/40">
        <FileText className="h-3 w-3 text-warning" />
        <span className="text-[10px] font-semibold text-warning uppercase tracking-wider">
          Policy Details
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Identification Group */}
        <div className="space-y-2.5 p-2.5 rounded-md bg-background/80 dark:bg-card/40 border border-border dark:border-border/30">
          <p className="text-[9px] font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
            Identification
          </p>

          {/* Policy Number */}
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="policyNumber"
              className="text-[11px] text-muted-foreground"
            >
              Policy Number
            </Label>
            <Input
              id="policyNumber"
              type="text"
              name="policyNumber"
              value={formData.policyNumber}
              onChange={onInputChange}
              className={`h-8 text-[11px] bg-card-tinted ${displayErrors.policyNumber ? "border-destructive" : "border-input"}`}
              placeholder="POL-123456"
            />
            <span className="text-[10px] text-muted-foreground">
              Optional - leave blank if not yet assigned
            </span>
            {displayErrors.policyNumber && (
              <span className="text-[10px] text-destructive">
                {displayErrors.policyNumber}
              </span>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="submitDate"
                className="text-[11px] text-muted-foreground"
              >
                Submit Date *
              </Label>
              <Input
                id="submitDate"
                type="date"
                name="submitDate"
                value={formData.submitDate}
                onChange={onInputChange}
                className={`h-8 text-[11px] bg-card-tinted ${displayErrors.submitDate ? "border-destructive" : "border-input"}`}
              />
              {displayErrors.submitDate && (
                <span className="text-[10px] text-destructive">
                  {displayErrors.submitDate}
                </span>
              )}
              {!policyId &&
                isToday(formData.submitDate) &&
                !displayErrors.submitDate && (
                  <span className="text-[10px] text-warning">
                    Defaulted to today — change if entering an older policy
                  </span>
                )}
            </div>

            <div className="flex flex-col gap-1">
              <Label
                htmlFor="effectiveDate"
                className="text-[11px] text-muted-foreground"
              >
                Effective Date *
              </Label>
              <Input
                id="effectiveDate"
                type="date"
                name="effectiveDate"
                value={formData.effectiveDate}
                onChange={onInputChange}
                className={`h-8 text-[11px] bg-card-tinted ${displayErrors.effectiveDate ? "border-destructive" : "border-input"}`}
              />
              {displayErrors.effectiveDate && (
                <span className="text-[10px] text-destructive">
                  {displayErrors.effectiveDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Premium & Payment Group */}
        <div className="space-y-2.5 p-2.5 rounded-md bg-background/80 dark:bg-card/40 border border-border dark:border-border/30">
          <p className="text-[9px] font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
            Premium & Payment
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="premium"
                className="text-[11px] text-muted-foreground"
              >
                Premium Amount *
              </Label>
              <Input
                id="premium"
                type="number"
                inputMode="decimal"
                name="premium"
                value={formData.premium || ""}
                onChange={onInputChange}
                className={`h-8 text-[11px] bg-card-tinted ${displayErrors.premium ? "border-destructive" : "border-input"}`}
                placeholder="250.00"
                step="0.01"
                min="0"
              />
              {displayErrors.premium && (
                <span className="text-[10px] text-destructive">
                  {displayErrors.premium}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="paymentFrequency"
                className="text-[11px] text-muted-foreground"
              >
                Payment Frequency *
              </Label>
              <Select
                value={formData.paymentFrequency}
                onValueChange={(value) =>
                  onSelectChange("paymentFrequency", value as PaymentFrequency)
                }
              >
                <SelectTrigger
                  id="paymentFrequency"
                  className="h-8 text-[11px] border-input"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Status Group */}
        <div className="space-y-2.5 p-2.5 rounded-md bg-background/80 dark:bg-card/40 border border-border dark:border-border/30">
          <p className="text-[9px] font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
            Status
          </p>

          <div className={showLifecycleStatus ? "grid grid-cols-2 gap-2" : ""}>
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="status"
                className="text-[11px] text-muted-foreground"
              >
                Application Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => {
                  onSelectChange("status", value as PolicyStatus);
                  // Clear lifecycle status when changing to non-approved status
                  if (value !== "approved") {
                    onSelectChange("lifecycleStatus", "");
                  }
                }}
              >
                <SelectTrigger
                  id="status"
                  className="h-8 text-[11px] border-input"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground">
                Carrier decision on the application
              </span>
            </div>

            {showLifecycleStatus && (
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="lifecycleStatus"
                  className="text-[11px] text-muted-foreground"
                >
                  Policy Lifecycle
                </Label>
                <Select
                  value={formData.lifecycleStatus || "active"}
                  onValueChange={(value) =>
                    onSelectChange(
                      "lifecycleStatus",
                      value as PolicyLifecycleStatus,
                    )
                  }
                >
                  <SelectTrigger
                    id="lifecycleStatus"
                    className="h-8 text-[11px] border-input"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="lapsed">Lapsed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground">
                  Current state of the policy
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary Card — Pro feature */}
        {canViewCommissions ? (
          <div className="rounded-lg border border-border/60 dark:border-border/60 border-l-[3px] border-l-amber-500 dark:border-l-amber-400 bg-gradient-to-r from-amber-50/50 via-white to-white dark:from-amber-950/20 dark:via-zinc-800 dark:to-zinc-800 shadow-sm overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border dark:border-border/40">
              <p className="text-[9px] font-medium text-warning uppercase tracking-wider">
                Financial Summary
              </p>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-muted-foreground">Annual Premium</span>
                <strong className="text-[hsl(var(--info))] font-semibold font-mono">
                  ${annualPremium.toFixed(2)}
                </strong>
              </div>
              {(() => {
                const baseRate =
                  formData.productId &&
                  productCommissionRates[formData.productId]
                    ? productCommissionRates[formData.productId] * 100
                    : formData.commissionPercentage;
                const effectiveRate = formData.commissionPercentage;
                const hasTermAdjustment =
                  Math.abs(baseRate - effectiveRate) > 0.001;

                if (hasTermAdjustment) {
                  return (
                    <>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground">
                          Product Comp
                        </span>
                        <strong className="text-foreground font-semibold">
                          {baseRate.toFixed(2)}%
                        </strong>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground text-[10px]">
                          Effective Rate (term-adjusted)
                        </span>
                        <strong className="text-warning font-semibold">
                          {effectiveRate.toFixed(2)}%
                        </strong>
                      </div>
                    </>
                  );
                }

                return (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">
                      Commission Rate
                    </span>
                    <strong className="text-foreground font-semibold">
                      {baseRate.toFixed(2)}%
                    </strong>
                  </div>
                );
              })()}
              <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-border dark:border-border/40">
                <span className="text-muted-foreground">
                  Expected Advance (9 mo)
                </span>
                <strong className="text-success font-semibold font-mono">
                  ${expectedCommission.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 dark:border-border/60 border-l-[3px] border-l-zinc-300 dark:border-l-zinc-600 bg-background/50 dark:bg-card-tinted/50 shadow-sm overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border dark:border-border/40">
              <p className="text-[9px] font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                Financial Summary
              </p>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-muted-foreground">Annual Premium</span>
                <strong className="text-[hsl(var(--info))] font-semibold font-mono">
                  ${annualPremium.toFixed(2)}
                </strong>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground dark:text-muted-foreground pt-1.5 border-t border-border dark:border-border/40">
                <Lock className="h-3 w-3" />
                <span>Commission details available on Pro plan</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
