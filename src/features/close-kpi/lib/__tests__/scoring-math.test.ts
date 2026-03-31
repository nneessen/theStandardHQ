import { describe, it, expect } from "vitest";
import {
  scoreCallAnswerRate,
  scoreEmailReplyRate,
  scoreSmsResponseRate,
  scoreLastInteractionRecency,
  scoreInboundCalls,
  scoreQuoteRequested,
  scoreEmailEngagement,
  scoreAppointment,
  scoreLeadAge,
  scoreTimeSinceTouch,
  scoreTimeInStatus,
  scoreStatusVelocity,
  scoreHasOpportunity,
  scoreOpportunityValue,
  scoreSourceQuality,
  penaltyConsecutiveNoAnswers,
  penaltyStraightToVm,
  penaltyBadStatus,
  penaltyStagnation,
  getHeatLevel,
  getTrendDirection,
  MAX_POINTS,
  TOTAL_POSITIVE_BUDGET,
} from "../scoring-math";

// ═══════════════════════════════════════════════════════════════════════
// ENGAGEMENT SIGNALS
// ═══════════════════════════════════════════════════════════════════════

describe("scoreCallAnswerRate", () => {
  it("returns 0 when no outbound calls", () => {
    expect(scoreCallAnswerRate(5, 0)).toBe(0);
  });
  it("returns 8 for 50%+ answer rate", () => {
    expect(scoreCallAnswerRate(5, 10)).toBe(8);
  });
  it("returns 6 for 35-49%", () => {
    expect(scoreCallAnswerRate(35, 100)).toBe(6);
  });
  it("returns 4 for 20-34%", () => {
    expect(scoreCallAnswerRate(20, 100)).toBe(4);
  });
  it("returns 2 for 10-19%", () => {
    expect(scoreCallAnswerRate(10, 100)).toBe(2);
  });
  it("returns 1 for >0 but <10%", () => {
    expect(scoreCallAnswerRate(1, 100)).toBe(1);
  });
  it("returns 0 for 0% with outbound calls", () => {
    expect(scoreCallAnswerRate(0, 50)).toBe(0);
  });
});

describe("scoreEmailReplyRate", () => {
  it("returns 5 for inbound-only (no outbound)", () => {
    expect(scoreEmailReplyRate(3, 0)).toBe(5);
  });
  it("returns 0 for no emails at all", () => {
    expect(scoreEmailReplyRate(0, 0)).toBe(0);
  });
  it("returns 5 for 40%+ reply rate", () => {
    expect(scoreEmailReplyRate(4, 10)).toBe(5);
  });
  it("returns 1 for very low reply rate", () => {
    expect(scoreEmailReplyRate(1, 100)).toBe(1);
  });
});

describe("scoreSmsResponseRate", () => {
  it("mirrors email reply rate logic", () => {
    expect(scoreSmsResponseRate(3, 0)).toBe(5);
    expect(scoreSmsResponseRate(0, 0)).toBe(0);
    expect(scoreSmsResponseRate(4, 10)).toBe(5);
  });
});

describe("scoreLastInteractionRecency", () => {
  it("returns 0 for null", () => {
    expect(scoreLastInteractionRecency(null)).toBe(0);
  });
  it("returns 7 for very recent (<=4h)", () => {
    expect(scoreLastInteractionRecency(2)).toBe(7);
  });
  it("returns 5 for 24h", () => {
    expect(scoreLastInteractionRecency(24)).toBe(5);
  });
  it("returns 0 for very stale (>2 weeks)", () => {
    expect(scoreLastInteractionRecency(500)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BEHAVIORAL SIGNALS
// ═══════════════════════════════════════════════════════════════════════

describe("scoreInboundCalls", () => {
  it("returns 10 for 3+ inbound calls", () => {
    expect(scoreInboundCalls(3)).toBe(10);
    expect(scoreInboundCalls(10)).toBe(10);
  });
  it("returns 6 for 1 inbound call", () => {
    expect(scoreInboundCalls(1)).toBe(6);
  });
  it("returns 0 for no inbound calls", () => {
    expect(scoreInboundCalls(0)).toBe(0);
  });
});

describe("scoreQuoteRequested", () => {
  it("returns 5 for quoted status", () => {
    expect(scoreQuoteRequested(true, 0)).toBe(5);
  });
  it("returns 4 for 2+ positive advances without quote", () => {
    expect(scoreQuoteRequested(false, 2)).toBe(4);
  });
  it("returns 0 for no signals", () => {
    expect(scoreQuoteRequested(false, 0)).toBe(0);
  });
});

describe("scoreEmailEngagement", () => {
  it("returns 3 for 3+ emails", () => {
    expect(scoreEmailEngagement(3)).toBe(3);
  });
  it("returns 2 for 1-2 emails", () => {
    expect(scoreEmailEngagement(1)).toBe(2);
  });
  it("returns 0 for none", () => {
    expect(scoreEmailEngagement(0)).toBe(0);
  });
});

describe("scoreAppointment", () => {
  it("returns 2 for callback", () => {
    expect(scoreAppointment(true)).toBe(2);
  });
  it("returns 0 for no callback", () => {
    expect(scoreAppointment(false)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEMPORAL SIGNALS
// ═══════════════════════════════════════════════════════════════════════

describe("scoreLeadAge", () => {
  it("returns 5 for brand new (<=3 days)", () => {
    expect(scoreLeadAge(1)).toBe(5);
  });
  it("returns 0 for old leads (>60 days)", () => {
    expect(scoreLeadAge(90)).toBe(0);
  });
});

describe("scoreTimeSinceTouch", () => {
  it("returns 0 for null", () => {
    expect(scoreTimeSinceTouch(null)).toBe(0);
  });
  it("returns 5 for today", () => {
    expect(scoreTimeSinceTouch(0.5)).toBe(5);
  });
  it("returns 0 for stale (>30 days)", () => {
    expect(scoreTimeSinceTouch(45)).toBe(0);
  });
});

describe("scoreTimeInStatus", () => {
  it("returns 2 for null (unknown)", () => {
    expect(scoreTimeInStatus(null, false)).toBe(2);
  });
  it("positive status: 5 for <=7 days", () => {
    expect(scoreTimeInStatus(5, true)).toBe(5);
  });
  it("negative status: 0 for >14 days", () => {
    expect(scoreTimeInStatus(20, false)).toBe(0);
  });
});

describe("scoreStatusVelocity", () => {
  it("returns 5 for strong positive net", () => {
    expect(scoreStatusVelocity(4, 1)).toBe(5);
  });
  it("returns 1 for no changes at all", () => {
    expect(scoreStatusVelocity(0, 0)).toBe(1);
  });
  it("returns 0 for net negative", () => {
    expect(scoreStatusVelocity(0, 2)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PIPELINE SIGNALS
// ═══════════════════════════════════════════════════════════════════════

describe("scoreHasOpportunity", () => {
  it("returns 6 for active opportunity", () => {
    expect(scoreHasOpportunity(true, true)).toBe(6);
  });
  it("returns 2 for closed opportunity only", () => {
    expect(scoreHasOpportunity(false, true)).toBe(2);
  });
  it("returns 0 for no opportunity", () => {
    expect(scoreHasOpportunity(false, false)).toBe(0);
  });
});

describe("scoreOpportunityValue", () => {
  it("returns 4 for high value ($5000+)", () => {
    expect(scoreOpportunityValue(10000)).toBe(4);
  });
  it("returns 0 for null", () => {
    expect(scoreOpportunityValue(null)).toBe(0);
  });
  it("returns 1 for small value", () => {
    expect(scoreOpportunityValue(100)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HISTORICAL SIGNALS
// ═══════════════════════════════════════════════════════════════════════

describe("scoreSourceQuality", () => {
  it("returns 2 for unknown source (null)", () => {
    expect(scoreSourceQuality(null)).toBe(2);
  });
  it("returns 5 for high conversion rate", () => {
    expect(scoreSourceQuality(0.2)).toBe(5);
  });
  it("returns 0 for zero conversion", () => {
    expect(scoreSourceQuality(0)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PENALTIES
// ═══════════════════════════════════════════════════════════════════════

describe("penaltyConsecutiveNoAnswers", () => {
  it("returns -5 for 5+ no-answers", () => {
    expect(penaltyConsecutiveNoAnswers(5)).toBe(-5);
  });
  it("returns -3 for 3-4 no-answers", () => {
    expect(penaltyConsecutiveNoAnswers(3)).toBe(-3);
  });
  it("returns 0 for <3", () => {
    expect(penaltyConsecutiveNoAnswers(2)).toBe(0);
  });
});

describe("penaltyStraightToVm", () => {
  it("returns -3 for 3+ VMs", () => {
    expect(penaltyStraightToVm(3)).toBe(-3);
  });
  it("returns -1 for 2 VMs", () => {
    expect(penaltyStraightToVm(2)).toBe(-1);
  });
  it("returns 0 for <2", () => {
    expect(penaltyStraightToVm(1)).toBe(0);
  });
});

describe("penaltyBadStatus", () => {
  it("returns -8 for blocked", () => {
    expect(penaltyBadStatus(true, false, false)).toBe(-8);
  });
  it("returns -8 for not-in-service", () => {
    expect(penaltyBadStatus(false, true, false)).toBe(-8);
  });
  it("returns -5 for hung up", () => {
    expect(penaltyBadStatus(false, false, true)).toBe(-5);
  });
  it("returns 0 for clean status", () => {
    expect(penaltyBadStatus(false, false, false)).toBe(0);
  });
});

describe("penaltyStagnation", () => {
  it("returns -4 for 45+ days inactive", () => {
    expect(penaltyStagnation(50)).toBe(-4);
  });
  it("returns 0 for null", () => {
    expect(penaltyStagnation(null)).toBe(0);
  });
  it("returns 0 for recent activity", () => {
    expect(penaltyStagnation(30)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════

describe("getHeatLevel", () => {
  it("returns correct levels at boundaries", () => {
    expect(getHeatLevel(100)).toBe("hot");
    expect(getHeatLevel(75)).toBe("hot");
    expect(getHeatLevel(74)).toBe("warming");
    expect(getHeatLevel(55)).toBe("warming");
    expect(getHeatLevel(54)).toBe("neutral");
    expect(getHeatLevel(35)).toBe("neutral");
    expect(getHeatLevel(34)).toBe("cooling");
    expect(getHeatLevel(15)).toBe("cooling");
    expect(getHeatLevel(14)).toBe("cold");
    expect(getHeatLevel(0)).toBe("cold");
  });
});

describe("getTrendDirection", () => {
  it("returns right for no previous score", () => {
    expect(getTrendDirection(50, null)).toBe("right");
  });
  it("returns up for large increase", () => {
    expect(getTrendDirection(80, 60)).toBe("up");
  });
  it("returns down for large decrease", () => {
    expect(getTrendDirection(20, 50)).toBe("down");
  });
  it("returns right for stable", () => {
    expect(getTrendDirection(50, 50)).toBe("right");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BUDGET INTEGRITY
// ═══════════════════════════════════════════════════════════════════════

describe("point budget", () => {
  it("total positive budget is 90", () => {
    expect(TOTAL_POSITIVE_BUDGET).toBe(90);
  });

  it("all signal categories sum correctly", () => {
    const engagement =
      MAX_POINTS.engagementRecency +
      MAX_POINTS.callAnswerRate +
      MAX_POINTS.emailReplyRate +
      MAX_POINTS.smsResponseRate;
    const behavioral =
      MAX_POINTS.inboundCalls +
      MAX_POINTS.quoteRequested +
      MAX_POINTS.emailEngagement +
      MAX_POINTS.appointment;
    const temporal =
      MAX_POINTS.leadAge +
      MAX_POINTS.timeSinceTouch +
      MAX_POINTS.timeInStatus +
      MAX_POINTS.statusVelocity;
    const pipeline = MAX_POINTS.hasOpportunity + MAX_POINTS.opportunityValue;
    const historical = MAX_POINTS.sourceQuality;

    expect(engagement).toBe(27);
    expect(behavioral).toBe(25);
    expect(temporal).toBe(20);
    expect(pipeline).toBe(13);
    expect(historical).toBe(5);
    expect(engagement + behavioral + temporal + pipeline + historical).toBe(90);
  });

  it("no individual scoring function exceeds its max points", () => {
    // Engagement
    expect(scoreCallAnswerRate(1000, 1)).toBeLessThanOrEqual(
      MAX_POINTS.callAnswerRate,
    );
    expect(scoreEmailReplyRate(1000, 1)).toBeLessThanOrEqual(
      MAX_POINTS.emailReplyRate,
    );
    expect(scoreSmsResponseRate(1000, 1)).toBeLessThanOrEqual(
      MAX_POINTS.smsResponseRate,
    );
    expect(scoreLastInteractionRecency(0)).toBeLessThanOrEqual(
      MAX_POINTS.engagementRecency,
    );
    // Behavioral
    expect(scoreInboundCalls(100)).toBeLessThanOrEqual(MAX_POINTS.inboundCalls);
    expect(scoreQuoteRequested(true, 10)).toBeLessThanOrEqual(
      MAX_POINTS.quoteRequested,
    );
    expect(scoreEmailEngagement(100)).toBeLessThanOrEqual(
      MAX_POINTS.emailEngagement,
    );
    expect(scoreAppointment(true)).toBeLessThanOrEqual(MAX_POINTS.appointment);
    // Temporal
    expect(scoreLeadAge(0)).toBeLessThanOrEqual(MAX_POINTS.leadAge);
    expect(scoreTimeSinceTouch(0)).toBeLessThanOrEqual(
      MAX_POINTS.timeSinceTouch,
    );
    expect(scoreTimeInStatus(1, true)).toBeLessThanOrEqual(
      MAX_POINTS.timeInStatus,
    );
    expect(scoreStatusVelocity(10, 0)).toBeLessThanOrEqual(
      MAX_POINTS.statusVelocity,
    );
    // Pipeline
    expect(scoreHasOpportunity(true, true)).toBeLessThanOrEqual(
      MAX_POINTS.hasOpportunity,
    );
    expect(scoreOpportunityValue(100000)).toBeLessThanOrEqual(
      MAX_POINTS.opportunityValue,
    );
    // Historical
    expect(scoreSourceQuality(1.0)).toBeLessThanOrEqual(
      MAX_POINTS.sourceQuality,
    );
  });

  it("all penalties are negative or zero", () => {
    expect(penaltyConsecutiveNoAnswers(10)).toBeLessThanOrEqual(0);
    expect(penaltyStraightToVm(10)).toBeLessThanOrEqual(0);
    expect(penaltyBadStatus(true, true, true)).toBeLessThanOrEqual(0);
    expect(penaltyStagnation(100)).toBeLessThanOrEqual(0);
  });

  it("max penalty is -20", () => {
    const worst =
      penaltyConsecutiveNoAnswers(10) +
      penaltyStraightToVm(10) +
      penaltyBadStatus(true, false, false) +
      penaltyStagnation(100);
    expect(worst).toBe(-20);
  });
});
