// Tool registry binding: maps tool names to handlers and builds the Anthropic tool
// definitions (name + description from core metadata + JSON Schema from each tool).

import { TOOL_METADATA } from "../core/registry.ts";
import type { RegisteredTool } from "./types.ts";
import { getDailyBriefingData } from "./getDailyBriefingData.ts";
import { getTeamProductionSummary } from "./getTeamProductionSummary.ts";
import { getPolicyRiskAlerts } from "./getPolicyRiskAlerts.ts";
import { getLeadPriorities } from "./getLeadPriorities.ts";
import { getRecruitingSnapshot } from "./getRecruitingSnapshot.ts";
import { getClientSnapshot } from "./getClientSnapshot.ts";
import { draftEmailMessage } from "./draftEmailMessage.ts";
import { draftSmsMessage } from "./draftSmsMessage.ts";

export const TOOLS: Record<string, RegisteredTool> = {
  [getDailyBriefingData.name]: getDailyBriefingData,
  [getTeamProductionSummary.name]: getTeamProductionSummary,
  [getPolicyRiskAlerts.name]: getPolicyRiskAlerts,
  [getLeadPriorities.name]: getLeadPriorities,
  [getRecruitingSnapshot.name]: getRecruitingSnapshot,
  [getClientSnapshot.name]: getClientSnapshot,
  [draftEmailMessage.name]: draftEmailMessage,
  [draftSmsMessage.name]: draftSmsMessage,
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
