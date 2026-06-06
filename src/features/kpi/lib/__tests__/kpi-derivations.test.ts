// src/features/kpi/lib/__tests__/kpi-derivations.test.ts
import { describe, it, expect } from "vitest";
import {
  closingRate,
  policiesPerClient,
  costPerAcquisition,
  connectRate,
} from "../kpi-derivations";

describe("closingRate", () => {
  it("computes clients/calls as a percentage", () => {
    expect(closingRate(10, 40)).toBe(25);
    expect(closingRate(0, 40)).toBe(0); // a real 0 is kept, not suppressed
  });
  it("suppresses (null) on null inputs or zero denominator", () => {
    expect(closingRate(null, 40)).toBeNull();
    expect(closingRate(10, null)).toBeNull();
    expect(closingRate(10, 0)).toBeNull();
    expect(closingRate(undefined, undefined)).toBeNull();
  });
});

describe("policiesPerClient", () => {
  it("computes policies/clients", () => {
    expect(policiesPerClient(15, 10)).toBe(1.5);
    expect(policiesPerClient(0, 10)).toBe(0);
  });
  it("suppresses on null inputs or zero clients", () => {
    expect(policiesPerClient(15, 0)).toBeNull();
    expect(policiesPerClient(null, 10)).toBeNull();
    expect(policiesPerClient(15, null)).toBeNull();
  });
});

describe("costPerAcquisition", () => {
  it("sums lead + marketing spend over clients", () => {
    expect(costPerAcquisition(800, 200, 10)).toBe(100);
  });
  it("treats a single null spend as zero when the other is present", () => {
    expect(costPerAcquisition(500, null, 10)).toBe(50);
    expect(costPerAcquisition(null, 300, 10)).toBe(30);
  });
  it("suppresses when BOTH spends are null, or clients is null/0", () => {
    expect(costPerAcquisition(null, null, 10)).toBeNull();
    expect(costPerAcquisition(800, 200, 0)).toBeNull();
    expect(costPerAcquisition(800, 200, null)).toBeNull();
  });
});

describe("connectRate", () => {
  it("computes answered/total as a percentage", () => {
    expect(connectRate(30, 60)).toBe(50);
    expect(connectRate(0, 60)).toBe(0);
  });
  it("suppresses on null inputs or zero total", () => {
    expect(connectRate(30, 0)).toBeNull();
    expect(connectRate(null, 60)).toBeNull();
    expect(connectRate(30, null)).toBeNull();
  });
});
