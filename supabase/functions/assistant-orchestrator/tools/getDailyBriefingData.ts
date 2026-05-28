// Composite briefing tool: fans out the grounding RPCs in parallel and returns one
// combined JSON payload with a per-section `available` flag. Single model->tool
// roundtrip for "brief me" requests. All RPCs run on the user-scoped client (RLS).

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { toSection } from "./types.ts";

async function run(_input: Record<string, unknown>, ctx: AssistantToolContext) {
  const [team, atRisk, chargeback, recruiting, leadHeat] =
    await Promise.allSettled([
      ctx.db.rpc("get_team_leaderboard_data", {}),
      ctx.db.rpc("get_at_risk_commissions", { p_user_id: ctx.userId }),
      ctx.db.rpc("get_user_commission_chargeback_summary"),
      ctx.db.rpc("get_recruiting_leads_stats", {}),
      ctx.db.rpc("avg_lead_heat_score", { p_user_id: ctx.userId }),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    note: "Each section has `available`. When available is false, tell the user that section has no data — do NOT invent figures.",
    sections: {
      teamProduction: toSection(team, (d) => ({ teams: d })),
      policyRisk: toSection(atRisk, (d) => ({ atRiskCommissions: d })),
      chargebackRisk: toSection(chargeback),
      recruiting: toSection(recruiting),
      leadHeat: toSection(leadHeat, (d) => {
        const rows = d as Array<{ avg_score: number }>;
        return { averageHeatScore: rows[0]?.avg_score ?? null };
      }),
    },
  };
}

export const getDailyBriefingData: RegisteredTool = {
  name: "getDailyBriefingData",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  run,
};
