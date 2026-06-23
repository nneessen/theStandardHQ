// src/features/analytics/tabs/grid.ts
// Shared responsive row grids for the analytics tabs. Multi-column rows collapse
// to a single column on narrow screens so panels never get crushed below their
// content width. `gap-6`/`mb-6` = 24px. Kept in a .ts (no components) so Fast
// Refresh stays happy — see react-refresh/only-export-components.

export const ROW_2 = "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 items-stretch";
export const ROW_3 =
  "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6 items-stretch";
// Rows containing a 2-wide panel: stack until xl, then 3 columns (1 + span-2).
export const ROW_3_WIDE =
  "grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6 items-stretch";
export const ROW_1 = "grid grid-cols-1 gap-6 mb-6";
