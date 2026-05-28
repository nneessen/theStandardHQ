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
  getTeamProductionSummary: {
    name: "getTeamProductionSummary",
    description:
      "Get production/AP figures for the current user's team (downline) and the user's own recent daily submissions. Read-only and scoped by the app's hierarchy + RLS. Returns `available`/`data`. Use for questions about team production, who is leading, or pace.",
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
};

export function getToolMetadata(name: string): ToolMetadata | undefined {
  return TOOL_METADATA[name];
}
