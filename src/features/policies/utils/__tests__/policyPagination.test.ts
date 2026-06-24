// src/features/policies/utils/__tests__/policyPagination.test.ts

import { describe, it, expect } from "vitest";
import { getPaginationRange } from "../policyPagination";

describe("getPaginationRange", () => {
  it("returns 0-0 when there are no items (no '1-0 of 0')", () => {
    expect(getPaginationRange(1, 10, 0)).toEqual({ firstItem: 0, lastItem: 0 });
  });

  it("computes the first page range", () => {
    expect(getPaginationRange(1, 10, 35)).toEqual({
      firstItem: 1,
      lastItem: 10,
    });
  });

  it("computes a middle page range", () => {
    expect(getPaginationRange(2, 10, 35)).toEqual({
      firstItem: 11,
      lastItem: 20,
    });
  });

  it("clamps the last item to totalItems on the final partial page", () => {
    expect(getPaginationRange(4, 10, 35)).toEqual({
      firstItem: 31,
      lastItem: 35,
    });
  });

  it("handles a single full page", () => {
    expect(getPaginationRange(1, 25, 25)).toEqual({
      firstItem: 1,
      lastItem: 25,
    });
  });
});
