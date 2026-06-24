// src/features/policies/utils/policyPagination.ts
//
// Pure pagination math shared by the policy list footer. Kept out of the render
// component so the edge cases (notably the empty list) are unit-testable.

export interface PaginationRange {
  /** 1-based index of the first item on the current page, or 0 when empty. */
  firstItem: number;
  /** 1-based index of the last item on the current page, or 0 when empty. */
  lastItem: number;
}

/**
 * Computes the "{first}-{last} of {total}" range for a page.
 *
 * When `totalItems === 0` this returns `{ firstItem: 0, lastItem: 0 }` so the
 * UI shows "0-0 of 0" instead of the nonsensical "1-0 of 0".
 */
export function getPaginationRange(
  currentPage: number,
  pageSize: number,
  totalItems: number,
): PaginationRange {
  if (totalItems <= 0) {
    return { firstItem: 0, lastItem: 0 };
  }
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);
  return { firstItem, lastItem };
}
