// Agent registry (pure data + prompt assembly). Executive Briefing is the wired
// MVP agent; the other specialists are typed config stubs for later phases so the
// registry shape is exercised end-to-end. buildSystemPrompt() injects the shared,
// non-negotiable grounding rules that prevent fabrication.

import type { AgentConfig, AgentKey } from "./types.ts";

// Shared rules prepended to every agent's system prompt. These are the safety
// contract for the whole command center.
export const BASE_SYSTEM_RULES = `You are {{ASSISTANT_NAME}}, an embedded command-center assistant inside The Standard HQ, an insurance production and agency-management platform.

NON-NEGOTIABLE RULES:
- Answer ONLY from data returned by tools in THIS conversation. Never invent, guess, estimate, or extrapolate numbers, names, premiums, counts, dates, policies, agents, or leads.
- Every figure you state must trace to a tool result you actually received. If you did not call a tool, you do not have the number.
- If a tool returns no data, an empty result, or a section flagged "available: false", say so plainly (e.g. "I don't have recruiting data connected for your account yet"). Do NOT fill the gap with a plausible-sounding number.
- If the user's request is ambiguous or outside your tools, say what you can and cannot do. Do not pretend.
- Be concise, direct, and action-oriented. Lead with what needs attention most. Prefer short paragraphs and tight bullet lists over fluff.
- For any outbound message (email or SMS), you may ONLY draft it via the draft tools. Drafting creates a pending item the human must approve in the UI; nothing is sent by you. NEVER say or imply that you sent, scheduled, or delivered a message.
- Write naturally, like a sharp human operator — never robotic or hype-y. Avoid fake urgency and exaggerated claims.`;

const EXECUTIVE_BRIEFING_PROMPT = `Your role: Executive Briefing. You give the user a fast, grounded read on what needs their attention.

For "brief me" / "what needs my attention" / "how are we doing" style requests, call getDailyBriefingData FIRST (one call returns all sections). Then, only if the user drills in, use getTeamProductionSummary or getPolicyRiskAlerts for detail.

Structure a briefing as (omit any section whose data is unavailable):
- One-line greeting using the user's first name if known.
- "Needs attention": the 1-3 highest-priority items, most urgent first.
- "Production": a tight snapshot (your numbers / team numbers) — only figures from tools.
- "Risk": at-risk policies/commissions or chargeback exposure, if any.
- "Recommended first action": one concrete next step.

If every section is unavailable, say the briefing has no data sources connected yet and offer to help with something specific. Never fabricate to fill the template.`;

function stub(key: AgentKey, name: string, description: string): AgentConfig {
  return {
    key,
    name,
    description,
    systemPrompt:
      `Your role: ${name}. This specialist is part of the command center roadmap but is not enabled yet. ` +
      `If asked to do this kind of work, briefly say it's coming soon and offer what the Executive Briefing can do today (production, team, and policy-risk read-outs). Never fabricate data.`,
    allowedToolNames: [],
    allowedCategories: [],
  };
}

export const AGENTS: Record<AgentKey, AgentConfig> = {
  "executive-briefing": {
    key: "executive-briefing",
    name: "Executive Briefing",
    description:
      "Daily debrief: what needs attention today, production pace, top risks, and a prioritized first action.",
    systemPrompt: EXECUTIVE_BRIEFING_PROMPT,
    allowedToolNames: [
      "getDailyBriefingData",
      "getTeamProductionSummary",
      "getPolicyRiskAlerts",
      "draftEmailMessage",
      "draftSmsMessage",
    ],
    allowedCategories: ["briefing", "production", "policy", "messaging"],
  },
  "production-analyst": stub(
    "production-analyst",
    "Production Analyst",
    "AP, submitted/placed/pending business, carrier and agent performance, trends.",
  ),
  "policy-risk": stub(
    "policy-risk",
    "Policy Risk",
    "Approved-but-unpaid, payment-risk, pending follow-ups, chargeback exposure.",
  ),
  "lead-priority": stub(
    "lead-priority",
    "Lead Prioritization",
    "Rank leads by urgency and likelihood; surface untouched hot leads and cold follow-ups.",
  ),
  crm: stub(
    "crm",
    "CRM",
    "Summarize CRM context and draft updates/tasks (after approval).",
  ),
  "sms-email-copy": stub(
    "sms-email-copy",
    "SMS / Email Copy",
    "Draft natural, non-robotic outreach for mortgage protection, final expense, recruiting, and follow-ups.",
  ),
  compliance: stub(
    "compliance",
    "Compliance",
    "Review drafts for risky wording, unsupported claims, and TCPA concerns; suggest safer alternatives.",
  ),
  recruiting: stub(
    "recruiting",
    "Recruiting",
    "Licensed-agent recruiting intelligence, pipeline review, candidate follow-ups.",
  ),
  coaching: stub(
    "coaching",
    "Agent Coaching",
    "Identify who needs coaching, analyze performance, draft coaching notes and plans.",
  ),
  calendar: stub(
    "calendar",
    "Calendar / Scheduling",
    "Check availability and draft scheduling messages; book only after approval.",
  ),
  slack: stub(
    "slack",
    "Slack / Notifications",
    "Draft scoreboard updates, announcements, and motivational messages (send after approval).",
  ),
  workflow: stub(
    "workflow",
    "Workflow Builder",
    "Build SMS/email sequences for hot leads, aged leads, and recruiting.",
  ),
  "data-quality": stub(
    "data-quality",
    "Data Quality",
    "Detect missing/inconsistent records and explain why a report may be incomplete.",
  ),
};

export function getAgent(key: AgentKey): AgentConfig {
  return AGENTS[key] ?? AGENTS["executive-briefing"];
}

export function buildSystemPrompt(
  agent: AgentConfig,
  assistantName: string,
): string {
  const base = BASE_SYSTEM_RULES.replace(
    /\{\{ASSISTANT_NAME\}\}/g,
    assistantName,
  );
  return `${base}\n\n${agent.systemPrompt}`;
}
