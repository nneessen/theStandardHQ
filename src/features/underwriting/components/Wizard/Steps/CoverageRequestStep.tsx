// src/features/underwriting/components/WizardSteps/CoverageRequestStep.tsx

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type {
  CoverageRequest,
  ProductType,
} from "../../../types/underwriting.types";

interface CoverageRequestStepProps {
  data: CoverageRequest;
  onChange: (updates: Partial<CoverageRequest>) => void;
  errors: Record<string, string>;
}

const PRODUCT_OPTIONS: {
  value: ProductType;
  label: string;
  description: string;
}[] = [
  {
    value: "term_life",
    label: "Term Life",
    description: "Affordable coverage for a specific period (10-30 years)",
  },
  {
    value: "whole_life",
    label: "Whole Life",
    description: "Permanent coverage with cash value accumulation",
  },
  {
    value: "universal_life",
    label: "Universal Life",
    description: "Flexible premium and death benefit options",
  },
  {
    value: "indexed_universal_life",
    label: "Indexed Universal Life (IUL)",
    description: "Cash value growth tied to market index performance",
  },
];

// Face amount presets by product category
const TERM_LIFE_PRESETS = [100000, 250000, 500000, 750000, 1000000, 2000000];
const WHOLE_LIFE_PRESETS = [10000, 15000, 25000, 35000, 50000, 75000, 100000];

// Product types that are considered "whole life" category (smaller face amounts)
const WHOLE_LIFE_CATEGORY: ProductType[] = [
  "whole_life",
  "universal_life",
  "indexed_universal_life",
];

// Default face amounts by category
const TERM_DEFAULTS = [250000, 500000, 1000000];
const WHOLE_LIFE_DEFAULTS = [15000, 25000, 35000];

export default function CoverageRequestStep({
  data,
  onChange,
  errors,
}: CoverageRequestStepProps) {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Determine if only whole life category products are selected
  const isWholeLifeOnly = (): boolean => {
    const selected = data.productTypes || [];
    if (selected.length === 0) return false;
    return selected.every((t) => WHOLE_LIFE_CATEGORY.includes(t));
  };

  // Determine if only term life is selected
  const isTermLifeOnly = (): boolean => {
    const selected = data.productTypes || [];
    return selected.length > 0 && selected.every((t) => t === "term_life");
  };

  // Get the appropriate presets based on selection
  const getPresets = (): number[] => {
    if (isWholeLifeOnly()) return WHOLE_LIFE_PRESETS;
    if (isTermLifeOnly()) return TERM_LIFE_PRESETS;
    // Mixed selection - show term presets (larger amounts work for both)
    return TERM_LIFE_PRESETS;
  };

  const toggleProductType = (type: ProductType) => {
    const current = data.productTypes || [];
    let newTypes: ProductType[];

    if (current.includes(type)) {
      newTypes = current.filter((t) => t !== type);
    } else {
      newTypes = [...current, type];
    }

    // Determine if we're switching categories
    const wasWholeLifeOnly =
      current.length > 0 &&
      current.every((t) => WHOLE_LIFE_CATEGORY.includes(t));
    const willBeWholeLifeOnly =
      newTypes.length > 0 &&
      newTypes.every((t) => WHOLE_LIFE_CATEGORY.includes(t));
    const wasTermLifeOnly =
      current.length > 0 && current.every((t) => t === "term_life");
    const willBeTermLifeOnly =
      newTypes.length > 0 && newTypes.every((t) => t === "term_life");

    // If switching between categories, reset face amounts to appropriate defaults
    const currentAmounts = data.faceAmounts || [0, 0, 0];
    const hasUserEnteredAmounts = currentAmounts.some((a) => a > 0);

    if (wasWholeLifeOnly !== willBeWholeLifeOnly && !hasUserEnteredAmounts) {
      // Switching categories with no user input - apply defaults
      const defaults = willBeWholeLifeOnly
        ? WHOLE_LIFE_DEFAULTS
        : TERM_DEFAULTS;
      onChange({ productTypes: newTypes, faceAmounts: defaults });
    } else if (
      willBeWholeLifeOnly &&
      !wasWholeLifeOnly &&
      hasUserEnteredAmounts &&
      currentAmounts[0] > 100000
    ) {
      // Switching TO whole life with large amounts - suggest smaller
      onChange({ productTypes: newTypes, faceAmounts: WHOLE_LIFE_DEFAULTS });
    } else if (
      willBeTermLifeOnly &&
      !wasTermLifeOnly &&
      hasUserEnteredAmounts &&
      currentAmounts[0] < 50000
    ) {
      // Switching TO term only with small amounts - suggest larger
      onChange({ productTypes: newTypes, faceAmounts: TERM_DEFAULTS });
    } else {
      onChange({ productTypes: newTypes });
    }
  };

  // Update a specific face amount by index
  const updateFaceAmount = (index: number, value: number) => {
    const newAmounts = [...(data.faceAmounts || [0, 0, 0])];
    newAmounts[index] = value;
    onChange({ faceAmounts: newAmounts });
  };

  // Quick-select populates all three amounts with common increments
  const applyQuickSelect = (baseAmount: number) => {
    let amounts: number[];

    if (isWholeLifeOnly()) {
      // Whole life: smaller increments (base, +10k, +20k) capped at 100k
      amounts = [
        baseAmount,
        Math.min(baseAmount + 10000, 100000),
        Math.min(baseAmount + 25000, 100000),
      ];
    } else {
      // Term life: larger increments (base, 2x, 4x)
      amounts = [baseAmount, baseAmount * 2, baseAmount * 4];
    }

    onChange({ faceAmounts: amounts });
  };

  const faceAmounts = data.faceAmounts || [0, 0, 0];
  const validAmounts = faceAmounts.filter((a) => a >= 10000);

  return (
    <div className="space-y-4 p-1">
      <div className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle mb-3">
        Specify up to 3 face amounts for quote comparison and select the product
        types the client is interested in.
      </div>

      {/* Face Amounts */}
      <div className="space-y-3">
        <Label className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted">
          Face Amounts (Death Benefit) <span className="text-red-500">*</span>
        </Label>
        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle -mt-1">
          Enter up to 3 coverage amounts to compare quotes
        </p>

        {/* Quick select buttons - dynamic based on product type */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-v2-ink-muted">
            Quick-fill presets
            {isWholeLifeOnly() && " (whole life amounts)"}:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {getPresets().map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => applyQuickSelect(amount)}
                className={cn(
                  "px-2 py-1 text-[10px] rounded border transition-colors",
                  faceAmounts[0] === amount
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-v2-card-tinted text-v2-ink-muted dark:text-v2-ink-subtle border-v2-ring dark:border-v2-ring-strong hover:border-amber-300 dark:hover:border-amber-700",
                )}
              >
                {formatCurrency(amount)}
              </button>
            ))}
          </div>
        </div>

        {/* Three face amount inputs */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-1">
              <label className="text-[10px] font-medium text-v2-ink-muted">
                Amount {index + 1}
                {index === 0 && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-v2-ink-subtle">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  max={100000000}
                  step={10000}
                  value={faceAmounts[index] || ""}
                  onChange={(e) =>
                    updateFaceAmount(index, parseInt(e.target.value) || 0)
                  }
                  className={cn(
                    "h-8 text-sm pl-5",
                    index === 0 && errors.faceAmounts && "border-red-500",
                  )}
                  placeholder={
                    index === 0
                      ? "Required"
                      : index === 1
                        ? "Optional"
                        : "Optional"
                  }
                />
              </div>
              {faceAmounts[index] > 0 && (
                <p className="text-[9px] text-v2-ink-subtle">
                  {formatCurrency(faceAmounts[index])}
                </p>
              )}
            </div>
          ))}
        </div>

        {errors.faceAmounts && (
          <p className="text-[10px] text-red-500">{errors.faceAmounts}</p>
        )}
      </div>

      {/* Product Types */}
      <div className="space-y-2 pt-2 border-t border-v2-ring dark:border-v2-ring">
        <Label className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted">
          Product Types <span className="text-red-500">*</span>
        </Label>
        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Select the product types to consider for recommendations
        </p>

        <div className="space-y-2">
          {PRODUCT_OPTIONS.map((option) => {
            const isSelected = data.productTypes?.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => toggleProductType(option.value)}
                className={cn(
                  "flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors",
                  isSelected
                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
                    : "bg-v2-card-tinted/50 border-v2-ring dark:border-v2-ring-strong hover:border-v2-ring-strong dark:hover:border-v2-ring-strong",
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleProductType(option.value)}
                  className="mt-0.5"
                />
                <div>
                  <div
                    className={cn(
                      "text-sm font-medium",
                      isSelected
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-v2-ink dark:text-v2-ink-muted",
                    )}
                  >
                    {option.label}
                  </div>
                  <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    {option.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {errors.productTypes && (
          <p className="text-[10px] text-red-500">{errors.productTypes}</p>
        )}
      </div>

      {/* Summary */}
      {data.productTypes.length > 0 && validAmounts.length > 0 && (
        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 mb-1">
            Coverage Summary
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 space-y-0.5">
            <div>
              <span className="font-medium">
                {validAmounts.length} quote
                {validAmounts.length > 1 ? "s" : ""}:
              </span>{" "}
              {validAmounts.map((a) => formatCurrency(a)).join(", ")}
            </div>
            <div>
              <span className="font-medium">Products:</span>{" "}
              {data.productTypes
                .map(
                  (t) => PRODUCT_OPTIONS.find((o) => o.value === t)?.label || t,
                )
                .join(", ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
