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

  // 1b. Weather — getWeather lives on the executive-briefing (general) agent. Route here
  // explicitly so a weather question mid-conversation doesn't stick to the previous
  // specialist (which doesn't expose getWeather).
  if (
    /\b(weather|forecast|temperature|how (hot|cold|warm)|will it (rain|snow)|is it (raining|snowing|hot|cold))\b/.test(
      m,
    )
  ) {
    return "executive-briefing";
  }

  // 1c. Carrier writing numbers / appointments / licensing coverage. Production
  // Analyst owns getWritingNumberCoverage. Placed EARLY — before calendar (whose
  // "appointments?" would otherwise grab "carrier appointments") and before
  // underwriting (whose carrier+context rule must not grab "which carriers do I
  // have writing numbers with") — because these are carrier-APPOINTMENT questions,
  // not scheduling or approval questions. "carrier" alone never triggers it; it
  // needs explicit writing-number / appointment / licensing-coverage language, so it
  // can't steal a legitimate scheduling, production, or underwriting ask.
  if (
    /\b(writing numbers?|writing #|carrier appointments?|appointed (with|to|carriers?)|am i appointed|which carriers? (do i|am i|i am|i'?ve|i have)|carriers? i(?:'?m| am)? (?:appointed|contracted)|missing (?:carrier|writing) (?:numbers?|appointments?|coverage)|missing writing numbers?)\b/.test(
      m,
    )
  ) {
    return "production-analyst";
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

  // 9. Close CRM — live lead lookup, real activity, and open opportunities.
  // Uses Close-specific signals (the CRM name, opportunity/pipeline language, an
  // explicit lookup) so the common verb "close" alone never triggers it. Placed
  // before lead-priority/crm so a Close-pipeline ask isn't grabbed by lead-heat.
  if (
    /\b(close crm|in close|on close|my close|close\.com|close account|opportunit(y|ies)|open opps?|sales pipeline|stalled (deal|opp|opportunit)|pull up (the )?(lead|contact)|look up (the )?(lead|contact))\b/.test(
      m,
    ) ||
    /\bpipeline\b/.test(m)
  ) {
    return "close";
  }

  // 10. Lead prioritization (sales leads + heat).
  if (
    /\b(?:hot|hottest|cold|cooling|warm|best|top|new|untouched|stale|which|what|my)\s+leads?\b|\bleads?\s+to\s+(?:call|work|follow\s?up)\b|\bwho\s+(?:should i|to)\s+call\b|\bprioriti[sz]e(?:\s+my)?\s+leads?\b|\blead\s+priorit/.test(
      m,
    )
  ) {
    return "lead-priority";
  }

  // 11. Coaching.
  if (
    /\b(coaching|coach|who needs (help|coaching|attention)|under[- ]?perform(ing|ers)?|struggling (agents?|reps?)|improve performance)\b/.test(
      m,
    )
  ) {
    return "coaching";
  }

  // 12. Underwriting advisory — which carriers would approve a client, at what
  // class. Placed BEFORE crm because "approve this client" / "insure this client"
  // contains "client" (a crm trigger); the underwriting-specific signals win first.
  // NOTE: "carrier" alone is intentionally NOT a trigger — "which carrier pays the
  // best overrides" is a production question. We only match carrier + an
  // underwriting-context word (for/would/approve/accept/take/cover/insure/...), so
  // commission/performance "carrier" questions fall through to production (#14).
  if (
    /\b(underwrit(e|es|ing|er|ten)|insurab(le|ility)|uninsurable|health class|rate class|carriers?\s+(for|would|will|to|that|approv|accept|take|cover|insure|underwrit)|approv(e|es|al) (this |the |a |my |their )?(client|applicant|case|prospect)|get (this|them|him|her|the) (client|applicant|prospect)? ?approved|qualif(y|ies) for coverage)\b/.test(
      m,
    )
  ) {
    return "underwriting";
  }

  // 13. CRM / book of business.
  if (
    /\b(crm|clients?|policyholders?|customers?|book of business|my book)\b/.test(
      m,
    )
  ) {
    return "crm";
  }

  // 14. Production performance — incl. listing/counting an agent's own or team's
  // policies. "polic(y|ies)" lands here (Production Analyst owns queryPolicies); the
  // risk-specific policy asks ("policies at risk", lapse, chargeback) already matched
  // policy-risk at #8, and "policyholders"/"my book" matched crm at #13, so only
  // generic policy list/count/filter questions reach this rule. \b after "policy"/
  // "policies" means "policyholder" does NOT trip it.
  if (
    /\b(production|annualized premium|ap|submitted|placed|pending business|carrier performance|leaderboard|who('?s| is) leading|pace|written premium|polic(y|ies))\b/.test(
      m,
    )
  ) {
    return "production-analyst";
  }

  // 15. Generic outreach copywriting (last — a domain request keeps its agent).
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
  previousAgent?: AgentKey | null,
): AgentKey {
  const intent = classifyIntent(userMessage);
  // A clear topic switch wins — route to the matched specialist.
  if (intent && enabledAgents.includes(intent)) return intent;
  // No clear intent (a contentless follow-up like "yes", "ok", "and them?"):
  // STAY with the prior turn's specialist. Re-routing such follow-ups to the
  // default agent strips away the specialist's tools + context — e.g. a "yes"
  // after a per-policy answer would land on Executive Briefing, which lacks
  // queryPolicies, and the model can neither reproduce nor refresh the detail.
  if (previousAgent && enabledAgents.includes(previousAgent))
    return previousAgent;
  if (enabledAgents.includes(DEFAULT_AGENT)) return DEFAULT_AGENT;
  return enabledAgents[0] ?? DEFAULT_AGENT;
}
