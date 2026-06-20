// src/features/policies/components/PolicyFormPolicySection.tsx

import React from "react";
import { FileText, CreditCard, Activity } from "lucide-react";
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
import { PolicySectionHeader } from "./PolicySectionHeader";
import {
  FIELD,
  LABEL,
  HELPER,
  ERROR_TEXT,
  fieldClass,
} from "./policyFormStyles";

interface PolicyFormPolicySectionProps {
  formData: NewPolicyForm;
  displayErrors: Record<string, string>;
  policyId?: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (name: string, value: string) => void;
}

/**
 * Policy · Premium & Payment · Status groups — the lower half of the Direction B
 * left column. Same section-header + recessed-well treatment as the Client/
 * Product groups above. The computed Financial Summary lives in the right rail
 * (PolicyFormFinancialSection), never inline with these inputs.
 */
export const PolicyFormPolicySection: React.FC<
  PolicyFormPolicySectionProps
> = ({ formData, displayErrors, policyId, onInputChange, onSelectChange }) => {
  // Show lifecycle status dropdown only when status is approved
  const showLifecycleStatus = formData.status === "approved";

  return (
    <div className="flex flex-col gap-8">
      {/* ─── Policy ────────────────────────────────────────────────────── */}
      <div className="space-y-3.5">
        <PolicySectionHeader icon={FileText} label="Policy" />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="policyNumber" className={LABEL}>
            Policy number{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              optional
            </span>
          </Label>
          <Input
            id="policyNumber"
            type="text"
            name="policyNumber"
            value={formData.policyNumber}
            onChange={onInputChange}
            className={fieldClass(!!displayErrors.policyNumber)}
            placeholder="POL-123456"
          />
          <span className={HELPER}>Leave blank if not yet assigned</span>
          {displayErrors.policyNumber && (
            <span className={ERROR_TEXT}>{displayErrors.policyNumber}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="submitDate" className={LABEL}>
              Submit date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="submitDate"
              type="date"
              name="submitDate"
              value={formData.submitDate}
              onChange={onInputChange}
              className={`${fieldClass(!!displayErrors.submitDate)} font-mono`}
            />
            {displayErrors.submitDate && (
              <span className={ERROR_TEXT}>{displayErrors.submitDate}</span>
            )}
            {!policyId &&
              isToday(formData.submitDate) &&
              !displayErrors.submitDate && (
                <span className="text-[11px] text-accent">
                  Defaulted to today — change if entering an older policy
                </span>
              )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="effectiveDate" className={LABEL}>
              Effective date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="effectiveDate"
              type="date"
              name="effectiveDate"
              value={formData.effectiveDate}
              onChange={onInputChange}
              className={`${fieldClass(!!displayErrors.effectiveDate)} font-mono`}
            />
            {displayErrors.effectiveDate && (
              <span className={ERROR_TEXT}>{displayErrors.effectiveDate}</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Premium & Payment ─────────────────────────────────────────── */}
      <div className="space-y-3.5">
        <PolicySectionHeader icon={CreditCard} label="Premium & Payment" />

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
                {/* NOTE: value is the DB-enum form `semi_annual` (preserved
                    exactly — changing it is a money-math + enum-contract fix
                    that belongs in its own change, not this redesign). */}
                <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ─── Status ────────────────────────────────────────────────────── */}
      <div className="space-y-3.5">
        <PolicySectionHeader icon={Activity} label="Status" />

        <div className={showLifecycleStatus ? "grid grid-cols-2 gap-3" : ""}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status" className={LABEL}>
              Application status
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
              <SelectTrigger id="status" className={FIELD}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
            <span className={HELPER}>Carrier decision on the application</span>
          </div>

          {showLifecycleStatus && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lifecycleStatus" className={LABEL}>
                Policy lifecycle
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
                <SelectTrigger id="lifecycleStatus" className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="lapsed">Lapsed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <span className={HELPER}>Current state of the policy</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
