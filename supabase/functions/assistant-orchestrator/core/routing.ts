// Intent -> agent routing (pure). Classifies the user's message to a specialist
// and dispatches there when that specialist is enabled; otherwise falls back to
// Executive Briefing (the general-purpose default). Kept dependency-free so it
// unit-tests offline.

import type { AgentKey } from "./types.ts";

const DEFAULT_AGENT: AgentKey = "executive-briefing";

// Keyword intent classification. Order matters: an explicit "brief me / overview"
// beats domain keywords so a general check-in stays with Executive Briefing.
// Returns the specialist a request maps to, or null when nothing specific matches.
export function classifyIntent(message: string): AgentKey | null {
  const m = message.toLowerCase();

  // General check-in / daily debrief wins first.
  if (
    /\b(brief me|briefing|what needs my attention|how are we doing|catch me up|overview|where do (i|we) stand|daily (debrief|recap))\b/.test(
      m,
    )
  ) {
    return "executive-briefing";
  }

  // Policy / commission risk.
  if (
    /\b(at[- ]?risk|chargeback|charge[- ]?back|persistency|unpaid|advance vs earned|lapse|claw ?back|payment risk|policies? at risk)\b/.test(
      m,
    )
  ) {
    return "policy-risk";
  }

  // Production performance.
  if (
    /\b(production|annualized premium|ap|submitted|placed|pending business|carrier performance|leaderboard|who('?s| is) leading|pace|written premium)\b/.test(
      m,
    )
  ) {
    return "production-analyst";
  }

  return null;
}

export function routeToAgent(
  userMessage: string,
  enabledAgents: AgentKey[] = [DEFAULT_AGENT],
): AgentKey {
  const intent = classifyIntent(userMessage);
  if (intent && enabledAgents.includes(intent)) return intent;
  if (enabledAgents.includes(DEFAULT_AGENT)) return DEFAULT_AGENT;
  return enabledAgents[0] ?? DEFAULT_AGENT;
}
