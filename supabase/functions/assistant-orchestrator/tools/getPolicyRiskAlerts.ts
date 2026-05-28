// Policy/commission risk: at-risk commissions (advance vs earned, risk level) plus a
// chargeback-risk summary. Read-only, RLS-scoped to the caller.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { toSection } from "./types.ts";

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const threshold =
    typeof input.riskThreshold === "number" ? input.riskThreshold : 3;

  const [atRisk, chargeback] = await Promise.allSettled([
    ctx.db.rpc("get_at_risk_commissions", {
      p_user_id: ctx.userId,
      p_risk_threshold: threshold,
    }),
    ctx.db.rpc("get_user_commission_chargeback_summary"),
  ]);

  return {
    atRisk: toSection(atRisk, (d) => ({ commissions: d })),
    chargebackSummary: toSection(chargeback),
  };
}

export const getPolicyRiskAlerts: RegisteredTool = {
  name: "getPolicyRiskAlerts",
  inputSchema: {
    type: "object",
    properties: {
      riskThreshold: {
        type: "number",
        description:
          "Months-paid threshold below which a commission is at risk (default 3).",
      },
    },
    additionalProperties: false,
  },
  run,
};
