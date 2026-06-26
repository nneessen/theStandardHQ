// Unit tests for the Social Studio preview model — the pure core extracted so the
// confirmed bugs have regression coverage with no React in the way:
//   #1 monthly zero-producer crash, #4 empty-card export, #6 sample bleed/timezone,
//   #8 forced-sample, plus the #2 submitted-vs-approved count selection.

import { describe, it, expect } from "vitest";
import {
  resolveSampleState,
  buildPeriodLabels,
  buildPreviewData,
  buildPreviewPages,
  type ProducerRow,
} from "../previewModel";
import { DEFAULT_CONFIG, type SocialStudioConfig } from "../types";

const LABELS = {
  dateLabel: "JUN 20, 2026",
  monthLabel: "JUNE 2026",
  weekRange: "JUN 14–20",
};
const cfg = (over: Partial<SocialStudioConfig>): SocialStudioConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

describe("resolveSampleState", () => {
  it("forces sample for EVERY view when there are zero producers (#1/#4 root)", () => {
    for (const view of ["daily", "weekly", "monthly", "aotw"] as const) {
      const s = resolveSampleState({
        view,
        producersCount: 0,
        isLoading: false,
        sampleOverride: null,
      });
      expect(s.isSample).toBe(true);
      expect(s.sampleForced).toBe(true);
    }
  });

  it("stays forced-sample even when the toggle is OFF, if there is no live data (#1/#4)", () => {
    // The exact trigger of the old monthly crash + empty export: user flips sample
    // off, but the agency has no producers. Must remain sample.
    const s = resolveSampleState({
      view: "monthly",
      producersCount: 0,
      isLoading: false,
      sampleOverride: false,
    });
    expect(s.isSample).toBe(true);
    expect(s.sampleForced).toBe(true);
  });

  it("auto-samples a thin leaderboard (<5) but lets the owner toggle to live", () => {
    expect(
      resolveSampleState({
        view: "daily",
        producersCount: 3,
        isLoading: false,
        sampleOverride: null,
      }).isSample,
    ).toBe(true);
    expect(
      resolveSampleState({
        view: "daily",
        producersCount: 3,
        isLoading: false,
        sampleOverride: false,
      }).isSample,
    ).toBe(false);
  });

  it("shows live for a full leaderboard (>=5) and for AOTW with a single producer", () => {
    expect(
      resolveSampleState({
        view: "daily",
        producersCount: 10,
        isLoading: false,
        sampleOverride: null,
      }).isSample,
    ).toBe(false);
    expect(
      resolveSampleState({
        view: "aotw",
        producersCount: 1,
        isLoading: false,
        sampleOverride: null,
      }).isSample,
    ).toBe(false);
  });

  it("never forces sample while live producers exist (toggle stays enabled)", () => {
    expect(
      resolveSampleState({
        view: "daily",
        producersCount: 1,
        isLoading: false,
        sampleOverride: null,
      }).sampleForced,
    ).toBe(false);
  });
});

describe("buildPeriodLabels (matches the LOCAL data window — calculateDateRange)", () => {
  it("stamps the daily/monthly label from the LOCAL calendar date, not UTC", () => {
    // 8pm LOCAL on Jun 25 is already Jun 26 in UTC. The data window now keys off the
    // LOCAL day (Jun 25) so the daily leaderboard isn't empty an evening early — and the
    // label must match the data → JUN 25. Constructed from LOCAL components so it's
    // deterministic in any test-runner timezone. (Old code keyed off the UTC date → JUN 26,
    // contradicting the data and emptying the daily card every evening for the Americas.)
    const { dateLabel, monthLabel } = buildPeriodLabels(
      new Date(2026, 5, 25, 20, 0, 0),
    );
    expect(dateLabel).toBe("JUN 25, 2026");
    expect(monthLabel).toBe("JUNE 2026");
  });

  it("reflects the report's local month", () => {
    expect(buildPeriodLabels(new Date(2026, 6, 15, 12, 0, 0)).monthLabel).toBe(
      "JULY 2026",
    );
  });

  it("produces a well-formed week-to-date range", () => {
    expect(
      buildPeriodLabels(new Date(2026, 5, 25, 12, 0, 0)).weekRange,
    ).toMatch(/^[A-Z]{3} \d{1,2}–/);
  });
});

describe("buildPreviewData", () => {
  it("does NOT crash on the monthly live path with zero producers (#1 regression)", () => {
    // isSample=false + empty producers was the exact crash (producers[0].agentName).
    // The defensive useLive guard must fall back to the sample report instead.
    const data = buildPreviewData({
      config: cfg({ view: "monthly" }),
      producers: [],
      isSample: false,
      labels: LABELS,
    });
    expect(data.kind).toBe("report");
    if (data.kind === "report") expect(data.topPerformer.name).toBeTruthy();
  });

  it("builds the monthly report from real producers when live", () => {
    const producers: ProducerRow[] = [
      { agentName: "Marcus Webb", apTotal: 52400, policyCount: 1 },
      { agentName: "Alyssa Chen", apTotal: 30000, policyCount: 2 },
    ];
    const data = buildPreviewData({
      config: cfg({ view: "monthly" }),
      producers,
      isSample: false,
      labels: LABELS,
    });
    expect(data.kind).toBe("report");
    if (data.kind === "report") {
      expect(data.topPerformer.name).toBe("Marcus W.");
      expect(data.totalAp).toBe(82400);
    }
  });

  it("prefers submittedPolicies (matches AP) over the legacy approved count (#2)", () => {
    const producers: ProducerRow[] = [
      {
        agentName: "Marcus Webb",
        apTotal: 52400,
        policyCount: 1,
        submittedPolicies: 7,
      },
    ];
    const data = buildPreviewData({
      config: cfg({ view: "aotw" }),
      producers,
      isSample: false,
      labels: LABELS,
    });
    if (data.kind === "aotw") expect(data.agent.policies).toBe(7);
  });

  it("falls back to policyCount when submittedPolicies is absent (#2 back-compat)", () => {
    const producers: ProducerRow[] = [
      { agentName: "Marcus Webb", apTotal: 52400, policyCount: 3 },
    ];
    const data = buildPreviewData({
      config: cfg({ view: "aotw" }),
      producers,
      isSample: false,
      labels: LABELS,
    });
    if (data.kind === "aotw") expect(data.agent.policies).toBe(3);
  });

  it("returns the labeled sample leaderboard when isSample is true", () => {
    const data = buildPreviewData({
      config: cfg({ view: "daily" }),
      producers: [{ agentName: "Real Person", apTotal: 999, policyCount: 1 }],
      isSample: true,
      labels: LABELS,
    });
    expect(data.kind).toBe("leaderboard");
    if (data.kind === "leaderboard") {
      // sample rows, not the single real producer
      expect(data.rows.length).toBeGreaterThan(1);
      expect(data.periodLabel).toContain("DAILY");
    }
  });

  it("caps live leaderboard rows at the requested topN", () => {
    const producers: ProducerRow[] = Array.from({ length: 12 }, (_, i) => ({
      agentName: `Agent ${i}`,
      apTotal: 1000 - i,
      policyCount: 1,
    }));
    const data = buildPreviewData({
      config: cfg({ view: "daily", topN: 5 }),
      producers,
      isSample: false,
      labels: LABELS,
    });
    if (data.kind === "leaderboard") expect(data.rows).toHaveLength(5);
  });
});

describe("buildPreviewPages (pagination — WI-4)", () => {
  const makeProducers = (n: number): ProducerRow[] =>
    Array.from({ length: n }, (_, i) => ({
      agentName: `Agent ${String(i).padStart(2, "0")}`,
      apTotal: 10000 - i,
      policyCount: 1,
    }));
  const ranksOf = (pages: ReturnType<typeof buildPreviewPages>): number[] =>
    pages.flatMap((p) =>
      p.kind === "leaderboard" ? p.rows.map((r) => r.rank) : [],
    );

  it("paginates the whole agency into contiguous, gap-free pages", () => {
    const pages = buildPreviewPages({
      config: cfg({ view: "daily", format: "portrait", topN: "all" }),
      producers: makeProducers(25),
      isSample: false,
      labels: LABELS,
    });
    // 25 rows / 10 per portrait page = 3 pages (10, 10, 5).
    expect(pages).toHaveLength(3);
    expect(ranksOf(pages)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    // Every page stamped index/total and carries the SAME agency total AP.
    const expectedTotal = 250000 - (24 * 25) / 2; // sum(10000-i, i=0..24)
    pages.forEach((p, i) => {
      // All daily pages are leaderboard cards (narrowed for `page`/`totalAp`).
      if (p.kind === "leaderboard") {
        expect(p.page).toEqual({ index: i + 1, total: 3 });
        expect(p.totalAp).toBe(expectedTotal);
      }
    });
    // Lead title reflects the SELECTED total, not the per-page slice length.
    if (pages[0].kind === "leaderboard")
      expect(pages[0].title).toBe("TOP 25 AGENTS");
  });

  it("honors a numeric Top-N cap before paginating", () => {
    const pages = buildPreviewPages({
      config: cfg({ view: "daily", format: "portrait", topN: 20 }),
      producers: makeProducers(50),
      isSample: false,
      labels: LABELS,
    });
    expect(pages).toHaveLength(2); // 20 selected / 10
    expect(ranksOf(pages)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("leaves a single page UNstamped (no PAGE x/N on a one-card post)", () => {
    const pages = buildPreviewPages({
      config: cfg({ view: "daily", format: "portrait", topN: 5 }),
      producers: makeProducers(25),
      isSample: false,
      labels: LABELS,
    });
    expect(pages).toHaveLength(1);
    if (pages[0].kind === "leaderboard") expect(pages[0].page).toBeUndefined();
  });

  it("monthly: recap slide 1, then contiguous leaderboard continuation", () => {
    const pages = buildPreviewPages({
      config: cfg({ view: "monthly", format: "portrait", topN: "all" }),
      producers: makeProducers(20),
      isSample: false,
      labels: LABELS,
    });
    // recap holds 5; remaining 15 / 10 = 2 cont pages → 3 total.
    expect(pages).toHaveLength(3);
    expect(pages[0].kind).toBe("report");
    expect(pages[1].kind).toBe("leaderboard");
    if (pages[1].kind === "leaderboard") expect(pages[1].rows[0].rank).toBe(6); // continues after the recap's top 5
    if (pages[2].kind === "leaderboard") expect(pages[2].rows[0].rank).toBe(16);
  });

  it("aotw is always a single hero slide", () => {
    const pages = buildPreviewPages({
      config: cfg({ view: "aotw", topN: "all" }),
      producers: makeProducers(40),
      isSample: false,
      labels: LABELS,
    });
    expect(pages).toHaveLength(1);
    expect(pages[0].kind).toBe("aotw");
  });
});
