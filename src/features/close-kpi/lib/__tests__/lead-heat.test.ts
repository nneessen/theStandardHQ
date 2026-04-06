import { describe, expect, it } from "vitest";

import { mapLeadHeatAiInsightsRow } from "../lead-heat";

// Note: status filtering tests previously lived here (isExcludedLeadHeatStatusLabel
// and isRankableLeadHeatSignals). They were removed alongside those helpers
// because filtering is now DB-side via the lead_heat_status_config table.
// The canonical heuristic lives in
// supabase/functions/close-lead-heat-score/status-classification.ts.

describe("lead heat helpers", () => {
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
