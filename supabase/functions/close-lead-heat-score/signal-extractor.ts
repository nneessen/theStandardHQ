// supabase/functions/close-lead-heat-score/signal-extractor.ts
// Extracts scoring signals from Close API data for each lead.

import type {
  CloseLead,
  CloseActivity,
  CloseStatusChange,
  CloseOpportunity,
  LeadSignals,
} from "./types.ts";

// ─── Status Sentiment Classification ──────────────────────────────────
// Based on src/features/chat-bot/lib/close-metadata.ts

const POSITIVE_STATUS_PATTERNS = [
  "texting",
  "call back",
  "callback",
  "quoted",
  "appointment",
  "scheduled",
  "application",
  "underwriting",
  "sold",
  "won",
];

const NEGATIVE_STATUS_PATTERNS = [
  "no answer",
  "straight to vm",
  "doesn't ring",
  "doesnt ring",
  "blocked",
  "not in service",
  "hung up",
  "missed appointment",
  "no show",
  "no-show",
  "noshow",
  "dead",
  "dnc",
  "do not contact",
  "lost",
];

function classifyStatus(
  statusLabel: string,
): "positive" | "neutral" | "negative" {
  const lower = statusLabel.toLowerCase();
  // Check negative patterns FIRST — they are stronger signals.
  // Prevents "callback no show" from matching "callback" (positive) before "no show" (negative).
  if (NEGATIVE_STATUS_PATTERNS.some((p) => lower.includes(p)))
    return "negative";
  if (POSITIVE_STATUS_PATTERNS.some((p) => lower.includes(p)))
    return "positive";
  return "neutral";
}

function isBlockedStatus(statusLabel: string): boolean {
  const lower = statusLabel.toLowerCase();
  return lower.includes("blocked");
}

function isNotInServiceStatus(statusLabel: string): boolean {
  const lower = statusLabel.toLowerCase();
  return lower.includes("not in service");
}

function isHungUpStatus(statusLabel: string): boolean {
  const lower = statusLabel.toLowerCase();
  return lower.includes("hung up");
}

function isQuotedStatus(statusLabel: string): boolean {
  const lower = statusLabel.toLowerCase();
  return lower.includes("quoted");
}

function isCallbackStatus(statusLabel: string): boolean {
  const lower = statusLabel.toLowerCase();
  return lower.includes("call back") || lower.includes("callback");
}

// ─── Time Helpers ─────────────────────────────────────────────────────

function hoursBetween(from: string | Date, to: Date): number {
  const fromDate = typeof from === "string" ? new Date(from) : from;
  if (isNaN(fromDate.getTime())) return 0;
  return Math.max(0, (to.getTime() - fromDate.getTime()) / (1000 * 60 * 60));
}

function daysBetween(from: string | Date, to: Date): number {
  return hoursBetween(from, to) / 24;
}

// ─── Call Analysis Helpers ────────────────────────────────────────────

function isOutbound(direction?: string): boolean {
  return direction === "outbound" || direction === "outgoing";
}

function isInbound(direction?: string): boolean {
  return direction === "inbound" || direction === "incoming";
}

function countConsecutiveNoAnswers(calls: CloseActivity[]): number {
  // Sort by date descending (most recent first)
  const sorted = [...calls]
    .filter((c) => isOutbound(c.direction))
    .sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime(),
    );

  let count = 0;
  for (const call of sorted) {
    if (call.disposition === "no-answer" || call.disposition === "busy") {
      count++;
    } else {
      break; // stop at first non-no-answer
    }
  }
  return count;
}

// ─── Status Change Analysis ───────────────────────────────────────────

interface StatusChangeAnalysis {
  positiveAdvances: number;
  positiveChanges30d: number;
  negativeChanges30d: number;
  daysInCurrentStatus: number | null;
  currentStatusLabel: string;
}

function analyzeStatusChanges(
  statusChanges: CloseStatusChange[],
  currentStatusLabel: string,
  now: Date,
): StatusChangeAnalysis {
  const sorted = [...statusChanges].sort(
    (a, b) =>
      new Date(a.date_created).getTime() - new Date(b.date_created).getTime(),
  );

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let positiveAdvances = 0;
  let positiveChanges30d = 0;
  let negativeChanges30d = 0;
  let lastChangeDate: Date | null = null;

  for (const change of sorted) {
    const newSentiment = classifyStatus(change.new_status_label);
    const oldSentiment = classifyStatus(change.old_status_label);
    const changeDate = new Date(change.date_created);

    // Overall: count positive advances
    if (newSentiment === "positive" && oldSentiment !== "positive") {
      positiveAdvances++;
    }

    // 30-day window
    if (changeDate >= thirtyDaysAgo) {
      if (newSentiment === "positive" && oldSentiment !== "positive") {
        positiveChanges30d++;
      } else if (newSentiment === "negative" && oldSentiment !== "negative") {
        negativeChanges30d++;
      }
    }

    lastChangeDate = changeDate;
  }

  const daysInCurrentStatus = lastChangeDate
    ? daysBetween(lastChangeDate, now)
    : null;

  return {
    positiveAdvances,
    positiveChanges30d,
    negativeChanges30d,
    daysInCurrentStatus,
    currentStatusLabel,
  };
}

// ─── Opportunity Analysis ─────────────────────────────────────────────

interface OpportunityAnalysis {
  hasActiveOpportunity: boolean;
  hasAnyOpportunity: boolean;
  hasWonOpportunity: boolean;
  opportunityValueUsd: number | null;
}

function analyzeOpportunities(
  opportunities: CloseOpportunity[],
): OpportunityAnalysis {
  if (opportunities.length === 0) {
    return {
      hasActiveOpportunity: false,
      hasAnyOpportunity: false,
      hasWonOpportunity: false,
      opportunityValueUsd: null,
    };
  }

  const hasActive = opportunities.some((o) => o.status_type === "active");
  const hasWon = opportunities.some((o) => o.status_type === "won");

  // Sum active opportunity values (stored in cents)
  const totalValueCents = opportunities
    .filter((o) => o.status_type === "active")
    .reduce((sum, o) => sum + (o.value || 0), 0);

  return {
    hasActiveOpportunity: hasActive,
    hasAnyOpportunity: true,
    hasWonOpportunity: hasWon,
    opportunityValueUsd: totalValueCents > 0 ? totalValueCents / 100 : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════

export function extractSignals(
  lead: CloseLead,
  calls: CloseActivity[],
  emails: CloseActivity[],
  sms: CloseActivity[],
  statusChanges: CloseStatusChange[],
  opportunities: CloseOpportunity[],
  sourceConversionRates: Map<string, number>,
  statusLabels: Map<string, string>,
  now: Date = new Date(),
): LeadSignals {
  // Resolve status label
  const currentStatusLabel =
    lead.status_label ?? statusLabels.get(lead.status_id) ?? "Unknown";

  // Activities are expected to be pre-filtered for this lead by the caller.
  // This avoids O(N*M) filtering when scoring large portfolios.
  const leadCalls = calls;
  const leadEmails = emails;
  const leadSms = sms;
  const leadStatusChanges = statusChanges;
  const leadOpps = opportunities;

  // Call metrics
  const callsOutbound = leadCalls.filter((c) => isOutbound(c.direction)).length;
  const callsInbound = leadCalls.filter((c) => isInbound(c.direction)).length;
  const callsAnswered = leadCalls.filter(
    (c) => isOutbound(c.direction) && c.disposition === "answered",
  ).length;
  // Count only outbound calls that hit voicemail by disposition.
  // If the lead's status itself says "straight to vm" but no calls have that
  // disposition, treat as 1 (the status is evidence of at least one VM event).
  const vmAnswerCount = leadCalls.filter(
    (c) => isOutbound(c.direction) && c.disposition === "vm-answer",
  ).length;
  const straightToVmCount =
    vmAnswerCount > 0
      ? vmAnswerCount
      : currentStatusLabel.toLowerCase().includes("straight to vm")
        ? 1
        : 0;
  const consecutiveNoAnswers = countConsecutiveNoAnswers(leadCalls);

  // Email metrics
  const emailsOutbound = leadEmails.filter((e) =>
    isOutbound(e.direction),
  ).length;
  const emailsInbound = leadEmails.filter((e) => isInbound(e.direction)).length;

  // SMS metrics
  const smsOutbound = leadSms.filter((s) => isOutbound(s.direction)).length;
  const smsInbound = leadSms.filter((s) => isInbound(s.direction)).length;

  // Find most recent activity across all channels
  // Include status changes so leads with only status activity aren't seen as stale
  const allActivityDates = [
    ...leadCalls.map((c) => c.date_created),
    ...leadEmails.map((e) => e.date_created),
    ...leadSms.map((s) => s.date_created),
    ...leadStatusChanges.map((sc) => sc.date_created),
  ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const lastActivityAt = allActivityDates[0] ?? null;
  const hoursSinceLastTouch = lastActivityAt
    ? hoursBetween(lastActivityAt, now)
    : null;
  const daysSinceLastTouch =
    hoursSinceLastTouch !== null ? hoursSinceLastTouch / 24 : null;
  const daysSinceAnyActivity = daysSinceLastTouch;

  // Status analysis
  const statusAnalysis = analyzeStatusChanges(
    leadStatusChanges,
    currentStatusLabel,
    now,
  );
  const statusSentiment = classifyStatus(currentStatusLabel);

  // Opportunity analysis
  const oppAnalysis = analyzeOpportunities(leadOpps);

  // Lead source (try to extract from custom fields or lead data)
  const leadSource =
    (lead.custom?.["Lead Source"] as string) ??
    (lead.custom?.["lead_source"] as string) ??
    (lead.custom?.["Source"] as string) ??
    null;

  const sourceConversionRate = leadSource
    ? (sourceConversionRates.get(leadSource) ?? null)
    : null;

  return {
    closeLeadId: lead.id,
    displayName: lead.display_name,

    // Engagement
    callsAnswered,
    callsOutbound,
    callsInbound,
    emailsInbound,
    emailsOutbound,
    smsInbound,
    smsOutbound,
    hoursSinceLastTouch,

    // Behavioral
    hasQuotedStatus: isQuotedStatus(currentStatusLabel),
    hasCallbackStatus: isCallbackStatus(currentStatusLabel),
    positiveStatusAdvances: statusAnalysis.positiveAdvances,

    // Temporal
    daysSinceCreation: daysBetween(lead.date_created, now),
    daysSinceLastTouch,
    daysInCurrentStatus: statusAnalysis.daysInCurrentStatus,
    isPositiveStatus: statusSentiment === "positive",
    positiveChanges30d: statusAnalysis.positiveChanges30d,
    negativeChanges30d: statusAnalysis.negativeChanges30d,

    // Pipeline
    ...oppAnalysis,

    // Historical
    sourceConversionRate,

    // Negative
    consecutiveNoAnswers,
    straightToVmCount,
    isBlockedStatus: isBlockedStatus(currentStatusLabel),
    isNotInServiceStatus: isNotInServiceStatus(currentStatusLabel),
    isHungUpStatus: isHungUpStatus(currentStatusLabel),
    daysSinceAnyActivity,

    // Metadata
    currentStatusLabel,
    leadSource,
    dateCreated: lead.date_created,
    lastActivityAt,
  };
}
