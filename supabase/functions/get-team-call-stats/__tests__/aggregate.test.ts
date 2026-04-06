// supabase/functions/get-team-call-stats/__tests__/aggregate.test.ts
//
// Unit tests for the pure aggregation helper used by the get-team-call-stats
// edge function. The function lives at ../aggregate.ts with no Deno-specific
// imports, so vitest can import it directly under Node.

import { describe, it, expect } from "vitest";
import { aggregateCalls, isOutbound, type CloseCall } from "../aggregate";

function call(
  overrides: Partial<CloseCall> & { date_created: string },
): CloseCall {
  return {
    id: `c-${Math.random()}`,
    lead_id: "lead-1",
    direction: "outbound",
    duration: 0,
    disposition: undefined,
    ...overrides,
  };
}

describe("isOutbound", () => {
  it("accepts both 'outbound' and 'outgoing' (Close API spelling drift)", () => {
    expect(isOutbound("outbound")).toBe(true);
    expect(isOutbound("outgoing")).toBe(true);
  });

  it("rejects inbound spellings", () => {
    expect(isOutbound("inbound")).toBe(false);
    expect(isOutbound("incoming")).toBe(false);
  });

  it("rejects undefined and unknown values", () => {
    expect(isOutbound(undefined)).toBe(false);
    expect(isOutbound("")).toBe(false);
    expect(isOutbound("unknown")).toBe(false);
  });
});

describe("aggregateCalls", () => {
  it("returns zeros for empty input", () => {
    const result = aggregateCalls([]);
    expect(result).toEqual({
      dials: 0,
      connects: 0,
      talkTimeSeconds: 0,
      voicemails: 0,
      lastDialAt: null,
    });
  });

  it("counts each outbound call as a dial", () => {
    const result = aggregateCalls([
      call({ date_created: "2026-04-06T10:00:00Z", direction: "outbound" }),
      call({ date_created: "2026-04-06T11:00:00Z", direction: "outgoing" }),
      call({ date_created: "2026-04-06T12:00:00Z", direction: "outbound" }),
    ]);
    expect(result.dials).toBe(3);
  });

  it("ignores inbound calls entirely (not dials, not in lastDialAt)", () => {
    const result = aggregateCalls([
      call({
        date_created: "2026-04-06T15:00:00Z",
        direction: "inbound",
        disposition: "answered",
      }),
      call({
        date_created: "2026-04-06T10:00:00Z",
        direction: "outbound",
        disposition: "answered",
      }),
    ]);
    expect(result.dials).toBe(1);
    expect(result.connects).toBe(1);
    // lastDialAt should be the OUTBOUND call at 10:00, not the inbound at 15:00
    expect(result.lastDialAt).toBe("2026-04-06T10:00:00Z");
  });

  it("counts only answered outbound calls as connects", () => {
    const result = aggregateCalls([
      call({
        date_created: "2026-04-06T10:00:00Z",
        direction: "outbound",
        disposition: "answered",
      }),
      call({
        date_created: "2026-04-06T11:00:00Z",
        direction: "outbound",
        disposition: "no-answer",
      }),
      call({
        date_created: "2026-04-06T12:00:00Z",
        direction: "outbound",
        disposition: "vm-answer",
      }),
      call({
        date_created: "2026-04-06T13:00:00Z",
        direction: "outbound",
        disposition: "answered",
      }),
    ]);
    expect(result.dials).toBe(4);
    expect(result.connects).toBe(2);
  });

  it("sums talk time only for answered outbound calls", () => {
    const result = aggregateCalls([
      call({
        date_created: "2026-04-06T10:00:00Z",
        direction: "outbound",
        disposition: "answered",
        duration: 60,
      }),
      call({
        date_created: "2026-04-06T11:00:00Z",
        direction: "outbound",
        disposition: "answered",
        duration: 120,
      }),
      // duration on a no-answer call must NOT be summed
      call({
        date_created: "2026-04-06T12:00:00Z",
        direction: "outbound",
        disposition: "no-answer",
        duration: 5,
      }),
      // duration on a vm-answer must NOT be summed
      call({
        date_created: "2026-04-06T13:00:00Z",
        direction: "outbound",
        disposition: "vm-answer",
        duration: 30,
      }),
    ]);
    expect(result.talkTimeSeconds).toBe(180); // 60 + 120
    expect(result.connects).toBe(2);
    expect(result.voicemails).toBe(1);
  });

  it("counts vm-answer disposition as voicemails", () => {
    const result = aggregateCalls([
      call({
        date_created: "2026-04-06T10:00:00Z",
        disposition: "vm-answer",
      }),
      call({
        date_created: "2026-04-06T11:00:00Z",
        disposition: "vm-answer",
      }),
      // no-answer is NOT a voicemail
      call({
        date_created: "2026-04-06T12:00:00Z",
        disposition: "no-answer",
      }),
    ]);
    expect(result.voicemails).toBe(2);
    expect(result.dials).toBe(3);
    expect(result.connects).toBe(0);
  });

  it("tracks lastDialAt as the most recent outbound dial regardless of array order", () => {
    const result = aggregateCalls([
      call({ date_created: "2026-04-06T08:00:00Z" }),
      call({ date_created: "2026-04-06T15:30:00Z" }), // latest
      call({ date_created: "2026-04-06T10:00:00Z" }),
      call({ date_created: "2026-04-06T12:45:00Z" }),
    ]);
    expect(result.lastDialAt).toBe("2026-04-06T15:30:00Z");
  });

  it("treats missing duration as 0 (defensive against malformed Close responses)", () => {
    const result = aggregateCalls([
      call({
        date_created: "2026-04-06T10:00:00Z",
        disposition: "answered",
        duration: undefined,
      }),
    ]);
    expect(result.connects).toBe(1);
    expect(result.talkTimeSeconds).toBe(0);
  });

  it("handles a realistic mixed-direction batch correctly", () => {
    const result = aggregateCalls([
      call({
        date_created: "2026-04-06T09:00:00Z",
        direction: "outbound",
        disposition: "answered",
        duration: 240,
      }),
      call({
        date_created: "2026-04-06T09:15:00Z",
        direction: "outbound",
        disposition: "no-answer",
      }),
      call({
        date_created: "2026-04-06T09:30:00Z",
        direction: "inbound",
        disposition: "answered",
        duration: 600,
      }),
      call({
        date_created: "2026-04-06T10:00:00Z",
        direction: "outbound",
        disposition: "vm-answer",
      }),
      call({
        date_created: "2026-04-06T11:00:00Z",
        direction: "outbound",
        disposition: "answered",
        duration: 90,
      }),
    ]);
    expect(result.dials).toBe(4); // outbound only
    expect(result.connects).toBe(2);
    expect(result.talkTimeSeconds).toBe(330); // 240 + 90 (inbound 600 excluded)
    expect(result.voicemails).toBe(1);
    expect(result.lastDialAt).toBe("2026-04-06T11:00:00Z");
  });
});
