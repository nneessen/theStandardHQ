// src/features/policies/components/WizardStepPremiumComp.tsx

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewPolicyForm, PaymentFrequency } from "../../../types/policy.types";
import { WizardStepIntro } from "./WizardStepIntro";
import {
  FIELD,
  LABEL,
  HELPER,
  ERROR_TEXT,
  fieldClass,
} from "./policyFormStyles";

interface WizardStepPremiumCompProps {
  formData: NewPolicyForm;
  displayErrors: Record<string, string>;
  policyId?: string;
  /** Pro gate — when false the comp inputs are hidden (rail shows the upsell). */
  canViewCommissions: boolean;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSelectChange: (name: string, value: string) => void;
}

/** Step 3 of the wizard — premium, your comp, and any notes. */
export const WizardStepPremiumComp: React.FC<WizardStepPremiumCompProps> = ({
  formData,
  displayErrors,
  policyId,
  canViewCommissions,
  onInputChange,
  onSelectChange,
}) => {
  return (
    <div className="space-y-5">
      <WizardStepIntro title="Premium & your comp">
        Enter the premium and how it's paid. Your running advance estimate
        updates on the right as you type.
      </WizardStepIntro>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="premium" className={LABEL}>
            Premium amount <span className="text-destructive">*</span>
          </Label>
          {/* `$` prefix so the figure reads as money, not a bare number. */}
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="premium"
              type="number"
              inputMode="decimal"
              name="premium"
              value={formData.premium || ""}
              onChange={onInputChange}
              className={`${fieldClass(!!displayErrors.premium)} pl-7`}
              placeholder="250.00"
              step="0.01"
              min="0"
            />
          </div>
          {displayErrors.premium && (
            <span className={ERROR_TEXT}>{displayErrors.premium}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentFrequency" className={LABEL}>
            Payment frequency <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.paymentFrequency}
            onValueChange={(value) =>
              onSelectChange("paymentFrequency", value as PaymentFrequency)
            }
          >
            <SelectTrigger id="paymentFrequency" className={FIELD}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              {/* DB-enum form `semi_annual` preserved exactly (changing it is a
                  money-math + enum-contract fix, not part of this redesign). */}
              <SelectItem value="semi_annual">Semi-Annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {canViewCommissions && (
        <div className="space-y-3 border-t border-border/40 pt-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commissionPercentage" className={LABEL}>
                Product comp %
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
            contract level (shown on the right) is already saved in your
            profile.
            {!policyId && " Or type a flat advance to override."}
          </p>
        </div>
      )}

      <div className="space-y-1.5 border-t border-border/40 pt-5">
        <Label htmlFor="notes" className={LABEL}>
          Notes{" "}
          <span className="text-[10px] font-normal text-muted-foreground">
            optional
          </span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={onInputChange}
          rows={3}
          placeholder="Add any context — underwriting notes, client preferences, follow-ups…"
          className="min-h-[88px] resize-y rounded-xl border-border/60 bg-background text-[15px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.30)] focus:border-accent"
        />
      </div>
    </div>
  );
};
