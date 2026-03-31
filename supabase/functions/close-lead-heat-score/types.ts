// supabase/functions/close-lead-heat-score/types.ts
// Shared type definitions for the lead heat scoring system.

export type HeatLevel = "hot" | "warming" | "neutral" | "cooling" | "cold";
export type TrendDirection =
  | "up"
  | "up-right"
  | "right"
  | "down-right"
  | "down";
export type OutcomeType =
  | "won"
  | "lost"
  | "stagnant"
  | "status_advance"
  | "status_regress";
export type RunType = "scheduled" | "manual" | "incremental";
export type RunStatus = "running" | "completed" | "failed";

// ─── Scoring Signals ──────────────────────────────────────────────────

export interface LeadSignals {
  closeLeadId: string;
  displayName: string;

  // Engagement
  callsAnswered: number;
  callsOutbound: number;
  callsInbound: number;
  emailsInbound: number;
  emailsOutbound: number;
  smsInbound: number;
  smsOutbound: number;
  hoursSinceLastTouch: number | null;

  // Behavioral
  hasQuotedStatus: boolean;
  hasCallbackStatus: boolean;
  positiveStatusAdvances: number;

  // Temporal
  daysSinceCreation: number;
  daysSinceLastTouch: number | null;
  daysInCurrentStatus: number | null;
  isPositiveStatus: boolean;
  positiveChanges30d: number;
  negativeChanges30d: number;

  // Pipeline
  hasActiveOpportunity: boolean;
  hasAnyOpportunity: boolean;
  hasWonOpportunity: boolean;
  opportunityValueUsd: number | null;

  // Historical
  sourceConversionRate: number | null;

  // Negative
  consecutiveNoAnswers: number;
  straightToVmCount: number;
  isBlockedStatus: boolean;
  isNotInServiceStatus: boolean;
  isHungUpStatus: boolean;
  daysSinceAnyActivity: number | null;

  // Metadata
  currentStatusLabel: string;
  leadSource: string | null;
  dateCreated: string;
  lastActivityAt: string | null;
}

// ─── Score Breakdown ──────────────────────────────────────────────────

export interface ScoreBreakdown {
  // Engagement
  callAnswerRate: number;
  emailReplyRate: number;
  smsResponseRate: number;
  engagementRecency: number;
  // Behavioral
  inboundCalls: number;
  quoteRequested: number;
  emailEngagement: number;
  appointment: number;
  // Temporal
  leadAge: number;
  timeSinceTouch: number;
  timeInStatus: number;
  statusVelocity: number;
  // Pipeline
  hasOpportunity: number;
  opportunityValue: number;
  // Historical
  sourceQuality: number;
  // Penalties
  penalties: number;
}

// ─── Agent Weights ────────────────────────────────────────────────────

export interface SignalWeight {
  multiplier: number; // 0.3 - 2.0
}

export type AgentWeights = Record<string, SignalWeight>;

export const DEFAULT_AGENT_WEIGHTS: AgentWeights = {
  callAnswerRate: { multiplier: 1.0 },
  emailReplyRate: { multiplier: 1.0 },
  smsResponseRate: { multiplier: 1.0 },
  engagementRecency: { multiplier: 1.0 },
  inboundCalls: { multiplier: 1.0 },
  quoteRequested: { multiplier: 1.0 },
  emailEngagement: { multiplier: 1.0 },
  appointment: { multiplier: 1.0 },
  leadAge: { multiplier: 1.0 },
  timeSinceTouch: { multiplier: 1.0 },
  timeInStatus: { multiplier: 1.0 },
  statusVelocity: { multiplier: 1.0 },
  hasOpportunity: { multiplier: 1.0 },
  opportunityValue: { multiplier: 1.0 },
  sourceQuality: { multiplier: 1.0 },
};

// ─── Close API Response Types ─────────────────────────────────────────

export interface CloseLead {
  id: string;
  display_name: string;
  status_id: string;
  status_label?: string;
  date_created: string;
  custom?: Record<string, unknown>;
}

export interface CloseActivity {
  id: string;
  lead_id: string;
  date_created: string;
  direction?: string;
  duration?: number;
  disposition?: string;
  type?: string;
}

export interface CloseStatusChange {
  id: string;
  lead_id: string;
  date_created: string;
  old_status_id: string;
  new_status_id: string;
  old_status_label: string;
  new_status_label: string;
}

export interface CloseOpportunity {
  id: string;
  lead_id: string;
  value: number; // in cents
  status_type: "active" | "won" | "lost";
  status_label: string;
  date_created: string;
  date_won: string | null;
  date_lost: string | null;
}

// ─── AI Analysis Types ────────────────────────────────────────────────

export interface PortfolioAnalysisResult {
  weightAdjustments: {
    signalKey: string;
    recommendedMultiplier: number;
    reason: string;
  }[];
  insights: {
    type: "pattern" | "anomaly" | "recommendation";
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[];
  anomalies: {
    closeLeadId: string;
    displayName: string;
    type: "hot_ignored" | "cold_surprise" | "stale_hot" | "hidden_gem";
    message: string;
    urgency: "high" | "medium" | "low";
    score: number;
  }[];
  recommendations: {
    text: string;
    priority: "high" | "medium" | "low";
  }[];
  overallAssessment: string;
}

export interface LeadDeepDiveResult {
  adjustedScore: number;
  confidence: number;
  heatLevel: HeatLevel;
  narrative: string;
  keySignals: {
    signal: string;
    impact: "positive" | "negative" | "neutral";
    detail: string;
  }[];
  recommendedAction: {
    action: string;
    timing: string;
    reasoning: string;
  };
  riskFactors: string[];
  conversionProbability: "high" | "medium" | "low" | "very_low";
}

// ─── Edge Function Request/Response ───────────────────────────────────

export interface ScoreAllParams {
  smartViewId?: string;
}

export interface AnalyzeLeadParams {
  closeLeadId: string;
}

export interface ScoringRunResult {
  runId: string;
  leadsScored: number;
  leadsTotal: number;
  aiCallsMade: number;
  durationMs: number;
}
