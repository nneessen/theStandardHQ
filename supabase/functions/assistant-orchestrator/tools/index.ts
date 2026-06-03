// Tool registry binding: maps tool names to handlers and builds the Anthropic tool
// definitions (name + description from core metadata + JSON Schema from each tool).

import { TOOL_METADATA } from "../core/registry.ts";
import type { RegisteredTool } from "./types.ts";
import { getDailyBriefingData } from "./getDailyBriefingData.ts";
import { getMyProduction } from "./getMyProduction.ts";
import { getTeamProductionSummary } from "./getTeamProductionSummary.ts";
import { getTeamLeaderboard } from "./getTeamLeaderboard.ts";
import { getPolicyRiskAlerts } from "./getPolicyRiskAlerts.ts";
import { queryPolicies } from "./queryPolicies.ts";
import { getLeadPriorities } from "./getLeadPriorities.ts";
import { getRecruitingSnapshot } from "./getRecruitingSnapshot.ts";
import { getClientSnapshot } from "./getClientSnapshot.ts";
import { searchCloseLeads } from "./searchCloseLeads.ts";
import { getCloseLeadSnapshot } from "./getCloseLeadSnapshot.ts";
import { getCloseLeadActivity } from "./getCloseLeadActivity.ts";
import { getCloseOpportunities } from "./getCloseOpportunities.ts";
import { draftCloseNote } from "./draftCloseNote.ts";
import { draftCloseTask } from "./draftCloseTask.ts";
import { draftEmailMessage } from "./draftEmailMessage.ts";
import { draftSmsMessage } from "./draftSmsMessage.ts";
import { getUnderwritingRecommendation } from "./getUnderwritingRecommendation.ts";
import { getWeather } from "./getWeather.ts";
import { resolveContact } from "./resolveContact.ts";

export const TOOLS: Record<string, RegisteredTool> = {
  [getDailyBriefingData.name]: getDailyBriefingData,
  [getMyProduction.name]: getMyProduction,
  [getTeamProductionSummary.name]: getTeamProductionSummary,
  [getTeamLeaderboard.name]: getTeamLeaderboard,
  [getPolicyRiskAlerts.name]: getPolicyRiskAlerts,
  [queryPolicies.name]: queryPolicies,
  [getLeadPriorities.name]: getLeadPriorities,
  [getRecruitingSnapshot.name]: getRecruitingSnapshot,
  [getClientSnapshot.name]: getClientSnapshot,
  [searchCloseLeads.name]: searchCloseLeads,
  [getCloseLeadSnapshot.name]: getCloseLeadSnapshot,
  [getCloseLeadActivity.name]: getCloseLeadActivity,
  [getCloseOpportunities.name]: getCloseOpportunities,
  [draftCloseNote.name]: draftCloseNote,
  [draftCloseTask.name]: draftCloseTask,
  [draftEmailMessage.name]: draftEmailMessage,
  [draftSmsMessage.name]: draftSmsMessage,
  [getUnderwritingRecommendation.name]: getUnderwritingRecommendation,
  [getWeather.name]: getWeather,
  [resolveContact.name]: resolveContact,
};

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Build the Anthropic `tools` array for an agent's allowed tool names. */
export function buildAnthropicTools(
  allowedNames: string[],
): AnthropicToolDef[] {
  const out: AnthropicToolDef[] = [];
  for (const name of allowedNames) {
    const tool = TOOLS[name];
    const meta = TOOL_METADATA[name];
    if (!tool || !meta || !meta.implemented) continue;
    out.push({
      name,
      description: meta.description,
      input_schema: tool.inputSchema,
    });
  }
  return out;
}
