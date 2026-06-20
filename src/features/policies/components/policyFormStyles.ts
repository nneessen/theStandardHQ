// src/features/policies/components/policyFormStyles.ts
//
// Shared field + label styling for the Add/Edit Policy form (Direction B —
// Two-Pane Linear redesign). Centralized so every input across the form reads
// as the same recessed "well".
//
// THEME-AWARE BY DESIGN: built entirely on semantic `.theme-v2` tokens
// (`bg-background`, `border-border`, `accent`, …) so the inset-well treatment
// holds in BOTH the light and dark Substrate themes. Never hardcode the
// handoff's dark hex (e.g. `#121212`) here — a literal dark well inverts in
// light mode.

/** Recessed input well. Pair with `FIELD_ERROR` when a field has an error. */
export const FIELD =
  "h-10 text-sm bg-background border-border/60 rounded-lg shadow-inner transition-colors hover:border-border focus:border-accent";

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
