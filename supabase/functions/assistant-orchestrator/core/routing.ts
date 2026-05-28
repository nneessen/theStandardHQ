// Intent -> agent routing (pure). Classifies the user's message to a specialist
// and dispatches there when that specialist is enabled; otherwise falls back to
// Executive Briefing (the general-purpose default). Kept dependency-free so it
// unit-tests offline.

import type { AgentKey } from "./types.ts";

const DEFAULT_AGENT: AgentKey = "executive-briefing";

// Keyword intent classification. Order matters: a general check-in ("brief me")
// wins first; specific specialists are matched before broad ones; the generic
// copywriter (sms-email-copy) is last so a domain request keeps its domain agent.
// Returns the specialist a request maps to, or null when nothing specific matches.
export function classifyIntent(message: string): AgentKey | null {
  const m = message.toLowerCase();

  // 1. General check-in / daily debrief.
  if (
    /\b(brief me|briefing|what needs my attention|how are we doing|catch me up|overview|where do (i|we) stand|daily (debrief|recap))\b/.test(
      m,
    )
  ) {
    return "executive-briefing";
  }

  // 2. Compliance review of copy.
  if (
    /\b(compliance|compliant|tcpa|consent issue|review (this|my) (draft|message|copy|email|text|sms|wording)|is this (ok|okay|safe|compliant) to send|risky (wording|language)|unsupported claims?|missing discl[oa]sure)\b/.test(
      m,
    )
  ) {
    return "compliance";
  }

  // 3. Data quality / why a report is incomplete.
  if (
    /\b(data quality|missing data|incomplete|data gaps?|bad data|dirty data|why is (the|my) (report|data|number)|inconsistent (data|records?))\b/.test(
      m,
    )
  ) {
    return "data-quality";
  }

  // 4. Recruiting pipeline.
  if (
    /\b(recruit(ing|er|ers|s)?|candidates?|recruiting pipeline|prospective agents?|agent pipeline)\b/.test(
      m,
    )
  ) {
    return "recruiting";
  }

  // 5. Workflow / sequence building.
  if (
    /\b(workflows?|sequences?|drip|cadence|nurture|automation|drip campaign)\b/.test(
      m,
    )
  ) {
    return "workflow";
  }

  // 6. Slack / announcements.
  if (
    /\b(slack|announcements?|scoreboard|shout[- ]?outs?|motivational|team (post|update|message))\b/.test(
      m,
    )
  ) {
    return "slack";
  }

  // 7. Calendar / scheduling.
  if (
    /\b(calendar|schedul(e|ing)|availability|appointments?|book (a|an|me)|set up a (call|meeting)|meeting)\b/.test(
      m,
    )
  ) {
    return "calendar";
  }

  // 8. Policy / commission risk.
  if (
    /\b(at[- ]?risk|chargeback|charge[- ]?back|persistency|unpaid|advance vs earned|lapse|claw ?back|payment risk|policies? at risk)\b/.test(
      m,
    )
  ) {
    return "policy-risk";
  }

  // 9. Lead prioritization (sales leads + heat).
  if (
    /\b(?:hot|hottest|cold|cooling|warm|best|top|new|untouched|stale|which|what|my)\s+leads?\b|\bleads?\s+to\s+(?:call|work|follow\s?up)\b|\bwho\s+(?:should i|to)\s+call\b|\bprioriti[sz]e(?:\s+my)?\s+leads?\b|\blead\s+priorit/.test(
      m,
    )
  ) {
    return "lead-priority";
  }

  // 10. Coaching.
  if (
    /\b(coaching|coach|who needs (help|coaching|attention)|under[- ]?perform(ing|ers)?|struggling (agents?|reps?)|improve performance)\b/.test(
      m,
    )
  ) {
    return "coaching";
  }

  // 11. CRM / book of business.
  if (
    /\b(crm|clients?|policyholders?|customers?|book of business|my book)\b/.test(
      m,
    )
  ) {
    return "crm";
  }

  // 12. Production performance.
  if (
    /\b(production|annualized premium|ap|submitted|placed|pending business|carrier performance|leaderboard|who('?s| is) leading|pace|written premium)\b/.test(
      m,
    )
  ) {
    return "production-analyst";
  }

  // 13. Generic outreach copywriting (last — a domain request keeps its agent).
  if (
    /\b(write|draft|compose)\s+(me\s+)?(a|an|some)?\s*(cold\s+)?(email|sms|text|message|outreach|copy|note)\b|\b(email|sms|text)\s+copy\b|\boutreach\b/.test(
      m,
    )
  ) {
    return "sms-email-copy";
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
