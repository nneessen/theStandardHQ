import { describe, expect, it } from "vitest";

import {
  isExcludedLeadHeatStatusLabel,
  isClosedWonLeadHeatStatusLabel,
  isRankableLeadHeatSignals,
  mapLeadHeatAiInsightsRow,
} from "../lead-heat";

describe("lead heat helpers", () => {
  it("excludes post-sale statuses", () => {
    expect(isExcludedLeadHeatStatusLabel("Sold")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Policy Pending")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Won - Cross Sell")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Issued And Paid")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("In Force")).toBe(true);
  });

  it("deprecated alias still works", () => {
    expect(isClosedWonLeadHeatStatusLabel("Sold")).toBe(true);
  });

  it("excludes appointment-stage statuses", () => {
    expect(isExcludedLeadHeatStatusLabel("Appointment Scheduled By Me")).toBe(
      true,
    );
    expect(isExcludedLeadHeatStatusLabel("Appointment By Bot")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Appointment Scheduled By Lead")).toBe(
      true,
    );
    expect(isExcludedLeadHeatStatusLabel("Contacted/Missed Appointment")).toBe(
      true,
    );
  });

  it("excludes terminal / disqualified statuses", () => {
    expect(isExcludedLeadHeatStatusLabel("Not Interested")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Do Not Contact")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("DNC")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Disqualified/Declined")).toBe(true);
  });

  it("excludes contacted / worked statuses", () => {
    expect(isExcludedLeadHeatStatusLabel("Contacted")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Contacted/Quoted")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Spoke - Call Back")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Texting")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Call Back")).toBe(true);
  });

  it("excludes negative contact outcomes", () => {
    expect(isExcludedLeadHeatStatusLabel("Voicemail")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("No Answer")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("No Answer 3")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Straight to VM")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Hung Up")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Bad Number")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Blocked")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Not In Service")).toBe(true);
  });

  it("excludes dead / lost / no show", () => {
    expect(isExcludedLeadHeatStatusLabel("Dead")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Lost")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("No Show")).toBe(true);
  });

  it("excludes progressed statuses", () => {
    expect(isExcludedLeadHeatStatusLabel("Quoted")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("Application")).toBe(true);
    expect(isExcludedLeadHeatStatusLabel("PENDING UNDERWRITING")).toBe(true);
  });

  it("keeps untouched / initial statuses", () => {
    expect(isExcludedLeadHeatStatusLabel("Potential")).toBe(false);
    expect(isExcludedLeadHeatStatusLabel("New Lead")).toBe(false);
    expect(isExcludedLeadHeatStatusLabel("Open")).toBe(false);
  });

  it("filters out won opportunities even when status text is neutral", () => {
    expect(
      isRankableLeadHeatSignals({
        currentStatusLabel: "Potential",
        hasWonOpportunity: true,
      }),
    ).toBe(false);
  });

  it("filters all agent-assigned leads as non-rankable", () => {
    expect(
      isRankableLeadHeatSignals({
        currentStatusLabel: "Contacted",
        hasWonOpportunity: false,
      }),
    ).toBe(false);

    expect(
      isRankableLeadHeatSignals({
        currentStatusLabel: "No Answer",
        hasWonOpportunity: false,
      }),
    ).toBe(false);

    expect(
      isRankableLeadHeatSignals({
        currentStatusLabel: "Appointment Scheduled By Me",
        hasWonOpportunity: false,
      }),
    ).toBe(false);
  });

  it("keeps untouched leads as rankable", () => {
    expect(
      isRankableLeadHeatSignals({
        currentStatusLabel: "Potential",
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
