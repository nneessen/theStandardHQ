// src/features/policies/components/PolicyFormClientSection.tsx

import React from "react";
import { ChevronDown } from "lucide-react";
import { Cap } from "@/components/board";
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

// Shared field styling — readable (text-sm) recessed wells that sit distinctly
// against the charcoal dialog surface, with only a soft hairline border.
const FIELD = "h-9 text-sm bg-background border-border/60 focus:border-accent";
const LABEL = "text-xs text-muted-foreground";

/**
 * Client column of the New/Edit Policy form. Styled to "The Board" design
 * language used across the app: no nested cards, amber gradients, or hard
 * borders — just mono-cap group labels, soft hairline dividers, and recessed
 * fields. Notes live in their own full-width block in PolicyForm.
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
    <div className="flex flex-col gap-5">
      {/* Client Details */}
      <div className="space-y-3">
        <Cap style={{ fontSize: 11 }}>Client Details</Cap>

        {/* Client Name */}
        <div className="space-y-1.5">
          <Label htmlFor="clientName" className={LABEL}>
            Client Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="clientName"
            type="text"
            name="clientName"
            value={formData.clientName}
            onChange={onInputChange}
            className={`${FIELD} ${displayErrors.clientName ? "border-destructive" : ""}`}
            placeholder="John Smith"
          />
          {displayErrors.clientName && (
            <span className="text-[11px] text-destructive">
              {displayErrors.clientName}
            </span>
          )}
        </div>

        {/* State and DOB */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientState" className={LABEL}>
              State *
            </Label>
            <Select
              value={formData.clientState}
              onValueChange={(value) => onSelectChange("clientState", value)}
            >
              <SelectTrigger
                id="clientState"
                className={`${FIELD} ${displayErrors.clientState ? "border-destructive" : ""}`}
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
              <span className="text-[11px] text-destructive">
                {displayErrors.clientState}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientDOB" className={LABEL}>
              Date of Birth *
            </Label>
            <DateOfBirthInput
              id="clientDOB"
              name="clientDOB"
              value={formData.clientDOB}
              onChange={onDOBChange}
              error={!!displayErrors.clientDOB}
              className="h-9 text-sm bg-background border-border/60"
            />
            {displayErrors.clientDOB && (
              <span className="text-[11px] text-destructive">
                {displayErrors.clientDOB}
              </span>
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
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium transition-colors"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showContactDetails ? "rotate-180" : ""}`}
              />
              Additional Client Details
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
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
                Street Address
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
                  Zip Code
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

      {/* Product Selection */}
      <div className="space-y-3 border-t border-border/40 pt-4">
        <Cap style={{ fontSize: 11 }}>Product Selection</Cap>

        {/* Carrier Select */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="carrierId" className={LABEL}>
            Carrier *
          </Label>
          <Select
            value={formData.carrierId}
            onValueChange={(value) => onSelectChange("carrierId", value)}
          >
            <SelectTrigger
              id="carrierId"
              className={`${FIELD} ${displayErrors.carrierId ? "border-destructive" : ""}`}
            >
              <SelectValue placeholder="Select Carrier" />
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
            <span className="text-[11px] text-destructive">
              {displayErrors.carrierId}
            </span>
          )}
        </div>

        {/* Product Select */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="productId" className={LABEL}>
            Product *
          </Label>
          <Select
            value={formData.productId}
            onValueChange={(value) => onSelectChange("productId", value)}
            disabled={!formData.carrierId || productsLoading}
          >
            <SelectTrigger
              id="productId"
              className={`${FIELD} ${displayErrors.productId ? "border-destructive" : ""}`}
            >
              <SelectValue
                placeholder={
                  !formData.carrierId
                    ? "Select a carrier first"
                    : productsLoading
                      ? "Loading products..."
                      : products.length === 0
                        ? "No products available for this carrier"
                        : "Select Product"
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
            <span className="text-[11px] text-destructive">
              {displayErrors.productId}
            </span>
          )}
          {formData.carrierId && !productsLoading && products.length === 0 && (
            <span className="text-[11px] text-destructive">
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
                Term Length *
              </Label>
              <Select
                value={formData.termLength?.toString() ?? ""}
                onValueChange={(value) => onSelectChange("termLength", value)}
              >
                <SelectTrigger
                  id="termLength"
                  className={`${FIELD} ${displayErrors.termLength ? "border-destructive" : ""}`}
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
                <span className="text-[11px] text-destructive">
                  {displayErrors.termLength}
                </span>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
