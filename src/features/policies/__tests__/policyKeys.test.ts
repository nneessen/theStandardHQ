// src/features/policies/__tests__/policyKeys.test.ts

import { describe, it, expect } from "vitest";
import { policyKeys } from "../queries";
import type { PolicyFilters, PolicySortConfig } from "@/types/policy.types";

const activeFilter: PolicyFilters = { status: "approved" };
const lapsedFilter: PolicyFilters = { lifecycleStatus: "lapsed" };
const sortA: PolicySortConfig = { field: "created_at", direction: "desc" };
const sortB: PolicySortConfig = { field: "annual_premium", direction: "asc" };

describe("policyKeys", () => {
  it("all / lists / details roots", () => {
    expect(policyKeys.all).toEqual(["policies"]);
    expect(policyKeys.lists()).toEqual(["policies", "list"]);
    expect(policyKeys.details()).toEqual(["policies", "detail"]);
  });

  it("detail(id) nests under details", () => {
    expect(policyKeys.detail("p1")).toEqual(["policies", "detail", "p1"]);
  });

  it("list(filters) nests filters under lists", () => {
    expect(policyKeys.list(activeFilter)).toEqual([
      "policies",
      "list",
      activeFilter,
    ]);
  });

  it("count/dashboardMetrics carry their filters", () => {
    expect(policyKeys.count(activeFilter)).toEqual([
      "policies",
      "count",
      activeFilter,
    ]);
    expect(policyKeys.dashboardMetrics(activeFilter)).toEqual([
      "policies",
      "dashboard-metrics",
      activeFilter,
    ]);
  });

  describe("default-filter normalization (empty vs omitted produce the same key)", () => {
    it("list() === list({})", () => {
      expect(policyKeys.list()).toEqual(policyKeys.list({}));
    });
    it("count() === count({}) — fixes broad-invalidation matching", () => {
      expect(policyKeys.count()).toEqual(policyKeys.count({}));
      // The third element must be an object (not undefined), else a bare
      // count() invalidation can't partial-match the {}-keyed query.
      expect(policyKeys.count()[2]).toEqual({});
    });
    it("dashboardMetrics() === dashboardMetrics({})", () => {
      expect(policyKeys.dashboardMetrics()).toEqual(
        policyKeys.dashboardMetrics({}),
      );
    });
    it("paginated(1,10) === paginated(1,10,{})", () => {
      expect(policyKeys.paginated(1, 10)).toEqual(
        policyKeys.paginated(1, 10, {}),
      );
    });
  });

  describe("paginated key factory", () => {
    it("nests under list(filters) with page/size/sort", () => {
      expect(policyKeys.paginated(2, 25, activeFilter, sortA)).toEqual([
        "policies",
        "list",
        activeFilter,
        "paginated",
        2,
        25,
        sortA,
      ]);
    });

    it("different pages produce different keys", () => {
      expect(policyKeys.paginated(1, 10, activeFilter, sortA)).not.toEqual(
        policyKeys.paginated(2, 10, activeFilter, sortA),
      );
    });

    it("different page sizes produce different keys", () => {
      expect(policyKeys.paginated(1, 10, activeFilter, sortA)).not.toEqual(
        policyKeys.paginated(1, 25, activeFilter, sortA),
      );
    });

    it("different sort configs produce different keys", () => {
      expect(policyKeys.paginated(1, 10, activeFilter, sortA)).not.toEqual(
        policyKeys.paginated(1, 10, activeFilter, sortB),
      );
    });
  });

  it("different filters produce different keys", () => {
    expect(policyKeys.list(activeFilter)).not.toEqual(
      policyKeys.list(lapsedFilter),
    );
    expect(policyKeys.count(activeFilter)).not.toEqual(
      policyKeys.count(lapsedFilter),
    );
  });

  it("paginated shares the lists() prefix (broad invalidation matches it)", () => {
    const key = policyKeys.paginated(1, 10, activeFilter, sortA);
    const prefix = policyKeys.lists();
    expect(key.slice(0, prefix.length)).toEqual(prefix);
  });

  it("paginated shares the list(filters) prefix (filter-scoped invalidation matches it)", () => {
    const key = policyKeys.paginated(1, 10, activeFilter, sortA);
    const prefix = policyKeys.list(activeFilter);
    expect(key.slice(0, prefix.length)).toEqual(prefix);
  });
});
