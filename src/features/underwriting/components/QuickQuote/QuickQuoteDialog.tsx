// src/features/underwriting/components/QuickQuote/QuickQuoteDialog.tsx

import {
  Suspense,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Calculator,
  Loader2,
  CigaretteOff,
  Cigarette,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { QuoteComparisonGrid } from "./QuoteComparisonGrid";
import { ThreeAmountInputs } from "./ThreeAmountInputs";
import { AgeSlider } from "./age-slider";
import { IconToggle } from "./icon-toggle";
import { MaleIcon, FemaleIcon } from "./gender-icons";
import {
  QuickOptionsPresets,
  TERM_COVERAGE_PRESETS,
  PERM_COVERAGE_PRESETS,
} from "./quick-options-presets";
import { useAllPremiumMatrices } from "../../hooks/quotes/useQuickQuote";
// eslint-disable-next-line no-restricted-imports
import {
  calculateQuotesForCoverage,
  calculateQuotesForBudget,
  getAvailableTermYearsForAge,
  getAvailableHealthClasses,
  hasTermProducts,
  type QuickQuoteInput,
  type QuickQuoteProductType,
  type QuickQuoteResult,
} from "@/services/underwriting/core/quickQuoteCalculator";
// eslint-disable-next-line no-restricted-imports
import type {
  GenderType,
  HealthClass,
  TermYears,
} from "@/services/underwriting/repositories/premiumMatrixService";

// =============================================================================
// Types & Constants
// =============================================================================

type QuoteMode = "coverage" | "budget";

interface FormState {
  age: number;
  gender: GenderType | "";
  tobaccoUse: boolean;
  healthClass: HealthClass;
  productTypes: QuickQuoteProductType[];
  termYears: TermYears;
  mode: QuoteMode;
  coverageAmounts: [number, number, number];
  budgetAmounts: [number, number, number];
}

const DEFAULT_FORM: FormState = {
  age: 35,
  gender: "male",
  tobaccoUse: false,
  healthClass: "standard",
  productTypes: ["term_life"],
  termYears: 20,
  mode: "coverage",
  coverageAmounts: [250000, 500000, 1000000],
  budgetAmounts: [50, 100, 200],
};

const PRODUCT_OPTIONS: { value: QuickQuoteProductType; label: string }[] = [
  { value: "term_life", label: "Term" },
  { value: "whole_life", label: "Whole Life" },
  { value: "participating_whole_life", label: "Part. WL" },
  { value: "indexed_universal_life", label: "IUL" },
];

const HEALTH_CLASS_LABELS: Record<HealthClass, string> = {
  preferred_plus: "Preferred+",
  preferred: "Preferred",
  standard_plus: "Standard+",
  standard: "Standard",
  table_rated: "Table",
  graded: "Graded",
  modified: "Modified",
  guaranteed_issue: "GI",
};

const TERM_OPTIONS: TermYears[] = [10, 15, 20, 25, 30];

// =============================================================================
// Sub-Components
// =============================================================================

/** Multi-select segmented group for product types */
function ProductPills({
  selected,
  onToggle,
}: {
  selected: QuickQuoteProductType[];
  onToggle: (productType: QuickQuoteProductType, checked: boolean) => void;
}) {
  return (
    <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden h-7">
      {PRODUCT_OPTIONS.map((opt, idx) => {
        const isActive = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value, !isActive)}
            className={cn(
              "px-3 text-xs font-medium transition-colors",
              isActive
                ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                : "bg-white text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
              idx > 0 && "border-l border-zinc-200 dark:border-zinc-700",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Mode toggle for coverage vs budget */
function ModeToggle({
  value,
  onChange,
}: {
  value: QuoteMode;
  onChange: (value: QuoteMode) => void;
}) {
  return (
    <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden h-7">
      <button
        type="button"
        onClick={() => onChange("coverage")}
        className={cn(
          "px-3 text-xs font-medium transition-colors",
          value === "coverage"
            ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
            : "bg-white text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
        )}
      >
        Face Amount
      </button>
      <button
        type="button"
        onClick={() => onChange("budget")}
        className={cn(
          "px-3 text-xs font-medium transition-colors border-l border-zinc-200 dark:border-zinc-700",
          value === "budget"
            ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
            : "bg-white text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
        )}
      >
        Budget
      </button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/** Full-page loading state shown while rate data is fetched */
function QuickQuoteLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      <span className="text-sm text-muted-foreground">
        Loading rate tables...
      </span>
    </div>
  );
}

export function QuickQuoteDialog() {
  return (
    <Suspense fallback={<QuickQuoteLoading />}>
      <QuickQuoteInner />
    </Suspense>
  );
}

function QuickQuoteInner() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const {
    data: matrices,
    isLoading: isLoadingMatrices,
    error,
  } = useAllPremiumMatrices();

  // Show full-page loader until rate data is ready
  if (isLoadingMatrices) {
    return <QuickQuoteLoading />;
  }

  return (
    <QuickQuoteContent
      form={form}
      setForm={setForm}
      matrices={matrices}
      error={error}
      onBack={() => navigate({ to: "/policies" })}
    />
  );
}

// Separate content component to keep hooks stable
function QuickQuoteContent({
  form,
  setForm,
  matrices,
  error,
  onBack,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  matrices: ReturnType<typeof useAllPremiumMatrices>["data"];
  error: Error | null;
  onBack: () => void;
}) {
  // Derived: available term years from the data (filtered by user age)
  const availableTermYears = useMemo(() => {
    if (!matrices) return TERM_OPTIONS;
    const available = getAvailableTermYearsForAge(
      matrices,
      form.productTypes,
      form.age,
    );
    return available.length > 0 ? available : [];
  }, [matrices, form.productTypes, form.age]);

  const showTermSelector = useMemo(() => {
    return hasTermProducts(form.productTypes);
  }, [form.productTypes]);

  // Derive available health classes from rate data for selected products
  const availableHealthClasses = useMemo(() => {
    if (!matrices) return Object.keys(HEALTH_CLASS_LABELS) as HealthClass[];
    const available = getAvailableHealthClasses(matrices, form.productTypes);
    return available.length > 0
      ? available
      : (Object.keys(HEALTH_CLASS_LABELS) as HealthClass[]);
  }, [matrices, form.productTypes]);

  // Auto-correct health class if current selection isn't available for selected products
  useEffect(() => {
    if (
      availableHealthClasses.length > 0 &&
      !availableHealthClasses.includes(form.healthClass)
    ) {
      setForm((prev) => ({
        ...prev,
        healthClass: availableHealthClasses[0],
      }));
    }
  }, [availableHealthClasses, form.healthClass, setForm]);

  // Determine product category for presets
  const { isTermOnly, isPermOnly, coveragePresetDefaults } = useMemo(() => {
    const hasTerm = form.productTypes.includes("term_life");
    const hasPerm = form.productTypes.some((t) =>
      [
        "whole_life",
        "participating_whole_life",
        "indexed_universal_life",
      ].includes(t),
    );

    const termOnly = hasTerm && !hasPerm;
    const permOnly = hasPerm && !hasTerm;

    let presets: [number, number, number][] | undefined;
    if (termOnly) {
      presets = TERM_COVERAGE_PRESETS;
    } else if (permOnly) {
      presets = PERM_COVERAGE_PRESETS;
    }

    return {
      isTermOnly: termOnly,
      isPermOnly: permOnly,
      coveragePresetDefaults: presets,
    };
  }, [form.productTypes]);

  // Auto-switch coverage amounts when switching between term-only and perm-only
  const prevProductCategoryRef = useRef<"term" | "perm" | "mixed">("mixed");
  useEffect(() => {
    const currentCategory = isTermOnly ? "term" : isPermOnly ? "perm" : "mixed";
    const prevCategory = prevProductCategoryRef.current;

    if (currentCategory !== prevCategory) {
      prevProductCategoryRef.current = currentCategory;

      if (form.mode === "coverage") {
        if (currentCategory === "perm") {
          setForm((prev) => ({
            ...prev,
            coverageAmounts: [15000, 25000, 35000],
          }));
        } else if (currentCategory === "term") {
          setForm((prev) => ({
            ...prev,
            coverageAmounts: [250000, 500000, 1000000],
          }));
        }
      }
    }
  }, [isTermOnly, isPermOnly, form.mode, setForm]);

  // Auto-correct term when age changes
  useEffect(() => {
    if (!showTermSelector || availableTermYears.length === 0) return;
    if (!availableTermYears.includes(form.termYears)) {
      setForm((prev) => ({
        ...prev,
        termYears: availableTermYears[0],
      }));
    }
  }, [availableTermYears, form.termYears, showTermSelector, setForm]);

  // INSTANT quote calculation
  const quotes: QuickQuoteResult[] = useMemo(() => {
    if (!matrices || matrices.length === 0) return [];
    if (!form.gender) return [];
    if (form.age < 18 || form.age > 100) return [];
    if (form.productTypes.length === 0) return [];

    const input: QuickQuoteInput = {
      age: form.age,
      gender: form.gender as GenderType,
      tobaccoUse: form.tobaccoUse,
      healthClass: form.healthClass,
      productTypes: form.productTypes,
      termYears: showTermSelector ? form.termYears : undefined,
    };

    if (form.mode === "coverage") {
      return calculateQuotesForCoverage(matrices, input, form.coverageAmounts);
    } else {
      return calculateQuotesForBudget(matrices, input, form.budgetAmounts);
    }
  }, [
    matrices,
    form.age,
    form.gender,
    form.tobaccoUse,
    form.healthClass,
    form.productTypes,
    form.termYears,
    form.mode,
    form.coverageAmounts,
    form.budgetAmounts,
    showTermSelector,
  ]);

  const handleReset = useCallback(() => {
    setForm(DEFAULT_FORM);
  }, [setForm]);

  const handleProductToggle = useCallback(
    (productType: QuickQuoteProductType, checked: boolean) => {
      setForm((prev) => {
        const newTypes = checked
          ? [...prev.productTypes, productType]
          : prev.productTypes.filter((t) => t !== productType);
        return { ...prev, productTypes: newTypes };
      });
    },
    [setForm],
  );

  const currentAmounts =
    form.mode === "coverage" ? form.coverageAmounts : form.budgetAmounts;

  const isValid = form.gender && form.age >= 18 && form.productTypes.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header Bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-7 w-7 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold tracking-wide">
            Quick Quote
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Rate Accuracy Notice */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex-shrink-0">
        <Info className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">
          <span className="font-semibold">
            All rates are real imported carrier data.
          </span>{" "}
          If a rate is not shown, it has not been imported yet for that age/face
          amount combination.
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          <p className="text-xs text-red-600 dark:text-red-400">
            Failed to load rates: {error.message}
          </p>
        </div>
      )}

      {/* Control Panel */}
      <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 space-y-3">
        {/* Row 1: Age | Gender | Tobacco | Health Class | Term | Products */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Age */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Age</Label>
            <AgeSlider
              value={form.age}
              onChange={(age) => setForm((prev) => ({ ...prev, age }))}
            />
          </div>

          {/* Vertical divider */}
          <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-700 self-end" />

          {/* Gender */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Gender</Label>
            <IconToggle
              value={form.gender || "male"}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, gender: v as GenderType }))
              }
              options={[
                {
                  value: "male",
                  label: "Male",
                  content: <MaleIcon />,
                },
                {
                  value: "female",
                  label: "Female",
                  content: <FemaleIcon />,
                },
              ]}
            />
          </div>

          {/* Vertical divider */}
          <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-700 self-end" />

          {/* Tobacco */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Tobacco</Label>
            <IconToggle
              value={form.tobaccoUse ? "yes" : "no"}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, tobaccoUse: v === "yes" }))
              }
              options={[
                {
                  value: "no",
                  label: "Non-Tobacco",
                  content: (
                    <>
                      <CigaretteOff className="h-3.5 w-3.5" />
                      <span>NT</span>
                    </>
                  ),
                },
                {
                  value: "yes",
                  label: "Tobacco",
                  content: (
                    <>
                      <Cigarette className="h-3.5 w-3.5" />
                      <span>T</span>
                    </>
                  ),
                },
              ]}
            />
          </div>

          {/* Vertical divider */}
          <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-700 self-end" />

          {/* Health Class */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Health Class
            </Label>
            <Select
              value={form.healthClass}
              onValueChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  healthClass: v as HealthClass,
                }))
              }
            >
              <SelectTrigger className="h-7 w-28 text-xs bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableHealthClasses.map((hc) => (
                  <SelectItem key={hc} value={hc}>
                    {HEALTH_CLASS_LABELS[hc]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Term Selector (conditional) */}
          {showTermSelector && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Term</Label>
              <Select
                value={form.termYears.toString()}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    termYears: parseInt(v) as TermYears,
                  }))
                }
              >
                <SelectTrigger className="h-7 w-20 text-xs bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTermYears.map((term) => (
                    <SelectItem key={term} value={term.toString()}>
                      {term}yr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Vertical divider */}
          <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-700 self-end" />

          {/* Products */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Products
            </Label>
            <ProductPills
              selected={form.productTypes}
              onToggle={handleProductToggle}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-200 dark:border-zinc-800" />

        {/* Row 2: Mode | Quick Options | 3x Amount Inputs */}
        <div className="flex flex-wrap items-end gap-4">
          {/* Mode */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Quote By
            </Label>
            <ModeToggle
              value={form.mode}
              onChange={(v) => setForm((prev) => ({ ...prev, mode: v }))}
            />
          </div>

          {/* Vertical divider */}
          <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-700 self-end" />

          {/* Quick Options Presets */}
          <QuickOptionsPresets
            mode={form.mode}
            currentAmounts={currentAmounts as [number, number, number]}
            onPresetSelect={(values) =>
              setForm((prev) => ({
                ...prev,
                [form.mode === "coverage"
                  ? "coverageAmounts"
                  : "budgetAmounts"]: values,
              }))
            }
            systemDefaults={
              form.mode === "coverage" ? coveragePresetDefaults : undefined
            }
          />

          {/* Vertical divider */}
          <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-700 self-end" />

          {/* Amounts */}
          <ThreeAmountInputs
            mode={form.mode}
            values={currentAmounts}
            onChange={(values) =>
              setForm((prev) => ({
                ...prev,
                [form.mode === "coverage"
                  ? "coverageAmounts"
                  : "budgetAmounts"]: values,
              }))
            }
          />
        </div>
      </div>

      {/* Results Area — fills remaining viewport */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
            Results
          </span>
          {quotes.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {quotes.length} product{quotes.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {!isValid ? (
          <div className="flex items-center justify-center p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
            <p className="text-xs text-muted-foreground">
              Enter age, select gender, and choose at least one product
            </p>
          </div>
        ) : (
          <QuoteComparisonGrid
            quotes={quotes}
            mode={form.mode}
            amounts={currentAmounts}
          />
        )}
      </div>

      {/* Disclaimer footer */}
      <div className="flex-shrink-0 px-4 py-1.5 border-t border-border/50 bg-muted/20">
        <p className="text-[10px] text-muted-foreground text-center">
          Rates are estimates. Final premium depends on underwriting.
        </p>
      </div>
    </div>
  );
}

export default QuickQuoteDialog;
