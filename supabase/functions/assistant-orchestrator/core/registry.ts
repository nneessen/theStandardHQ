// Tool metadata registry (pure data). Handlers live in ../tools/. The orchestrator
// and the permission guard consult this to know each tool's category, risk, required
// permissions, and approval requirement WITHOUT importing effectful handler code.

import type { ToolMetadata } from "./types.ts";

export const TOOL_METADATA: Record<string, ToolMetadata> = {
  getDailyBriefingData: {
    name: "getDailyBriefingData",
    description:
      "Fetch the user's grounded daily briefing in one call: personal production snapshot, team rollup, policy/commission risk, recruiting pipeline, and lead-heat summary. Returns combined JSON where each section has an `available` flag and a `data` payload (or `reason` when unavailable). Use this FIRST for 'brief me' / 'what needs my attention today' requests.",
    category: "briefing",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getMyProduction: {
    name: "getMyProduction",
    description:
      "Personal production snapshot for the CURRENT user ONLY (their own book): annualized premium submitted in range, issued-paid premium (approved + effective in range), approved policy count, plus their current prospect and lead-scored counts. Read-only, scoped server-side to auth.uid() (the user cannot widen it). Returns `available`/`data`; an all-zero result means no production this period (still available). Use for 'my production', 'how am I doing', 'my AP this month', or any question about the user's OWN numbers (not the team's).",
    category: "production",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getTeamProductionSummary: {
    name: "getTeamProductionSummary",
    description:
      "AGGREGATE production totals for the current user's OWN team — the user plus their downline subtree (AP, issued-paid premium, approved policy count, prospects, leads scored). Read-only, scoped server-side to the caller's hierarchy + IMO (never another team). Returns `available`/`data`; all-zero means no team production this period (still available). Use for 'how is my team doing' / team totals / pace. For a per-member ranked breakdown ('who is leading', coaching) use getTeamLeaderboard. For the user's OWN numbers use getMyProduction.",
    category: "production",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getTeamLeaderboard: {
    name: "getTeamLeaderboard",
    description:
      "Per-member production leaderboard for the current user's OWN team (the user + their downline subtree): each member's name, issued-paid premium, AP, approved policy count, and rank. Read-only, scoped server-side to auth.uid() + the caller's IMO — it can NEVER show another team's members. This is a TOP-N leaderboard (plus the caller's own row), NOT the full roster, so its member rows may not sum to the team total from getTeamProductionSummary — present it as a ranking, do not reconcile the two. Returns `available`/`data`. Use for 'who is leading on my team', 'top producers on my team', or coaching 'who needs attention' questions.",
    category: "production",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getPolicyRiskAlerts: {
    name: "getPolicyRiskAlerts",
    description:
      "List the current user's at-risk commissions/policies (advance vs earned, risk level) and a chargeback-risk summary. Read-only, RLS-scoped. Use for 'what policies are at risk' / 'chargeback risk' / 'what could hurt persistency' questions.",
    category: "policy",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getLeadPriorities: {
    name: "getLeadPriorities",
    description:
      "List the current user's highest-priority sales leads by heat score — hottest first, surfacing leads going cold (display name, score, heat level, trend, percentile, last activity). Read-only, RLS-scoped to the caller's own leads. Use for 'who should I call', 'hot leads', or 'which leads are going cold' questions.",
    category: "lead",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getRecruitingSnapshot: {
    name: "getRecruitingSnapshot",
    description:
      "Recruiting pipeline counts for the current user (total, pending, accepted, rejected, expired, plus this-week / this-month submissions). Read-only, RLS-scoped to the caller's own recruiting leads. Use for recruiting pipeline health and candidate-volume questions.",
    category: "recruiting",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getClientSnapshot: {
    name: "getClientSnapshot",
    description:
      "Book-of-business summary for the current user: total clients, clients with active policies, total/average premium, and the top 5 clients by premium (name + policy counts only — no contact PII). Read-only, RLS-scoped. Use for 'summarize my book' / CRM overview questions.",
    category: "crm",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  searchCloseLeads: {
    name: "searchCloseLeads",
    description:
      "Search the user's LIVE Close CRM for leads by free text (a person/business name). Returns lean matches — name, Close lead id, status, and days since last update — never full records or contact details. Read-only, scoped to the signed-in user's own Close account. Use to find a lead before pulling its snapshot or activity. Returns available:false with reason 'close_not_connected' if the user hasn't connected Close.",
    category: "close",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getCloseLeadSnapshot: {
    name: "getCloseLeadSnapshot",
    description:
      "Compact live read on ONE Close lead, by Close lead id or by name (first match used): status, contact-channel presence (how many contacts have an email/phone — NOT the values), and an open-opportunity summary (value, status, age). Read-only, the user's own Close account. No raw emails/phones/addresses/notes. Use for 'pull up / look up <lead>'.",
    category: "close",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getCloseLeadActivity: {
    name: "getCloseLeadActivity",
    description:
      "Recent activity timeline for ONE Close lead (by lead id): calls, emails, SMS, notes, meetings, status changes — summarized to type + date + direction/duration/status, with a count by type. Message bodies, subjects, and contact values are dropped. Read-only. Use for 'what's the recent activity on this lead' / 'when did we last touch them'.",
    category: "close",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getCloseOpportunities: {
    name: "getCloseOpportunities",
    description:
      "Open opportunities in the user's live Close pipeline for triage — lead name, value, status, age, and days stalled — most-stalled first, plus total open value. Names + money + status only (no PII). Read-only. Use for 'what's in my pipeline', 'open opportunities', or 'what's stalled'.",
    category: "close",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  draftCloseNote: {
    name: "draftCloseNote",
    description:
      "Draft a note to add to a Close lead's timeline. Requires the Close lead id (look the lead up first). This does NOT write to Close: it creates a pending approval the human must approve in the UI before assistant-action-execute adds the note with the user's own Close key. Do NOT claim the note was added.",
    category: "close",
    riskLevel: "draft",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  draftCloseTask: {
    name: "draftCloseTask",
    description:
      "Draft a task on a Close lead (optional due date YYYY-MM-DD). Requires the Close lead id (look the lead up first). This does NOT write to Close: it creates a pending approval the human must approve before assistant-action-execute creates the task with the user's own Close key. Do NOT claim the task was created.",
    category: "close",
    riskLevel: "draft",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  draftEmailMessage: {
    name: "draftEmailMessage",
    description:
      "Draft an email (subject + body) for the user to review. This does NOT send anything: it creates a pending approval the human must explicitly approve in the UI before assistant-action-execute sends it. Provide natural, non-robotic copy. Do NOT claim the email was sent.",
    category: "messaging",
    riskLevel: "draft",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  draftSmsMessage: {
    name: "draftSmsMessage",
    description:
      "Draft a short, natural SMS for the user to review. This does NOT send anything: it creates a pending approval the human must explicitly approve before assistant-action-execute sends it. Keep it concise; avoid fake urgency and manipulative language. Do NOT claim the SMS was sent.",
    category: "messaging",
    riskLevel: "draft",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
  getUnderwritingRecommendation: {
    name: "getUnderwritingRecommendation",
    description:
      "Rank life-insurance carrier products for a prospect by PROBABILITY OF APPROVAL (not price) using the agency's authoritative underwriting engine and approved carrier rules. Pass the client's age, gender, state, build, tobacco use, requested face amount, and any reported health conditions with their follow-up answers (use the carrier-intake wording verbatim). Read-only, RLS-scoped to the user's IMO. Each product comes back with an `assessable` flag, a health class (or 'unknown' when there isn't enough data/rule coverage), an approval likelihood, and the reasons/concerns. When a product is NOT assessable it means the engine lacks the carrier data to judge it — say that and ask for the missing facts; NEVER invent an approval, decline, or rate class. Use for 'who would approve this client', 'best carrier for <condition>', or 'is this client insurable' questions.",
    category: "underwriting",
    riskLevel: "read",
    requiredPermissions: [],
    requiresApproval: false,
    implemented: true,
  },
};

export function getToolMetadata(name: string): ToolMetadata | undefined {
  return TOOL_METADATA[name];
}
