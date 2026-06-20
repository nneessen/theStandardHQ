// src/features/policies/components/PolicyFormClientSection.tsx

import React from "react";
import { ChevronDown, UserRound, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateOfBirthInput } from "@/components/ui/date-of-birth-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { US_STATES } from "@/constants/states";
import {
  VALID_TERM_LENGTHS,
  type TermCommissionModifiers,
} from "../../../types/product.types";
import { NewPolicyForm } from "../../../types/policy.types";
import { PolicySectionHeader } from "./PolicySectionHeader";
import { FIELD, LABEL, ERROR_TEXT, fieldClass } from "./policyFormStyles";

interface Carrier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  product_type: string;
}

interface PolicyFormClientSectionProps {
  formData: NewPolicyForm;
  displayErrors: Record<string, string>;
  carriers: Carrier[];
  products: Product[];
  productsLoading: boolean;
  productCommissionRates: Record<string, number>;
  termModifiers: TermCommissionModifiers | null;
  showContactDetails: boolean;
  onShowContactDetailsChange: (show: boolean) => void;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSelectChange: (name: string, value: string) => void;
  onPhoneChange: (value: string) => void;
  onDOBChange: (value: string) => void;
}

/**
 * Client + Product groups — the top of the Direction B left column. Each group
 * sits behind the shared section-header pattern (icon tile + mono label + rule)
 * over recessed field wells. Rarely-used contact fields hide behind the
 * "Additional client details" disclosure so the default view stays calm.
 */
export const PolicyFormClientSection: React.FC<
  PolicyFormClientSectionProps
> = ({
  formData,
  displayErrors,
  carriers,
  products,
  productsLoading,
  productCommissionRates,
  termModifiers,
  showContactDetails,
  onShowContactDetailsChange,
  onInputChange,
  onSelectChange,
  onPhoneChange,
  onDOBChange,
}) => {
  const selectedProduct = products.find((p) => p.id === formData.productId);

  return (
    <div className="flex flex-col gap-8">
      {/* ─── Client ────────────────────────────────────────────────────── */}
      <div className="space-y-3.5">
        <PolicySectionHeader icon={UserRound} label="Client" />

        {/* Client Name */}
        <div className="space-y-1.5">
          <Label htmlFor="clientName" className={LABEL}>
            Client name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="clientName"
            type="text"
            name="clientName"
            value={formData.clientName}
            onChange={onInputChange}
            className={fieldClass(!!displayErrors.clientName)}
            placeholder="John Smith"
          />
          {displayErrors.clientName && (
            <span className={ERROR_TEXT}>{displayErrors.clientName}</span>
          )}
        </div>

        {/* State and DOB */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientState" className={LABEL}>
              State <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.clientState}
              onValueChange={(value) => onSelectChange("clientState", value)}
            >
              <SelectTrigger
                id="clientState"
                className={fieldClass(!!displayErrors.clientState)}
              >
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {displayErrors.clientState && (
              <span className={ERROR_TEXT}>{displayErrors.clientState}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientDOB" className={LABEL}>
              Date of birth <span className="text-destructive">*</span>
            </Label>
            <DateOfBirthInput
              id="clientDOB"
              name="clientDOB"
              value={formData.clientDOB}
              onChange={onDOBChange}
              error={!!displayErrors.clientDOB}
              className={FIELD}
            />
            {displayErrors.clientDOB && (
              <span className={ERROR_TEXT}>{displayErrors.clientDOB}</span>
            )}
          </div>
        </div>

        {/* Additional Contact Details (Collapsible) */}
        <Collapsible
          open={showContactDetails}
          onOpenChange={onShowContactDetailsChange}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent/80"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showContactDetails ? "rotate-180" : ""}`}
              />
              Additional client details
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="clientEmail" className={LABEL}>
                  Email
                </Label>
                <Input
                  id="clientEmail"
                  type="email"
                  name="clientEmail"
                  value={formData.clientEmail || ""}
                  onChange={onInputChange}
                  className={FIELD}
                  placeholder="client@email.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="clientPhone" className={LABEL}>
                  Phone
                </Label>
                <Input
                  id="clientPhone"
                  type="tel"
                  inputMode="tel"
                  name="clientPhone"
                  value={formData.clientPhone || ""}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  className={FIELD}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientStreet" className={LABEL}>
                Street address
              </Label>
              <Input
                id="clientStreet"
                type="text"
                name="clientStreet"
                value={formData.clientStreet || ""}
                onChange={onInputChange}
                className={FIELD}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="clientCity" className={LABEL}>
                  City
                </Label>
                <Input
                  id="clientCity"
                  type="text"
                  name="clientCity"
                  value={formData.clientCity || ""}
                  onChange={onInputChange}
                  className={FIELD}
                  placeholder="Anytown"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="clientZipCode" className={LABEL}>
                  Zip code
                </Label>
                <Input
                  id="clientZipCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="clientZipCode"
                  value={formData.clientZipCode || ""}
                  onChange={onInputChange}
                  className={FIELD}
                  placeholder="12345"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ─── Product ───────────────────────────────────────────────────── */}
      <div className="space-y-3.5">
        <PolicySectionHeader icon={Package} label="Product" />

        {/* Carrier Select */}
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

        {/* Product Select */}
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

        {/* Term Length Selector - only show for term_life products */}
        {formData.productId &&
          selectedProduct?.product_type === "term_life" && (
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
      </div>
    </div>
  );
};
