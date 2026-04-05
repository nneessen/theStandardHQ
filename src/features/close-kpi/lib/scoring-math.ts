// Pure scoring math functions extracted from supabase/functions/close-lead-heat-score/scoring-engine.ts
// These are duplicated here so vitest can test them. Keep in sync with the edge function version.

// ─── Types ───────────────────────────────────────────────────────────

export type HeatLevel = "hot" | "warming" | "neutral" | "cooling" | "cold";
export type TrendDirection =
  | "up"
  | "up-right"
  | "right"
  | "down-right"
  | "down";

// ─── Engagement Signals (27 pts max) ─────────────────────────────────

export function scoreCallAnswerRate(
  answered: number,
  totalOutbound: number,
): number {
  if (totalOutbound === 0) return 0;
  const rate = answered / totalOutbound;
  if (rate >= 0.5) return 8;
  if (rate >= 0.35) return 6;
  if (rate >= 0.2) return 4;
  if (rate >= 0.1) return 2;
  if (rate > 0) return 1;
  return 0;
}

export function scoreEmailReplyRate(inbound: number, outbound: number): number {
  if (outbound === 0) return inbound > 0 ? 5 : 0;
  const rate = inbound / outbound;
  if (rate >= 0.4) return 5;
  if (rate >= 0.25) return 4;
  if (rate >= 0.15) return 3;
  if (rate >= 0.05) return 2;
  if (rate > 0) return 1;
  return 0;
}

export function scoreSmsResponseRate(
  inbound: number,
  outbound: number,
): number {
  if (outbound === 0) return inbound > 0 ? 5 : 0;
  const rate = inbound / outbound;
  if (rate >= 0.4) return 5;
  if (rate >= 0.25) return 4;
  if (rate >= 0.15) return 3;
  if (rate >= 0.05) return 2;
  if (rate > 0) return 1;
  return 0;
}

export function scoreLastInteractionRecency(
  hoursSinceLastTouch: number | null,
): number {
  if (hoursSinceLastTouch === null) return 0;
  if (hoursSinceLastTouch <= 4) return 9;
  if (hoursSinceLastTouch <= 12) return 8;
  if (hoursSinceLastTouch <= 24) return 7;
  if (hoursSinceLastTouch <= 48) return 5;
  if (hoursSinceLastTouch <= 72) return 4;
  if (hoursSinceLastTouch <= 168) return 2;
  if (hoursSinceLastTouch <= 336) return 1;
  return 0;
}

// ─── Behavioral Signals (25 pts max) ─────────────────────────────────

export function scoreInboundCalls(inboundCallCount: number): number {
  if (inboundCallCount >= 3) return 13;
  if (inboundCallCount === 2) return 10;
  if (inboundCallCount === 1) return 7;
  return 0;
}

export function scoreQuoteRequested(
  hasQuoted: boolean,
  positiveAdvances: number,
): number {
  if (hasQuoted) return 7;
  if (positiveAdvances >= 2) return 5;
  if (positiveAdvances === 1) return 3;
  return 0;
}

export function scoreEmailEngagement(emailsReceived: number): number {
  if (emailsReceived >= 3) return 3;
  if (emailsReceived >= 1) return 2;
  return 0;
}

export function scoreAppointment(hasCallback: boolean): number {
  return hasCallback ? 2 : 0;
}

// ─── Temporal Signals (20 pts max) ───────────────────────────────────

export function scoreLeadAge(daysSinceCreation: number): number {
  if (daysSinceCreation <= 3) return 5;
  if (daysSinceCreation <= 7) return 4;
  if (daysSinceCreation <= 14) return 3;
  if (daysSinceCreation <= 30) return 2;
  if (daysSinceCreation <= 60) return 1;
  return 0;
}

export function scoreTimeSinceTouch(daysSinceTouch: number | null): number {
  if (daysSinceTouch === null) return 0;
  if (daysSinceTouch <= 1) return 5;
  if (daysSinceTouch <= 3) return 4;
  if (daysSinceTouch <= 7) return 3;
  if (daysSinceTouch <= 14) return 2;
  if (daysSinceTouch <= 30) return 1;
  return 0;
}

export function scoreTimeInStatus(
  daysInStatus: number | null,
  isPositiveStatus: boolean,
): number {
  if (daysInStatus === null) return 2;
  if (isPositiveStatus) {
    if (daysInStatus <= 7) return 5;
    if (daysInStatus <= 14) return 4;
    if (daysInStatus <= 30) return 2;
    return 1;
  }
  if (daysInStatus <= 3) return 4;
  if (daysInStatus <= 7) return 2;
  if (daysInStatus <= 14) return 1;
  return 0;
}

export function scoreStatusVelocity(
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

// ─── Pipeline Signals (13 pts max) ───────────────────────────────────

export function scoreHasOpportunity(
  hasActiveOpp: boolean,
  hasAnyOpp: boolean,
): number {
  if (hasActiveOpp) return 9;
  if (hasAnyOpp) return 3;
  return 0;
}

export function scoreOpportunityValue(valueUsd: number | null): number {
  if (valueUsd === null || valueUsd <= 0) return 0;
  if (valueUsd >= 5000) return 4;
  if (valueUsd >= 2000) return 3;
  if (valueUsd >= 500) return 2;
  return 1;
}

// ─── Historical Signals (5 pts max) ──────────────────────────────────

export function scoreSourceQuality(
  sourceConversionRate: number | null,
): number {
  if (sourceConversionRate === null) return 2;
  if (sourceConversionRate >= 0.15) return 5;
  if (sourceConversionRate >= 0.1) return 4;
  if (sourceConversionRate >= 0.06) return 3;
  if (sourceConversionRate >= 0.03) return 2;
  if (sourceConversionRate > 0) return 1;
  return 0;
}

// ─── Penalties (up to -20) ───────────────────────────────────────────

export function penaltyConsecutiveNoAnswers(
  consecutiveNoAnswers: number,
): number {
  if (consecutiveNoAnswers >= 5) return -5;
  if (consecutiveNoAnswers >= 3) return -3;
  return 0;
}

export function penaltyStraightToVm(straightToVmCount: number): number {
  if (straightToVmCount >= 3) return -3;
  if (straightToVmCount >= 2) return -1;
  return 0;
}

export function penaltyBadStatus(
  isBlocked: boolean,
  isNotInService: boolean,
  isHungUp: boolean,
): number {
  if (isBlocked || isNotInService) return -8;
  if (isHungUp) return -5;
  return 0;
}

export function penaltyStagnation(daysSinceAnyActivity: number | null): number {
  if (daysSinceAnyActivity === null) return 0;
  if (daysSinceAnyActivity >= 45) return -4;
  return 0;
}

// ─── Classification ──────────────────────────────────────────────────

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

// ─── Max Point Budget ────────────────────────────────────────────────

export const MAX_POINTS: Record<string, number> = {
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

export const TOTAL_POSITIVE_BUDGET = Object.values(MAX_POINTS).reduce(
  (a, b) => a + b,
  0,
);
