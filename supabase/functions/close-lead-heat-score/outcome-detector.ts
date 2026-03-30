// supabase/functions/close-lead-heat-score/outcome-detector.ts
// Detects conversion outcomes by comparing lead/opportunity state between scoring runs.
// Logs to lead_heat_outcomes for the learning feedback loop.

import type {
  CloseOpportunity,
  LeadSignals,
  ScoreBreakdown,
  OutcomeType,
} from "./types.ts";

// ─── Outcome Event ────────────────────────────────────────────────────

export interface OutcomeEvent {
  closeLeadId: string;
  outcomeType: OutcomeType;
  scoreAtOutcome: number;
  breakdownAtOutcome: ScoreBreakdown;
  signalsAtOutcome: LeadSignals;
  closeOppId: string | null;
  oppValue: number | null;
}

// ─── Previous State (loaded from lead_heat_scores) ────────────────────

export interface PreviousLeadState {
  closeLeadId: string;
  score: number;
  breakdown: ScoreBreakdown;
  signals: LeadSignals;
  /** Opportunity IDs and their status_types from previous scoring run */
  previousOpps: { id: string; statusType: string }[];
}

// ═══════════════════════════════════════════════════════════════════════
// OUTCOME DETECTION
// ═══════════════════════════════════════════════════════════════════════

export function detectOutcomes(
  currentSignals: LeadSignals,
  _currentScore: number,
  _currentBreakdown: ScoreBreakdown,
  currentOpps: CloseOpportunity[],
  previousState: PreviousLeadState | null,
): OutcomeEvent[] {
  const outcomes: OutcomeEvent[] = [];

  if (!previousState) return outcomes; // first scoring run, nothing to compare

  const prevOppMap = new Map(
    previousState.previousOpps.map((o) => [o.id, o.statusType]),
  );

  // Check for opportunity status changes
  for (const opp of currentOpps) {
    const prevStatus = prevOppMap.get(opp.id);

    // New opportunity won (was active or didn't exist before)
    if (opp.status_type === "won" && prevStatus !== "won") {
      outcomes.push({
        closeLeadId: currentSignals.closeLeadId,
        outcomeType: "won",
        scoreAtOutcome: previousState.score,
        breakdownAtOutcome: previousState.breakdown,
        signalsAtOutcome: previousState.signals,
        closeOppId: opp.id,
        oppValue: opp.value ? opp.value / 100 : null, // cents to dollars
      });
    }

    // Opportunity lost (was active before)
    if (opp.status_type === "lost" && prevStatus !== "lost") {
      outcomes.push({
        closeLeadId: currentSignals.closeLeadId,
        outcomeType: "lost",
        scoreAtOutcome: previousState.score,
        breakdownAtOutcome: previousState.breakdown,
        signalsAtOutcome: previousState.signals,
        closeOppId: opp.id,
        oppValue: opp.value ? opp.value / 100 : null,
      });
    }
  }

  // Check for status progression changes
  const prevSentiment = previousState.signals.isPositiveStatus;
  const currSentiment = currentSignals.isPositiveStatus;
  const prevNeg =
    previousState.signals.isBlockedStatus ||
    previousState.signals.isNotInServiceStatus ||
    previousState.signals.isHungUpStatus;
  const currNeg =
    currentSignals.isBlockedStatus ||
    currentSignals.isNotInServiceStatus ||
    currentSignals.isHungUpStatus;

  // Positive status advance (was not positive, now is positive)
  if (currSentiment && !prevSentiment) {
    outcomes.push({
      closeLeadId: currentSignals.closeLeadId,
      outcomeType: "status_advance",
      scoreAtOutcome: previousState.score,
      breakdownAtOutcome: previousState.breakdown,
      signalsAtOutcome: previousState.signals,
      closeOppId: null,
      oppValue: null,
    });
  }

  // Status regression (was not negative, now is negative)
  if (currNeg && !prevNeg) {
    outcomes.push({
      closeLeadId: currentSignals.closeLeadId,
      outcomeType: "status_regress",
      scoreAtOutcome: previousState.score,
      breakdownAtOutcome: previousState.breakdown,
      signalsAtOutcome: previousState.signals,
      closeOppId: null,
      oppValue: null,
    });
  }

  // Stagnation (no activity for 30+ days, previously had activity within 30 days)
  if (
    currentSignals.daysSinceAnyActivity !== null &&
    currentSignals.daysSinceAnyActivity >= 30 &&
    previousState.signals.daysSinceAnyActivity !== null &&
    previousState.signals.daysSinceAnyActivity < 30
  ) {
    outcomes.push({
      closeLeadId: currentSignals.closeLeadId,
      outcomeType: "stagnant",
      scoreAtOutcome: previousState.score,
      breakdownAtOutcome: previousState.breakdown,
      signalsAtOutcome: previousState.signals,
      closeOppId: null,
      oppValue: null,
    });
  }

  return outcomes;
}
