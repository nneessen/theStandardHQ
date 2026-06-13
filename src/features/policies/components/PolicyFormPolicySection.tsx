// src/features/policies/components/PolicyFormPolicySection.tsx

import React from "react";
import { Cap } from "@/components/board";
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
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (name: string, value: string) => void;
}

const FIELD = "h-9 text-sm bg-background border-border/60 focus:border-accent";
const LABEL = "text-xs text-muted-foreground";

/**
 * Policy "core" column: identification, premium & payment, and status. Styled
 * to "The Board" language (flat, mono-cap group labels, soft hairline dividers,
 * recessed fields). The computed Financial Summary lives in its own column
 * (PolicyFormFinancialSection).
 */
export const PolicyFormPolicySection: React.FC<
  PolicyFormPolicySectionProps
> = ({ formData, displayErrors, policyId, onInputChange, onSelectChange }) => {
  // Show lifecycle status dropdown only when status is approved
  const showLifecycleStatus = formData.status === "approved";

  return (
    <div className="flex flex-col gap-5">
      {/* Identification */}
      <div className="space-y-3">
        <Cap style={{ fontSize: 11 }}>Identification</Cap>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="policyNumber" className={LABEL}>
            Policy Number
          </Label>
          <Input
            id="policyNumber"
            type="text"
            name="policyNumber"
            value={formData.policyNumber}
            onChange={onInputChange}
            className={`${FIELD} ${displayErrors.policyNumber ? "border-destructive" : ""}`}
            placeholder="POL-123456"
          />
          <span className="text-[11px] text-muted-foreground">
            Optional — leave blank if not yet assigned
          </span>
          {displayErrors.policyNumber && (
            <span className="text-[11px] text-destructive">
              {displayErrors.policyNumber}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="submitDate" className={LABEL}>
              Submit Date *
            </Label>
            <Input
              id="submitDate"
              type="date"
              name="submitDate"
              value={formData.submitDate}
              onChange={onInputChange}
              className={`${FIELD} ${displayErrors.submitDate ? "border-destructive" : ""}`}
            />
            {displayErrors.submitDate && (
              <span className="text-[11px] text-destructive">
                {displayErrors.submitDate}
              </span>
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
              Effective Date *
            </Label>
            <Input
              id="effectiveDate"
              type="date"
              name="effectiveDate"
              value={formData.effectiveDate}
              onChange={onInputChange}
              className={`${FIELD} ${displayErrors.effectiveDate ? "border-destructive" : ""}`}
            />
            {displayErrors.effectiveDate && (
              <span className="text-[11px] text-destructive">
                {displayErrors.effectiveDate}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Premium & Payment */}
      <div className="space-y-3 border-t border-border/40 pt-4">
        <Cap style={{ fontSize: 11 }}>Premium &amp; Payment</Cap>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="premium" className={LABEL}>
              Premium Amount *
            </Label>
            <Input
              id="premium"
              type="number"
              inputMode="decimal"
              name="premium"
              value={formData.premium || ""}
              onChange={onInputChange}
              className={`${FIELD} ${displayErrors.premium ? "border-destructive" : ""}`}
              placeholder="250.00"
              step="0.01"
              min="0"
            />
            {displayErrors.premium && (
              <span className="text-[11px] text-destructive">
                {displayErrors.premium}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paymentFrequency" className={LABEL}>
              Payment Frequency *
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
                <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="space-y-3 border-t border-border/40 pt-4">
        <Cap style={{ fontSize: 11 }}>Status</Cap>

        <div className={showLifecycleStatus ? "grid grid-cols-2 gap-3" : ""}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status" className={LABEL}>
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
            <span className="text-[11px] text-muted-foreground">
              Carrier decision on the application
            </span>
          </div>

          {showLifecycleStatus && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lifecycleStatus" className={LABEL}>
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
              <span className="text-[11px] text-muted-foreground">
                Current state of the policy
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
