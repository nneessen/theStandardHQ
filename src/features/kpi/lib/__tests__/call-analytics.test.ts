// src/features/kpi/lib/__tests__/call-analytics.test.ts
import { describe, it, expect } from "vitest";
import {
  aggregateCallAnalytics,
  aggregateWordTrackEffectiveness,
  hourLabel,
  rate,
  type AnalyticsRecording,
  type DetectionRow,
} from "../call-analytics";

function rec(
  p: Partial<AnalyticsRecording> & { id: string },
): AnalyticsRecording {
  return {
    id: p.id,
    agent_id: p.agent_id ?? "agentA",
    call_at: p.call_at ?? "2026-06-01T15:00:00Z",
    duration_seconds: p.duration_seconds ?? null,
    caller_state: p.caller_state ?? null,
    caller_age_band: p.caller_age_band ?? null,
    caller_gender: p.caller_gender ?? null,
    outcome: p.outcome ?? null,
    premium_amount: p.premium_amount ?? null,
    policies_count: p.policies_count ?? 0,
  };
}

const ROWS: AnalyticsRecording[] = [
  rec({
    id: "r1",
    agent_id: "agentA",
    caller_state: "CA",
    outcome: "sold",
    premium_amount: 1000,
    duration_seconds: 100,
    caller_age_band: "40_49",
    caller_gender: "male",
    policies_count: 1,
  }),
  rec({
    id: "r2",
    agent_id: "agentA",
    caller_state: "CA",
    outcome: "not_sold",
    duration_seconds: 200,
    caller_age_band: "40_49",
    caller_gender: "female",
  }),
  rec({
    id: "r3",
    agent_id: "agentA",
    caller_state: "TX",
    outcome: "sold",
    premium_amount: 2000,
    duration_seconds: 400,
    caller_age_band: "30_39",
    caller_gender: "male",
    policies_count: 1,
  }),
  rec({
    id: "r4",
    agent_id: "agentB",
    caller_state: "TX",
    outcome: "sold",
    premium_amount: 500,
    duration_seconds: 700,
    caller_age_band: "70_plus",
    caller_gender: "female",
    policies_count: 1,
  }),
  rec({
    id: "r5",
    agent_id: "agentB",
    caller_state: "TX",
    outcome: "not_sold",
    duration_seconds: null,
    caller_age_band: "30_39",
    caller_gender: "male",
  }),
  rec({
    id: "r6",
    agent_id: "agentB",
    caller_state: "CA",
    outcome: "callback",
    duration_seconds: 90,
    caller_age_band: "50_59",
    caller_gender: "female",
  }),
];

describe("rate / hourLabel", () => {
  it("rate is 0 (not NaN) when denominator is 0", () => {
    expect(rate(0, 0)).toBe(0);
    expect(rate(3, 6)).toBe(50);
  });
  it("hourLabel renders 12-hour am/pm", () => {
    expect(hourLabel(0)).toBe("12 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(13)).toBe("1 PM");
  });
});

describe("aggregateCallAnalytics", () => {
  const names = new Map([["agentA", "Alice"]]);
  const a = aggregateCallAnalytics(ROWS, names);

  it("totals: calls/sold/closingRate/premium/avgDuration/avgPremium", () => {
    expect(a.totals.calls).toBe(6);
    expect(a.totals.sold).toBe(3);
    expect(a.totals.closingRate).toBe(50);
    expect(a.totals.premiumTotal).toBe(3500);
    expect(a.totals.avgDurationSec).toBeCloseTo(1490 / 5); // r5 has no duration
    expect(a.totals.avgPremium).toBeCloseTo(3500 / 3);
  });

  it("byState is ranked by closing rate with premium sums", () => {
    expect(a.byState.map((s) => s.state)).toEqual(["TX", "CA"]);
    expect(a.byState[0]).toMatchObject({
      state: "TX",
      calls: 3,
      sold: 2,
      premium: 2500,
    });
    expect(a.byState[0].closingRate).toBeCloseTo(66.667);
    expect(a.byState[1]).toMatchObject({
      state: "CA",
      calls: 3,
      sold: 1,
      premium: 1000,
    });
  });

  it("byAgeBand keeps canonical order and only present bands", () => {
    expect(a.byAgeBand.map((b) => b.band)).toEqual([
      "30_39",
      "40_49",
      "50_59",
      "70_plus",
    ]);
    expect(a.byAgeBand.find((b) => b.band === "70_plus")?.closingRate).toBe(
      100,
    );
  });

  it("byGender counts", () => {
    expect(a.byGender.find((g) => g.gender === "male")?.count).toBe(3);
    expect(a.byGender.find((g) => g.gender === "female")?.count).toBe(3);
  });

  it("byLengthBucket always returns the 4 buckets, bucketed by duration", () => {
    expect(a.byLengthBucket.map((b) => b.label)).toEqual([
      "0–2m",
      "2–5m",
      "5–10m",
      "10m+",
    ]);
    const byLabel = Object.fromEntries(
      a.byLengthBucket.map((b) => [b.label, b]),
    );
    expect(byLabel["0–2m"]).toMatchObject({ count: 2, sold: 1 }); // r1(100), r6(90)
    expect(byLabel["5–10m"]).toMatchObject({ count: 1, sold: 1 }); // r3(400)
    expect(byLabel["10m+"]).toMatchObject({ count: 1, sold: 1 }); // r4(700)
  });

  it("byAgent is ranked by closing rate, sums policies/premium, resolves names + fallback", () => {
    expect(a.byAgent.map((x) => x.name)).toEqual(["Alice", "Agent agen"]);
    expect(a.byAgent[0]).toMatchObject({
      calls: 3,
      sold: 2,
      policies: 2,
      premium: 3000,
    });
    expect(a.byAgent[1]).toMatchObject({
      calls: 3,
      sold: 1,
      policies: 1,
      premium: 500,
    });
  });

  it("byHour/byDay totals reconcile with calls", () => {
    expect(a.byDay).toHaveLength(7);
    expect(a.byHour.reduce((n, h) => n + h.calls, 0)).toBe(6);
    expect(a.byDay.reduce((n, d) => n + d.calls, 0)).toBe(6);
  });
});

describe("aggregateWordTrackEffectiveness", () => {
  const recordings = ROWS.map((r) => ({ id: r.id, outcome: r.outcome }));
  const detections: DetectionRow[] = [
    {
      recording_id: "r1",
      word_track_id: "T1",
      position_pct: 50,
      timing_bucket: "closing",
    },
    {
      recording_id: "r3",
      word_track_id: "T1",
      position_pct: 60,
      timing_bucket: "closing",
    },
    {
      recording_id: "r4",
      word_track_id: "T1",
      position_pct: 70,
      timing_bucket: "late",
    },
    {
      recording_id: "r1",
      word_track_id: "T2",
      position_pct: 5,
      timing_bucket: "opening",
    },
    {
      recording_id: "r1",
      word_track_id: "T2",
      position_pct: 8,
      timing_bucket: "opening",
    }, // dup recording
    {
      recording_id: "r2",
      word_track_id: "T2",
      position_pct: 6,
      timing_bucket: "opening",
    },
    {
      recording_id: "r5",
      word_track_id: "T2",
      position_pct: 7,
      timing_bucket: "opening",
    },
    {
      recording_id: "r6",
      word_track_id: "T2",
      position_pct: 9,
      timing_bucket: "opening",
    },
    {
      recording_id: "ghost",
      word_track_id: "T2",
      position_pct: 9,
      timing_bucket: "opening",
    }, // out of range
  ];
  const tracks = [
    { id: "T1", label: "Assumptive close", category: "close" },
    { id: "T2", label: "Warm greeting", category: "greeting" },
  ];

  const e = aggregateWordTrackEffectiveness(recordings, detections, tracks);

  it("baseline is the overall closing rate", () => {
    expect(e.baseline).toBe(50); // 3 sold of 6
  });

  it("ranks by delta desc; counts distinct recordings; computes lift + timing mode", () => {
    expect(e.rows.map((r) => r.label)).toEqual([
      "Assumptive close",
      "Warm greeting",
    ]);
    const close = e.rows[0];
    expect(close).toMatchObject({
      timesUsed: 3,
      soldWhenUsed: 3,
      closingRateWhenUsed: 100,
    });
    expect(close.delta).toBe(50);
    expect(close.typicalTiming).toBe("closing");
    const greet = e.rows[1];
    // r1(sold), r2, r5, r6 → 4 distinct recordings (the dup r1 + ghost excluded)
    expect(greet.timesUsed).toBe(4);
    expect(greet.soldWhenUsed).toBe(1);
    expect(greet.closingRateWhenUsed).toBe(25);
    expect(greet.delta).toBe(-25);
  });
});
