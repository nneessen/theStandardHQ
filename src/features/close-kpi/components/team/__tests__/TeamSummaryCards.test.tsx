// src/features/close-kpi/components/team/__tests__/TeamSummaryCards.test.tsx
//
// Verifies TeamSummaryCards math — especially the weighted connect rate which
// MUST be sum(connects)/sum(dials), not mean of per-row rates. The reviewer
// rubric flagged this specifically because mean-of-rates would silently let a
// 1-dial outlier dominate the team metric.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamSummaryCards } from "../TeamSummaryCards";
import type { TeamPipelineRow } from "../../../types/team-kpi.types";

function makeRow(overrides: Partial<TeamPipelineRow> = {}): TeamPipelineRow {
  return {
    userId: "u-1",
    firstName: "Test",
    lastName: "User",
    email: "t@example.com",
    profilePhotoUrl: null,
    isSelf: false,
    hasCloseConfig: true,
    lastScoredAt: new Date().toISOString(),
    totalLeads: 0,
    hotCount: 0,
    warmingCount: 0,
    neutralCount: 0,
    coolingCount: 0,
    coldCount: 0,
    avgScore: null,
    totalDials: 0,
    totalConnects: 0,
    connectRate: null,
    staleLeadsCount: 0,
    untouchedActive: 0,
    noAnswerStreak: 0,
    straightToVm: 0,
    activeOppsCount: 0,
    openOppValueUsd: 0,
    ...overrides,
  };
}

describe("TeamSummaryCards", () => {
  it("computes weighted connect rate as sum/sum, not mean of rates", () => {
    // Agent A: 1 dial, 1 connect → 100% rate
    // Agent B: 999 dials, 100 connects → ~10% rate
    //   Mean of rates = 55% (wrong — A's tiny sample dominates)
    //   Weighted    = 101/1000 = 10.1% (correct)
    const rows = [
      makeRow({ userId: "a", totalDials: 1, totalConnects: 1 }),
      makeRow({ userId: "b", totalDials: 999, totalConnects: 100 }),
    ];
    render(<TeamSummaryCards rows={rows} />);
    // Connect Rate tile should read "10.1%", not "55.0%"
    expect(screen.getByText("10.1%")).toBeInTheDocument();
    expect(screen.queryByText("55.0%")).not.toBeInTheDocument();
  });

  it("renders dash when no dials team-wide", () => {
    const rows = [makeRow({ totalDials: 0, totalConnects: 0 })];
    render(<TeamSummaryCards rows={rows} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("counts an agent as active when last scored within 90 minutes", () => {
    const inWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 60m ago
    const outWindow = new Date(Date.now() - 91 * 60 * 1000).toISOString(); // 91m ago
    const rows = [
      makeRow({ userId: "in", lastScoredAt: inWindow }),
      makeRow({ userId: "out", lastScoredAt: outWindow }),
      makeRow({ userId: "null", lastScoredAt: null }),
    ];
    render(<TeamSummaryCards rows={rows} />);
    // Active count tile shows "1" of "3"
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("of 3")).toBeInTheDocument();
  });

  it("sums totalDials, totalConnects, and hotCount across rows", () => {
    const rows = [
      makeRow({
        userId: "a",
        totalDials: 1234,
        totalConnects: 200,
        hotCount: 10,
      }),
      makeRow({
        userId: "b",
        totalDials: 800,
        totalConnects: 150,
        hotCount: 25,
      }),
    ];
    render(<TeamSummaryCards rows={rows} />);
    // Total dials: 1234 + 800 = 2,034
    expect(screen.getByText("2,034")).toBeInTheDocument();
    // Connects subtitle: 200 + 150 = 350
    expect(screen.getByText("350 connects")).toBeInTheDocument();
    // Hot leads: 10 + 25 = 35
    expect(screen.getByText("35")).toBeInTheDocument();
  });
});
