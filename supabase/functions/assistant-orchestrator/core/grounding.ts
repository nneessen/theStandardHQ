// H2 backstop: a programmatic check on the no-fabrication invariant.
//
// The system prompt forbids inventing numbers, and every grounding read returns a
// { available: bool } section — but the model's ADHERENCE was previously only
// prompt-guided, never verified. This module verifies the narrowest, highest-signal
// failure mode: the model stated figures in a turn where EVERY tool section came
// back available:false (i.e. there was no real data to ground any number on).
//
// Deliberately pure (no esm.sh imports) so it unit-tests offline. It does NOT block
// — heuristics misfire — it produces a signal the orchestrator logs and returns, so
// fabrication is observable instead of silent.

/**
 * Recursively collect every `available` boolean from a tool output's grounded
 * sections. Draft/error outputs (no `available` field) contribute nothing.
 */
export function collectAvailability(output: unknown): boolean[] {
  const flags: boolean[] = [];
  const visit = (v: unknown) => {
    if (v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    const obj = v as Record<string, unknown>;
    if (typeof obj.available === "boolean") flags.push(obj.available);
    for (const val of Object.values(obj)) visit(val);
  };
  visit(output);
  return flags;
}

// Figure-like numerics that imply a fabricated statistic: currency, decimals,
// thousands-separated numbers, and percentages. Deliberately NOT bare integers,
// so years ("2026"), step counts ("3 steps"), and durations ("10 minutes") in a
// "no data connected" disclaimer don't trip the check.
const FIGURE_RE = /\$\s*\d|\d[\d,]*\.\d|\d{1,3}(?:,\d{3})+|\d+\s*%/;

export function containsFigures(text: string): boolean {
  return FIGURE_RE.test(text);
}

export interface GroundingSignal {
  /** At least one grounded section was returned this turn. */
  ranGroundingTools: boolean;
  /** At least one of those sections was available:true. */
  anyDataAvailable: boolean;
  /** Figures present despite every section being unavailable — likely fabrication. */
  ungroundedNumericWarning: boolean;
  /**
   * Cross-turn (L2) backstop: a follow-up turn states figures but ran NO grounding
   * tool. The numbers can therefore only come from earlier prose in the
   * conversation — which is NOT re-grounded across turns (history replays prose
   * only, not tool results) — or be fabricated. This is a weak heuristic: it also
   * fires when the user themselves supplied figures (e.g. copy drafting), so it is
   * an annotation to LOG, never a block.
   */
  crossTurnFigureWarning: boolean;
}

export interface GroundingContext {
  /** This conversation already had prior user/assistant turns (i.e. a follow-up). */
  hasPriorTurns?: boolean;
}

/**
 * Assess one turn: did grounding tools run, did any return data, and does the
 * final reply state figures it could not have grounded — either because every
 * section was unavailable this turn, or because no tool ran at all on a follow-up
 * (cross-turn recall of earlier, ungrounded prose)?
 */
export function assessGrounding(
  toolOutputs: unknown[],
  finalText: string,
  ctx: GroundingContext = {},
): GroundingSignal {
  const flags = toolOutputs.flatMap(collectAvailability);
  const ranGroundingTools = flags.length > 0;
  const anyDataAvailable = flags.some((f) => f === true);
  const hasFigures = containsFigures(finalText);
  const ungroundedNumericWarning =
    ranGroundingTools && !anyDataAvailable && hasFigures;
  const crossTurnFigureWarning =
    !!ctx.hasPriorTurns && !ranGroundingTools && hasFigures;
  return {
    ranGroundingTools,
    anyDataAvailable,
    ungroundedNumericWarning,
    crossTurnFigureWarning,
  };
}
