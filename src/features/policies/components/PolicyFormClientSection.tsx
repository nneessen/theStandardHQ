// src/features/policies/components/PolicyFormClientSection.tsx

import React from "react";
import { User, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="bg-v2-card-tinted rounded-lg border border-v2-ring/80 dark:border-v2-ring-strong/60 shadow-sm">
      {/* Section header strip */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30 dark:to-transparent border-b border-v2-ring/60 dark:border-v2-ring-strong/40">
        <User className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
          Client Information
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Client Details Group */}
        <div className="space-y-2.5 p-2.5 rounded-md bg-v2-canvas/80 dark:bg-v2-card/40 border border-v2-ring dark:border-v2-ring-strong/30">
          <p className="text-[9px] font-medium text-v2-ink-subtle dark:text-v2-ink-muted uppercase tracking-wider">
            Client Details
          </p>

          {/* Client Name */}
          <div className="space-y-1">
            <Label
              htmlFor="clientName"
              className="text-[10px] text-muted-foreground"
            >
              Client Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientName"
              type="text"
              name="clientName"
              value={formData.clientName}
              onChange={onInputChange}
              className={`h-8 text-xs bg-v2-card-tinted border-v2-ring dark:border-v2-ring-strong ${displayErrors.clientName ? "border-destructive" : ""}`}
              placeholder="John Smith"
            />
            {displayErrors.clientName && (
              <span className="text-[10px] text-destructive">
                {displayErrors.clientName}
              </span>
            )}
          </div>

          {/* State and DOB */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="clientState"
                className="text-[11px] text-muted-foreground"
              >
                State *
              </Label>
              <Select
                value={formData.clientState}
                onValueChange={(value) => onSelectChange("clientState", value)}
              >
                <SelectTrigger
                  id="clientState"
                  className={`h-8 text-[11px] ${displayErrors.clientState ? "border-destructive" : "border-input"}`}
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
                <span className="text-[10px] text-destructive">
                  {displayErrors.clientState}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="clientDOB"
                className="text-[11px] text-muted-foreground"
              >
                Date of Birth *
              </Label>
              <DateOfBirthInput
                id="clientDOB"
                name="clientDOB"
                value={formData.clientDOB}
                onChange={onDOBChange}
                error={!!displayErrors.clientDOB}
                className="h-8 text-[11px]"
              />
              {displayErrors.clientDOB && (
                <span className="text-[10px] text-destructive">
                  {displayErrors.clientDOB}
                </span>
              )}
            </div>
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
              className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-medium transition-colors"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showContactDetails ? "rotate-180" : ""}`}
              />
              Additional Client Details
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2.5 p-2.5 rounded-md bg-v2-canvas/80 dark:bg-v2-card/40 border border-v2-ring dark:border-v2-ring-strong/30">
              <p className="text-[9px] font-medium text-v2-ink-subtle dark:text-v2-ink-muted uppercase tracking-wider">
                Contact & Address
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="clientEmail"
                    className="text-[10px] text-muted-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    name="clientEmail"
                    value={formData.clientEmail || ""}
                    onChange={onInputChange}
                    className="h-8 text-[11px] bg-v2-card-tinted border-v2-ring dark:border-v2-ring-strong"
                    placeholder="client@email.com"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="clientPhone"
                    className="text-[10px] text-muted-foreground"
                  >
                    Phone
                  </Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    inputMode="tel"
                    name="clientPhone"
                    value={formData.clientPhone || ""}
                    onChange={(e) => onPhoneChange(e.target.value)}
                    className="h-8 text-[11px] bg-v2-card-tinted border-v2-ring dark:border-v2-ring-strong"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="clientStreet"
                  className="text-[10px] text-muted-foreground"
                >
                  Street Address
                </Label>
                <Input
                  id="clientStreet"
                  type="text"
                  name="clientStreet"
                  value={formData.clientStreet || ""}
                  onChange={onInputChange}
                  className="h-8 text-[11px] bg-v2-card-tinted border-v2-ring dark:border-v2-ring-strong"
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="clientCity"
                    className="text-[10px] text-muted-foreground"
                  >
                    City
                  </Label>
                  <Input
                    id="clientCity"
                    type="text"
                    name="clientCity"
                    value={formData.clientCity || ""}
                    onChange={onInputChange}
                    className="h-8 text-[11px] bg-v2-card-tinted border-v2-ring dark:border-v2-ring-strong"
                    placeholder="Anytown"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="clientZipCode"
                    className="text-[10px] text-muted-foreground"
                  >
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
                    className="h-8 text-[11px] bg-v2-card-tinted border-v2-ring dark:border-v2-ring-strong"
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Product Selection Group */}
        <div className="space-y-2.5 p-2.5 rounded-md bg-v2-canvas/80 dark:bg-v2-card/40 border border-v2-ring dark:border-v2-ring-strong/30">
          <p className="text-[9px] font-medium text-v2-ink-subtle dark:text-v2-ink-muted uppercase tracking-wider">
            Product Selection
          </p>

          {/* Carrier Select */}
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="carrierId"
              className="text-[11px] text-muted-foreground"
            >
              Carrier *
            </Label>
            <Select
              value={formData.carrierId}
              onValueChange={(value) => onSelectChange("carrierId", value)}
            >
              <SelectTrigger
                id="carrierId"
                className={`h-8 text-[11px] ${displayErrors.carrierId ? "border-destructive" : "border-input"}`}
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
              <span className="text-[10px] text-destructive">
                {displayErrors.carrierId}
              </span>
            )}
          </div>

          {/* Product Select */}
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="productId"
              className="text-[11px] text-muted-foreground"
            >
              Product *
            </Label>
            <Select
              value={formData.productId}
              onValueChange={(value) => onSelectChange("productId", value)}
              disabled={!formData.carrierId || productsLoading}
            >
              <SelectTrigger
                id="productId"
                className={`h-8 text-[11px] ${displayErrors.productId ? "border-destructive" : "border-input"}`}
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
              <span className="text-[10px] text-destructive">
                {displayErrors.productId}
              </span>
            )}
            {formData.carrierId &&
              !productsLoading &&
              products.length === 0 && (
                <span className="text-[10px] text-destructive">
                  This carrier has no products configured. Please contact admin
                  or select a different carrier.
                </span>
              )}
          </div>

          {/* Term Length Selector - only show for term_life products */}
          {formData.productId &&
            selectedProduct?.product_type === "term_life" && (
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="termLength"
                  className="text-[11px] text-muted-foreground"
                >
                  Term Length *
                </Label>
                <Select
                  value={formData.termLength?.toString() ?? ""}
                  onValueChange={(value) => onSelectChange("termLength", value)}
                >
                  <SelectTrigger
                    id="termLength"
                    className={`h-8 text-[11px] ${displayErrors.termLength ? "border-destructive" : "border-input"}`}
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
                  <span className="text-[10px] text-destructive">
                    {displayErrors.termLength}
                  </span>
                )}
              </div>
            )}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="notes" className="text-[11px] text-muted-foreground">
            Notes
          </Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={onInputChange}
            rows={2}
            placeholder="Optional notes..."
            className="text-[11px] resize-vertical min-h-[50px] bg-v2-card-tinted border-v2-ring dark:border-v2-ring-strong"
          />
        </div>
      </div>
    </div>
  );
};
