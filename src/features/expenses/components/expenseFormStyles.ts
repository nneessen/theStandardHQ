// src/features/expenses/components/expenseFormStyles.ts
//
// Shared field + label styling for the Add/Edit Expense wizard. Mirrors the
// policy form's recessed-well treatment so the two dialogs read as one family.
//
// THEME-AWARE BY DESIGN: built entirely on semantic `.theme-v2` tokens
// (`bg-background`, `border-border`, `accent`, …) so the inset-well treatment
// holds in BOTH the light and dark Substrate themes. Never hardcode dark hex.

/**
 * Recessed input well — a deep inset that reads as a well (not a panel), 12px
 * radius, ~15px body text, a soft inner shadow, and a blue focus ring. Pair with
 * `FIELD_ERROR` on error.
 */
export const FIELD =
  "h-11 text-[15px] bg-background border-border/60 rounded-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.30)] transition-colors hover:border-border focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25";

/** Error treatment appended to `FIELD` when a field fails validation. */
export const FIELD_ERROR = "border-destructive focus:border-destructive";

/** Field label — small but readable (muted, not dim). */
export const LABEL = "text-xs font-medium text-muted-foreground";

/** One-line helper under a tricky field. */
export const HELPER = "text-[11px] text-muted-foreground";

/** Inline validation error text under a field. */
export const ERROR_TEXT = "text-[11px] text-destructive";

/** Compose the field class with an optional error state in one call. */
export function fieldClass(hasError?: boolean): string {
  return hasError ? `${FIELD} ${FIELD_ERROR}` : FIELD;
}
