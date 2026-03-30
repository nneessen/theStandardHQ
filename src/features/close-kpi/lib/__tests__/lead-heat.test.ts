import { describe, expect, it } from "vitest";

import {
  isClosedWonLeadHeatStatusLabel,
  isRankableLeadHeatSignals,
  mapLeadHeatAiInsightsRow,
} from "../lead-heat";

describe("lead heat helpers", () => {
  it("treats sold and won statuses as non-rankable", () => {
    expect(isClosedWonLeadHeatStatusLabel("Sold")).toBe(true);
    expect(isClosedWonLeadHeatStatusLabel("Policy Pending")).toBe(true);
    expect(isClosedWonLeadHeatStatusLabel("Won - Cross Sell")).toBe(true);
    expect(isClosedWonLeadHeatStatusLabel("Contacted")).toBe(false);
  });

  it("filters out won opportunities even when status text is neutral", () => {
    expect(
      isRankableLeadHeatSignals({
        currentStatusLabel: "Not Interested",
        hasWonOpportunity: true,
      }),
    ).toBe(false);

    expect(
      isRankableLeadHeatSignals({
        currentStatusLabel: "Quoted Veterans",
        hasWonOpportunity: false,
      }),
    ).toBe(true);
  });

  it("maps persisted AI analysis payload into widget data", () => {
    expect(
      mapLeadHeatAiInsightsRow(
        {
          analysis: {
            overall: "Focus follow-up on inbound-call leads this week.",
            insights: [
              {
                title: "Inbound calls convert",
                description: "Inbound-call leads outperform the rest.",
              },
            ],
          },
          anomalies: [
            {
              closeLeadId: "lead-1",
              displayName: "Taylor Test",
              type: "hidden_gem",
              message: "High engagement despite low score.",
              urgency: "high",
              score: 62,
            },
          ],
          recommendations: [
            { text: "Prioritize hot inbound leads first.", priority: "high" },
          ],
          weight_adjustments: [
            {
              signalKey: "inboundCalls",
              recommendedMultiplier: 1.2,
              reason: "Converted leads skew inbound.",
            },
          ],
          analyzed_at: "2026-03-30T20:30:00.000Z",
        },
        { version: 3, sample_size: 18 },
      ),
    ).toEqual({
      recommendations: [
        { text: "Prioritize hot inbound leads first.", priority: "high" },
      ],
      anomalies: [
        {
          closeLeadId: "lead-1",
          displayName: "Taylor Test",
          type: "hidden_gem",
          message: "High engagement despite low score.",
          urgency: "high",
          score: 62,
        },
      ],
      patterns: [
        {
          title: "Inbound calls convert",
          description: "Inbound-call leads outperform the rest.",
        },
      ],
      weightAdjustments: [
        {
          signalKey: "inboundCalls",
          recommendedMultiplier: 1.2,
          reason: "Converted leads skew inbound.",
        },
      ],
      modelVersion: 3,
      sampleSize: 18,
      analyzedAt: "2026-03-30T20:30:00.000Z",
      overallAssessment: "Focus follow-up on inbound-call leads this week.",
    });
  });
});
