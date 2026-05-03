// src/features/underwriting/components/QuickQuote/QuickQuoteForm.tsx

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import BudgetModeToggle from "./BudgetModeToggle";
// eslint-disable-next-line no-restricted-imports
import type {
  QuoteInput,
  ProductType,
} from "@/services/underwriting/workflows/quotingService";
// eslint-disable-next-line no-restricted-imports
import type {
  HealthClass,
  TermYears,
} from "@/services/underwriting/repositories/premiumMatrixService";
import { US_STATES } from "@/constants/states";

interface QuickQuoteFormProps {
  formData: Partial<QuoteInput>;
  onChange: (updates: Partial<QuoteInput>) => void;
  errors?: Record<string, string>;
}

const PRODUCT_OPTIONS: { value: ProductType; label: string }[] = [
  { value: "term_life", label: "Term Life" },
  { value: "whole_life", label: "Whole Life" },
  { value: "participating_whole_life", label: "Participating WL" },
  { value: "indexed_universal_life", label: "IUL" },
];

const HEALTH_CLASS_OPTIONS: { value: HealthClass; label: string }[] = [
  { value: "preferred_plus", label: "Preferred Plus" },
  { value: "preferred", label: "Preferred" },
  { value: "standard_plus", label: "Standard Plus" },
  { value: "standard", label: "Standard" },
  { value: "table_rated", label: "Table Rated" },
];

const TERM_OPTIONS: { value: TermYears; label: string }[] = [
  { value: 10, label: "10 Year" },
  { value: 15, label: "15 Year" },
  { value: 20, label: "20 Year" },
  { value: 25, label: "25 Year" },
  { value: 30, label: "30 Year" },
];

const FACE_AMOUNT_PRESETS = [25000, 50000, 100000, 250000, 500000, 1000000];

const BUDGET_PRESETS = [25, 50, 75, 100, 150, 200];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function QuickQuoteForm({
  formData,
  onChange,
  errors = {},
}: QuickQuoteFormProps) {
  const toggleProductType = (type: ProductType) => {
    const current = formData.productTypes || [];
    if (current.includes(type)) {
      onChange({ productTypes: current.filter((t) => t !== type) });
    } else {
      onChange({ productTypes: [...current, type] });
    }
  };

  const toggleTermYears = (term: TermYears) => {
    const current = formData.termYears || [];
    if (current.includes(term)) {
      onChange({ termYears: current.filter((t) => t !== term) });
    } else {
      onChange({ termYears: [...current, term] });
    }
  };

  const showTermYears = formData.productTypes?.includes("term_life");

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <BudgetModeToggle
        mode={formData.mode || "coverage"}
        onChange={(mode) => onChange({ mode })}
      />

      {/* Amount Input (Coverage or Budget) */}
      <div className="space-y-2">
        {formData.mode === "budget" ? (
          <>
            <Label className="text-[11px] font-medium text-foreground dark:text-muted-foreground">
              Monthly Budget <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => onChange({ monthlyBudget: amount })}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded border transition-colors",
                    formData.monthlyBudget === amount
                      ? "bg-info text-white border-info"
                      : "bg-card-tinted text-muted-foreground dark:text-muted-foreground border-border dark:border-border hover:border-info/40 dark:hover:border-info",
                  )}
                >
                  ${amount}/mo
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                min={10}
                max={5000}
                step={5}
                value={formData.monthlyBudget || ""}
                onChange={(e) =>
                  onChange({ monthlyBudget: parseInt(e.target.value) || 0 })
                }
                className={cn(
                  "h-8 text-sm w-32",
                  errors.monthlyBudget && "border-destructive",
                )}
                placeholder="Amount"
              />
              <span className="text-xs text-muted-foreground">/month</span>
            </div>
            {errors.monthlyBudget && (
              <p className="text-[10px] text-destructive">
                {errors.monthlyBudget}
              </p>
            )}
          </>
        ) : (
          <>
            <Label className="text-[11px] font-medium text-foreground dark:text-muted-foreground">
              Face Amount <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {FACE_AMOUNT_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => onChange({ faceAmount: amount })}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded border transition-colors",
                    formData.faceAmount === amount
                      ? "bg-info text-white border-info"
                      : "bg-card-tinted text-muted-foreground dark:text-muted-foreground border-border dark:border-border hover:border-info/40 dark:hover:border-info",
                  )}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                min={5000}
                max={10000000}
                step={5000}
                value={formData.faceAmount || ""}
                onChange={(e) =>
                  onChange({ faceAmount: parseInt(e.target.value) || 0 })
                }
                className={cn(
                  "h-8 text-sm w-32",
                  errors.faceAmount && "border-destructive",
                )}
                placeholder="Amount"
              />
            </div>
            {errors.faceAmount && (
              <p className="text-[10px] text-destructive">
                {errors.faceAmount}
              </p>
            )}
          </>
        )}
      </div>

      {/* Demographics Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            Age <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={18}
            max={100}
            value={formData.age || ""}
            onChange={(e) => onChange({ age: parseInt(e.target.value) || 0 })}
            className={cn("h-8 text-sm", errors.age && "border-destructive")}
            placeholder="Age"
          />
          {errors.age && (
            <p className="text-[10px] text-destructive">{errors.age}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            Gender <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.gender || ""}
            onValueChange={(value) =>
              onChange({ gender: value as "male" | "female" })
            }
          >
            <SelectTrigger
              className={cn(
                "h-8 text-sm",
                errors.gender && "border-destructive",
              )}
            >
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
          {errors.gender && (
            <p className="text-[10px] text-destructive">{errors.gender}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            State <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.state || ""}
            onValueChange={(value) => onChange({ state: value })}
          >
            <SelectTrigger
              className={cn(
                "h-8 text-sm",
                errors.state && "border-destructive",
              )}
            >
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            Tobacco
          </Label>
          <div className="flex items-center h-8 gap-2">
            <Checkbox
              id="tobacco"
              checked={formData.tobaccoUse || false}
              onCheckedChange={(checked) =>
                onChange({ tobaccoUse: checked === true })
              }
            />
            <label
              htmlFor="tobacco"
              className="text-[11px] text-muted-foreground dark:text-muted-foreground"
            >
              Tobacco user
            </label>
          </div>
        </div>
      </div>

      {/* Health Class */}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
          Health Class (assumed)
        </Label>
        <Select
          value={formData.healthClass || "standard"}
          onValueChange={(value) =>
            onChange({ healthClass: value as HealthClass })
          }
        >
          <SelectTrigger className="h-8 text-sm w-48">
            <SelectValue placeholder="Select health class" />
          </SelectTrigger>
          <SelectContent>
            {HEALTH_CLASS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Rates shown will be for this health class. Health conditions may
          adjust the actual rating.
        </p>
      </div>

      {/* Product Types */}
      <div className="space-y-2 pt-2 border-t border-border dark:border-border">
        <Label className="text-[11px] font-medium text-foreground dark:text-muted-foreground">
          Product Types <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_OPTIONS.map((option) => {
            const isSelected = formData.productTypes?.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleProductType(option.value)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5 rounded border transition-colors text-[11px]",
                  isSelected
                    ? "bg-info/10 border-info/40 text-info"
                    : "bg-card-tinted/50 border-border dark:border-border text-muted-foreground dark:text-muted-foreground hover:border-border dark:hover:border-border",
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleProductType(option.value)}
                  className="h-3.5 w-3.5"
                />
                {option.label}
              </button>
            );
          })}
        </div>
        {errors.productTypes && (
          <p className="text-[10px] text-destructive">{errors.productTypes}</p>
        )}
      </div>

      {/* Term Years (if term life selected) */}
      {showTermYears && (
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            Term Lengths (optional filter)
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {TERM_OPTIONS.map((option) => {
              const isSelected = formData.termYears?.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleTermYears(option.value)}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded border transition-colors",
                    isSelected
                      ? "bg-info text-white border-info"
                      : "bg-card-tinted text-muted-foreground dark:text-muted-foreground border-border dark:border-border hover:border-info/40 dark:hover:border-info",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Leave empty to show all term lengths
          </p>
        </div>
      )}
    </div>
  );
}
