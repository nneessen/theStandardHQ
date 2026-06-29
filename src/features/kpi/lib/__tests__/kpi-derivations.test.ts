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
  // Inbound model: cost = inbound calls × $42.50 flat per-call cost, over clients.
  it("derives spend from call volume over clients", () => {
    expect(costPerAcquisition(10, 10)).toBe(42.5); // (10×42.5)/10
    expect(costPerAcquisition(100, 5)).toBe(850); // (100×42.5)/5
  });
  it("keeps a real 0 when there are no calls but clients exist", () => {
    expect(costPerAcquisition(0, 5)).toBe(0);
  });
  it("suppresses when calls is null, or clients is null/0", () => {
    expect(costPerAcquisition(null, 10)).toBeNull();
    expect(costPerAcquisition(10, 0)).toBeNull();
    expect(costPerAcquisition(10, null)).toBeNull();
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
