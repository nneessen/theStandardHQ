// src/features/policies/components/WizardStepProductPolicy.tsx

import React from "react";
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
  VALID_TERM_LENGTHS,
  type TermCommissionModifiers,
} from "../../../types/product.types";
import {
  NewPolicyForm,
  PolicyStatus,
  PolicyLifecycleStatus,
} from "../../../types/policy.types";
import { isToday } from "../hooks/usePolicyForm";
import { WizardStepIntro } from "./WizardStepIntro";
import { LABEL, HELPER, ERROR_TEXT, fieldClass } from "./policyFormStyles";

interface Carrier {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  product_type: string;
}

interface WizardStepProductPolicyProps {
  formData: NewPolicyForm;
  displayErrors: Record<string, string>;
  policyId?: string;
  carriers: Carrier[];
  products: Product[];
  productsLoading: boolean;
  productCommissionRates: Record<string, number>;
  termModifiers: TermCommissionModifiers | null;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (name: string, value: string) => void;
}

/** Step 2 of the wizard — the product, the policy identity, and its status. */
export const WizardStepProductPolicy: React.FC<
  WizardStepProductPolicyProps
> = ({
  formData,
  displayErrors,
  policyId,
  carriers,
  products,
  productsLoading,
  productCommissionRates,
  termModifiers,
  onInputChange,
  onSelectChange,
}) => {
  const selectedProduct = products.find((p) => p.id === formData.productId);
  const showLifecycleStatus = formData.status === "approved";

  return (
    <div className="space-y-5">
      <WizardStepIntro title="What did they buy?">
        Pick the carrier and product, then record the policy's identity and
        status.
      </WizardStepIntro>

      {/* Carrier */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="carrierId" className={LABEL}>
          Carrier <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.carrierId}
          onValueChange={(value) => onSelectChange("carrierId", value)}
        >
          <SelectTrigger
            id="carrierId"
            className={fieldClass(!!displayErrors.carrierId)}
          >
            <SelectValue placeholder="Select carrier" />
          </SelectTrigger>
          <SelectContent>
            {carriers.map((carrier) => (
              <SelectItem key={carrier.id} value={carrier.id}>
                {carrier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {displayErrors.carrierId && (
          <span className={ERROR_TEXT}>{displayErrors.carrierId}</span>
        )}
      </div>

      {/* Product */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="productId" className={LABEL}>
          Product <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.productId}
          onValueChange={(value) => onSelectChange("productId", value)}
          disabled={!formData.carrierId || productsLoading}
        >
          <SelectTrigger
            id="productId"
            className={fieldClass(!!displayErrors.productId)}
          >
            <SelectValue
              placeholder={
                !formData.carrierId
                  ? "Select a carrier first"
                  : productsLoading
                    ? "Loading products..."
                    : products.length === 0
                      ? "No products available for this carrier"
                      : "Select product"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
                {productCommissionRates[product.id] &&
                  ` (${(productCommissionRates[product.id] * 100).toFixed(1)}% commission)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {displayErrors.productId && (
          <span className={ERROR_TEXT}>{displayErrors.productId}</span>
        )}
        {formData.carrierId && !productsLoading && products.length === 0 && (
          <span className={ERROR_TEXT}>
            This carrier has no products configured. Please contact admin or
            select a different carrier.
          </span>
        )}
      </div>

      {/* Term length (term life only) */}
      {formData.productId && selectedProduct?.product_type === "term_life" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="termLength" className={LABEL}>
            Term length <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.termLength?.toString() ?? ""}
            onValueChange={(value) => onSelectChange("termLength", value)}
          >
            <SelectTrigger
              id="termLength"
              className={fieldClass(!!displayErrors.termLength)}
            >
              <SelectValue placeholder="Select term length" />
            </SelectTrigger>
            <SelectContent>
              {VALID_TERM_LENGTHS.map((term) => {
                const modifier = termModifiers?.[term] ?? 0;
                const modifierText =
                  modifier !== 0
                    ? ` (${modifier > 0 ? "+" : ""}${(modifier * 100).toFixed(0)}%)`
                    : "";
                return (
                  <SelectItem key={term} value={term.toString()}>
                    {term} Years{modifierText}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {displayErrors.termLength && (
            <span className={ERROR_TEXT}>{displayErrors.termLength}</span>
          )}
        </div>
      )}

      {/* Policy identity */}
      <div className="space-y-5 border-t border-border/40 pt-5">
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

      {/* Status */}
      <div
        className={`border-t border-border/40 pt-5 ${showLifecycleStatus ? "grid grid-cols-2 gap-3" : ""}`}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status" className={LABEL}>
            Application status
          </Label>
          <Select
            value={formData.status}
            onValueChange={(value) => {
              onSelectChange("status", value as PolicyStatus);
              if (value !== "approved") {
                onSelectChange("lifecycleStatus", "");
              }
            }}
          >
            <SelectTrigger id="status" className={fieldClass(false)}>
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
              <SelectTrigger id="lifecycleStatus" className={fieldClass(false)}>
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
  );
};
