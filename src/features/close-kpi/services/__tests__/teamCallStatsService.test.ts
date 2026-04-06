// src/features/close-kpi/services/__tests__/teamCallStatsService.test.ts
//
// Unit tests for the friendlyErrorMessage helper. The full fetchTeamCallStats
// function isn't tested here because it requires mocking the supabase client,
// which adds noise — its only logic is "invoke the function, throw on error".
// The error mapping itself is the part that benefits from regression tests.

import { describe, it, expect } from "vitest";
import { __friendlyErrorMessage as friendly } from "../teamCallStatsService";

describe("friendlyErrorMessage", () => {
  it("maps missing/invalid bearer to the session-expired message", () => {
    expect(friendly("missing bearer token")).toMatch(/session expired/i);
    expect(friendly("invalid bearer token")).toMatch(/session expired/i);
  });

  it("maps PostgREST JWT errors to session-expired", () => {
    expect(friendly("not authenticated")).toMatch(/session expired/i);
    expect(friendly("JWT expired")).toMatch(/session expired/i);
    expect(friendly("PGRST301: jwt expired")).toMatch(/session expired/i);
    expect(friendly("PGRST302: jwt invalid")).toMatch(/session expired/i);
  });

  it("maps Close API timeout to a Close-specific message", () => {
    expect(friendly("Close API timeout after 10000ms")).toMatch(
      /didn't respond/i,
    );
  });

  it("maps Close API 401/403 to invalid-key advice", () => {
    expect(friendly("Close API 401: unauthorized")).toMatch(
      /invalid Close API key/i,
    );
    expect(friendly("Close API 403: forbidden")).toMatch(
      /invalid Close API key/i,
    );
  });

  it("maps Close rate limit to wait-and-retry", () => {
    expect(friendly("Close API 429: rate limit hit")).toMatch(/rate limit/i);
  });

  it("maps invalid date range error to user-friendly text", () => {
    expect(friendly("from and to (ISO timestamps) are required")).toMatch(
      /invalid date range/i,
    );
  });

  it("maps network/transport errors", () => {
    expect(friendly("FunctionsHttpError: failed to fetch")).toMatch(
      /couldn't reach/i,
    );
  });

  it("passes unknown errors through but truncates very long ones", () => {
    expect(friendly("some unknown error")).toBe("some unknown error");
    const longMsg = "x".repeat(500);
    const result = friendly(longMsg);
    expect(result.length).toBeLessThanOrEqual(201); // 200 chars + ellipsis
    expect(result).toMatch(/…$/);
  });

  it("does NOT leak internal database details (regression guard)", () => {
    // If a future change broke the mapping, errors like
    // "permission denied for function get_team_pipeline_snapshot"
    // would still pass through verbatim — that's acceptable for unknown
    // errors but we want to know if it ever happens for KNOWN patterns.
    // This test pins that JWT-shaped errors get masked, full stop.
    const internalLeak = "JWT expired at line 47 in get_team_member_ids";
    expect(friendly(internalLeak)).toMatch(/session expired/i);
    expect(friendly(internalLeak)).not.toMatch(/get_team_member_ids/);
  });
});
