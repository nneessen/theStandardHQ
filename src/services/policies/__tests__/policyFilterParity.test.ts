// src/services/policies/__tests__/policyFilterParity.test.ts
//
// Regression guard for the filter-builder unification in PolicyRepository.
//
// Before the refactor, findAll / countPolicies / getAggregateMetrics each
// re-implemented their own equality `columnMap`, and they had DRIFTED:
// getAggregateMetrics was missing `lifecycleStatus`, so a lifecycleStatus
// filter produced different results for the list vs. the header count/metrics.
//
// These tests assert that the count and aggregate reads now apply an IDENTICAL
// set of column filters (the shared applyEqualityAndDates), so the metrics can
// never silently diverge from the list again.

import { describe, it, expect, beforeEach } from "vitest";
import { PolicyRepository, type PolicyFilters } from "../PolicyRepository";

type Call = [op: string, col?: string, val?: unknown];

/** A minimal chainable PostgREST stub that records eq/gte/lte/or calls. */
function makeFakeClient(record: Call[]) {
  const builder: Record<string, unknown> = {};
  const ret = () => builder;
  Object.assign(builder, {
    select: ret,
    eq: (col: string, val: unknown) => {
      record.push(["eq", col, val]);
      return builder;
    },
    gte: (col: string, val: unknown) => {
      record.push(["gte", col, val]);
      return builder;
    },
    lte: (col: string, val: unknown) => {
      record.push(["lte", col, val]);
      return builder;
    },
    or: (f: string) => {
      record.push(["or", f]);
      return builder;
    },
    in: ret,
    is: ret,
    ilike: ret,
    order: ret,
    range: ret,
    limit: ret,
    lt: ret,
    gt: ret,
    single: () => Promise.resolve({ data: null, error: null }),
    // Awaiting the builder resolves to an empty result set.
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
  });
  return { from: () => builder };
}

/** Only the column-filter calls, normalized for comparison. */
function eqCalls(record: Call[]): Array<[string, unknown]> {
  return record
    .filter(([op]) => op === "eq")
    .map(([, col, val]) => [col as string, val] as [string, unknown])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

describe("PolicyRepository filter parity", () => {
  let repo: PolicyRepository;
  let record: Call[];

  const filters: PolicyFilters = {
    status: "pending",
    lifecycleStatus: "active",
    carrierId: "carrier-1",
    product: "term_life",
    productId: "product-1",
  };
  const userId = "user-1";

  beforeEach(() => {
    repo = new PolicyRepository();
    record = [];
    // Replace the Supabase client with the recording stub.
    (repo as unknown as { client: unknown }).client = makeFakeClient(record);
  });

  it("countPolicies maps every filter (incl. lifecycleStatus) to the right column", async () => {
    await repo.countPolicies(filters, userId);
    expect(eqCalls(record)).toEqual([
      ["carrier_id", "carrier-1"],
      ["lifecycle_status", "active"],
      ["product", "term_life"],
      ["product_id", "product-1"],
      ["status", "pending"],
      ["user_id", "user-1"],
    ]);
  });

  it("getAggregateMetrics applies the IDENTICAL filter set (bug #4 fix)", async () => {
    const countRecord: Call[] = [];
    const aggRecord: Call[] = [];

    (repo as unknown as { client: unknown }).client =
      makeFakeClient(countRecord);
    await repo.countPolicies(filters, userId);

    (repo as unknown as { client: unknown }).client = makeFakeClient(aggRecord);
    await repo.getAggregateMetrics(filters, userId);

    // The whole point of the refactor: the two reads filter identically.
    expect(eqCalls(aggRecord)).toEqual(eqCalls(countRecord));
    // And lifecycle_status (the column that used to be dropped) is present.
    expect(eqCalls(aggRecord)).toContainEqual(["lifecycle_status", "active"]);
  });

  it("date filters target submit_date by default and effective_date on request", async () => {
    record = [];
    (repo as unknown as { client: unknown }).client = makeFakeClient(record);
    await repo.countPolicies({ dateFrom: "2026-01-01", dateTo: "2026-12-31" });
    expect(record).toContainEqual(["gte", "submit_date", "2026-01-01"]);
    expect(record).toContainEqual(["lte", "submit_date", "2026-12-31"]);

    record.length = 0;
    await repo.countPolicies({
      dateFrom: "2026-01-01",
      dateField: "effective_date",
    });
    expect(record).toContainEqual(["gte", "effective_date", "2026-01-01"]);
  });
});
