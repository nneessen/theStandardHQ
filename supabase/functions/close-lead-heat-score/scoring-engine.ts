// supabase/functions/close-lead-heat-score/scoring-engine.ts
// Pure-function deterministic scoring engine for lead heat index.
// Modeled after leadVendorHeatService.ts — component-based additive scoring (0-100).

import type {
  LeadSignals,
  ScoreBreakdown,
  AgentWeights,
  HeatLevel,
  TrendDirection,
} from "./types.ts";

// ═══════════════════════════════════════════════════════════════════════
// ENGAGEMENT SIGNALS (27 pts max)
// ═══════════════════════════════════════════════════════════════════════

/** Call answer rate: lead answers agent's outbound calls (0-8 pts) */
function scoreCallAnswerRate(answered: number, totalOutbound: number): number {
  if (totalOutbound === 0) return 0;
  const rate = answered / totalOutbound;
  if (rate >= 0.5) return 8;
  if (rate >= 0.35) return 6;
  if (rate >= 0.2) return 4;
  if (rate >= 0.1) return 2;
  if (rate > 0) return 1;
  return 0;
}

/** Email reply rate: lead sends emails to agent (0-5 pts) */
function scoreEmailReplyRate(inbound: number, outbound: number): number {
  if (outbound === 0) return inbound > 0 ? 5 : 0;
  const rate = inbound / outbound;
  if (rate >= 0.4) return 5;
  if (rate >= 0.25) return 4;
  if (rate >= 0.15) return 3;
  if (rate >= 0.05) return 2;
  if (rate > 0) return 1;
  return 0;
}

/** SMS response rate: lead responds to SMS (0-5 pts) */
function scoreSmsResponseRate(inbound: number, outbound: number): number {
  if (outbound === 0) return inbound > 0 ? 5 : 0;
  const rate = inbound / outbound;
  if (rate >= 0.4) return 5;
  if (rate >= 0.25) return 4;
  if (rate >= 0.15) return 3;
  if (rate >= 0.05) return 2;
  if (rate > 0) return 1;
  return 0;
}

/** Last interaction recency: hours since last touch from either side (0-7 pts) */
function scoreLastInteractionRecency(
  hoursSinceLastTouch: number | null,
): number {
  if (hoursSinceLastTouch === null) return 0;
  if (hoursSinceLastTouch <= 4) return 7;
  if (hoursSinceLastTouch <= 12) return 6;
  if (hoursSinceLastTouch <= 24) return 5;
  if (hoursSinceLastTouch <= 48) return 4;
  if (hoursSinceLastTouch <= 72) return 3;
  if (hoursSinceLastTouch <= 168) return 2; // 1 week
  if (hoursSinceLastTouch <= 336) return 1; // 2 weeks
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════
// BEHAVIORAL SIGNALS (25 pts max)
// ═══════════════════════════════════════════════════════════════════════

/** Inbound call from lead: strongest buying signal (0-10 pts) */
function scoreInboundCalls(inboundCallCount: number): number {
  if (inboundCallCount >= 3) return 10;
  if (inboundCallCount === 2) return 8;
  if (inboundCallCount === 1) return 6;
  return 0;
}

/** Quote requested / positive status advance (0-5 pts) */
function scoreQuoteRequested(
  hasQuoted: boolean,
  positiveAdvances: number,
): number {
  if (hasQuoted) return 5;
  if (positiveAdvances >= 2) return 4;
  if (positiveAdvances === 1) return 2;
  return 0;
}

/** Email opened / email engagement indicator (0-3 pts) */
function scoreEmailEngagement(emailsReceived: number): number {
  // Close doesn't expose open tracking directly, so we use inbound emails
  // as a proxy for engagement (lead is actively communicating)
  if (emailsReceived >= 3) return 3;
  if (emailsReceived >= 1) return 2;
  return 0;
}

/** Appointment booked / callback status (0-2 pts) */
function scoreAppointment(hasCallback: boolean): number {
  return hasCallback ? 2 : 0;
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPORAL SIGNALS (20 pts max)
// ═══════════════════════════════════════════════════════════════════════

/** Lead age freshness: newer leads score higher (0-5 pts) */
function scoreLeadAge(daysSinceCreation: number): number {
  if (daysSinceCreation <= 3) return 5;
  if (daysSinceCreation <= 7) return 4;
  if (daysSinceCreation <= 14) return 3;
  if (daysSinceCreation <= 30) return 2;
  if (daysSinceCreation <= 60) return 1;
  return 0;
}

/** Time since last touch: stale leads lose points (0-5 pts) */
function scoreTimeSinceTouch(daysSinceTouch: number | null): number {
  if (daysSinceTouch === null) return 0;
  if (daysSinceTouch <= 1) return 5;
  if (daysSinceTouch <= 3) return 4;
  if (daysSinceTouch <= 7) return 3;
  if (daysSinceTouch <= 14) return 2;
  if (daysSinceTouch <= 30) return 1;
  return 0;
}

/** Time stuck in current status (0-5 pts) */
function scoreTimeInStatus(
  daysInStatus: number | null,
  isPositiveStatus: boolean,
): number {
  if (daysInStatus === null) return 2; // unknown, give partial credit
  if (isPositiveStatus) {
    // Positive statuses: being there a while is less bad
    if (daysInStatus <= 7) return 5;
    if (daysInStatus <= 14) return 4;
    if (daysInStatus <= 30) return 2;
    return 1;
  }
  // Negative/neutral: time hurts more
  if (daysInStatus <= 3) return 4;
  if (daysInStatus <= 7) return 2;
  if (daysInStatus <= 14) return 1;
  return 0;
}

/** Status velocity: how fast lead is progressing (0-5 pts) */
function scoreStatusVelocity(
  positiveChanges30d: number,
  negativeChanges30d: number,
): number {
  const net = positiveChanges30d - negativeChanges30d;
  if (net >= 3) return 5;
  if (net === 2) return 4;
  if (net === 1) return 3;
  if (net === 0 && positiveChanges30d > 0) return 2;
  if (net === 0) return 1;
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════
// PIPELINE SIGNALS (13 pts max)
// ═══════════════════════════════════════════════════════════════════════

/** Has active opportunity (0-6 pts) */
function scoreHasOpportunity(
  hasActiveOpp: boolean,
  hasAnyOpp: boolean,
): number {
  if (hasActiveOpp) return 6;
  if (hasAnyOpp) return 2;
  return 0;
}

/** Opportunity value (0-4 pts) */
function scoreOpportunityValue(valueUsd: number | null): number {
  if (valueUsd === null || valueUsd <= 0) return 0;
  if (valueUsd >= 5000) return 4;
  if (valueUsd >= 2000) return 3;
  if (valueUsd >= 500) return 2;
  return 1;
}

// ═══════════════════════════════════════════════════════════════════════
// HISTORICAL SIGNALS (5 pts max)
// ═══════════════════════════════════════════════════════════════════════

/** Lead source conversion rate (0-5 pts) */
function scoreSourceQuality(sourceConversionRate: number | null): number {
  if (sourceConversionRate === null) return 2; // unknown source, neutral
  if (sourceConversionRate >= 0.15) return 5;
  if (sourceConversionRate >= 0.1) return 4;
  if (sourceConversionRate >= 0.06) return 3;
  if (sourceConversionRate >= 0.03) return 2;
  if (sourceConversionRate > 0) return 1;
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════
// NEGATIVE PENALTIES (up to -20)
// ═══════════════════════════════════════════════════════════════════════

/** Consecutive no-answers (-5 max) */
function penaltyConsecutiveNoAnswers(consecutiveNoAnswers: number): number {
  if (consecutiveNoAnswers >= 5) return -5;
  if (consecutiveNoAnswers >= 3) return -3;
  return 0;
}

/** Repeated straight-to-VM (-3 max) */
function penaltyStraightToVm(straightToVmCount: number): number {
  if (straightToVmCount >= 3) return -3;
  if (straightToVmCount >= 2) return -1;
  return 0;
}

/** Blocked / not-in-service status (-8 max) */
function penaltyBadStatus(
  isBlocked: boolean,
  isNotInService: boolean,
  isHungUp: boolean,
): number {
  if (isBlocked || isNotInService) return -8;
  if (isHungUp) return -5;
  return 0;
}

/** 45+ day stagnation with no activity (-4 max) */
function penaltyStagnation(daysSinceAnyActivity: number | null): number {
  if (daysSinceAnyActivity === null) return 0;
  if (daysSinceAnyActivity >= 45) return -4;
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════
// CLASSIFICATION (matches leadVendorHeatService.ts)
// ═══════════════════════════════════════════════════════════════════════

export function getHeatLevel(score: number): HeatLevel {
  if (score >= 75) return "hot";
  if (score >= 55) return "warming";
  if (score >= 35) return "neutral";
  if (score >= 15) return "cooling";
  return "cold";
}

export function getTrendDirection(
  currentScore: number,
  previousScore: number | null,
): TrendDirection {
  if (previousScore === null) return "right";
  const delta = currentScore - previousScore;
  if (delta >= 15) return "up";
  if (delta >= 5) return "up-right";
  if (delta >= -5) return "right";
  if (delta >= -15) return "down-right";
  return "down";
}

// ═══════════════════════════════════════════════════════════════════════
// WEIGHT APPLICATION
// ═══════════════════════════════════════════════════════════════════════

// Redistributed 10 dead-signal points (oppStageAdvances=5, aiSimilarityScore=5)
// to live signals: inboundCalls +3, engagementRecency +2, hasOpportunity +3, quoteRequested +2
const DEFAULT_MAX_POINTS: Record<string, number> = {
  engagementRecency: 9,
  callAnswerRate: 8,
  emailReplyRate: 5,
  smsResponseRate: 5,
  inboundCalls: 13,
  quoteRequested: 7,
  emailEngagement: 3,
  appointment: 2,
  leadAge: 5,
  timeSinceTouch: 5,
  timeInStatus: 5,
  statusVelocity: 5,
  hasOpportunity: 9,
  opportunityValue: 4,
  sourceQuality: 5,
};

function applyWeight(
  rawScore: number,
  signalKey: string,
  weights: AgentWeights,
): number {
  const multiplier = weights[signalKey]?.multiplier ?? 1.0;
  const maxPts = DEFAULT_MAX_POINTS[signalKey] ?? 10;
  return Math.min(maxPts, Math.round(rawScore * multiplier * 10) / 10);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════════

export interface ScoredLead {
  closeLeadId: string;
  displayName: string;
  score: number;
  heatLevel: HeatLevel;
  trend: TrendDirection;
  previousScore: number | null;
  breakdown: ScoreBreakdown;
  signals: LeadSignals;
}

export function scoreLead(
  signals: LeadSignals,
  weights: AgentWeights,
  previousScore: number | null,
): ScoredLead {
  // Engagement (27 max)
  const callAnswerRate = applyWeight(
    scoreCallAnswerRate(signals.callsAnswered, signals.callsOutbound),
    "callAnswerRate",
    weights,
  );
  const emailReplyRate = applyWeight(
    scoreEmailReplyRate(signals.emailsInbound, signals.emailsOutbound),
    "emailReplyRate",
    weights,
  );
  const smsResponseRate = applyWeight(
    scoreSmsResponseRate(signals.smsInbound, signals.smsOutbound),
    "smsResponseRate",
    weights,
  );
  const engagementRecency = applyWeight(
    scoreLastInteractionRecency(signals.hoursSinceLastTouch),
    "engagementRecency",
    weights,
  );

  // Behavioral (25 max)
  const inboundCalls = applyWeight(
    scoreInboundCalls(signals.callsInbound),
    "inboundCalls",
    weights,
  );
  const quoteRequested = applyWeight(
    scoreQuoteRequested(
      signals.hasQuotedStatus,
      signals.positiveStatusAdvances,
    ),
    "quoteRequested",
    weights,
  );
  const emailEngagement = applyWeight(
    scoreEmailEngagement(signals.emailsInbound),
    "emailEngagement",
    weights,
  );
  const appointment = applyWeight(
    scoreAppointment(signals.hasCallbackStatus),
    "appointment",
    weights,
  );

  // Temporal (20 max)
  const leadAge = applyWeight(
    scoreLeadAge(signals.daysSinceCreation),
    "leadAge",
    weights,
  );
  const timeSinceTouch = applyWeight(
    scoreTimeSinceTouch(signals.daysSinceLastTouch),
    "timeSinceTouch",
    weights,
  );
  const timeInStatus = applyWeight(
    scoreTimeInStatus(signals.daysInCurrentStatus, signals.isPositiveStatus),
    "timeInStatus",
    weights,
  );
  const statusVelocity = applyWeight(
    scoreStatusVelocity(signals.positiveChanges30d, signals.negativeChanges30d),
    "statusVelocity",
    weights,
  );

  // Pipeline (13 max)
  const hasOpportunity = applyWeight(
    scoreHasOpportunity(
      signals.hasActiveOpportunity,
      signals.hasAnyOpportunity,
    ),
    "hasOpportunity",
    weights,
  );
  const opportunityValue = applyWeight(
    scoreOpportunityValue(signals.opportunityValueUsd),
    "opportunityValue",
    weights,
  );
  // Historical (5 max)
  const sourceQuality = applyWeight(
    scoreSourceQuality(signals.sourceConversionRate),
    "sourceQuality",
    weights,
  );

  // Penalties (up to -20)
  const penNoAnswer = penaltyConsecutiveNoAnswers(signals.consecutiveNoAnswers);
  const penVm = penaltyStraightToVm(signals.straightToVmCount);
  const penBadStatus = penaltyBadStatus(
    signals.isBlockedStatus,
    signals.isNotInServiceStatus,
    signals.isHungUpStatus,
  );
  const penStagnation = penaltyStagnation(signals.daysSinceAnyActivity);
  const totalPenalty = penNoAnswer + penVm + penBadStatus + penStagnation;

  // Sum & clamp
  const rawTotal =
    callAnswerRate +
    emailReplyRate +
    smsResponseRate +
    engagementRecency +
    inboundCalls +
    quoteRequested +
    emailEngagement +
    appointment +
    leadAge +
    timeSinceTouch +
    timeInStatus +
    statusVelocity +
    hasOpportunity +
    opportunityValue +
    sourceQuality +
    totalPenalty;

  const score = Math.max(0, Math.min(100, Math.round(rawTotal)));

  const breakdown: ScoreBreakdown = {
    // Engagement
    callAnswerRate,
    emailReplyRate,
    smsResponseRate,
    engagementRecency,
    // Behavioral
    inboundCalls,
    quoteRequested,
    emailEngagement,
    appointment,
    // Temporal
    leadAge,
    timeSinceTouch,
    timeInStatus,
    statusVelocity,
    // Pipeline
    hasOpportunity,
    opportunityValue,
    // Historical
    sourceQuality,
    // Penalties
    penalties: totalPenalty,
  };

  return {
    closeLeadId: signals.closeLeadId,
    displayName: signals.displayName,
    score,
    heatLevel: getHeatLevel(score),
    trend: getTrendDirection(score, previousScore),
    previousScore,
    breakdown,
    signals,
  };
}
