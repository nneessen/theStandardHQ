// src/features/underwriting/components/QuickQuote/index.ts

export {
  QuickQuoteDialog,
  QuickQuoteDialog as QuickQuotePage,
} from "./QuickQuoteDialog";
export { QuoteComparisonGrid } from "./QuoteComparisonGrid";
export { ThreeAmountInputs } from "./ThreeAmountInputs";
export { AgeSlider } from "./age-slider";
export { IconToggle } from "./icon-toggle";
export { MaleIcon, FemaleIcon } from "./gender-icons";
export {
  QuickOptionsPresets,
  TERM_COVERAGE_PRESETS,
  PERM_COVERAGE_PRESETS,
} from "./quick-options-presets";

// Legacy exports (keeping for backward compatibility, may be removed later)
export { default as QuickQuoteForm } from "./QuickQuoteForm";
export { default as QuoteResultsTable } from "./QuoteResultsTable";
export { default as BudgetModeToggle } from "./BudgetModeToggle";
