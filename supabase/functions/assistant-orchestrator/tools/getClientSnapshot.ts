// Book-of-business snapshot: a compact summary of the caller's clients, via
// get_clients_with_stats (SECURITY DEFINER, scopes to auth.uid() when no id passed).
// Returns aggregates + top clients by premium (NAME + policy counts only) — the raw
// RPC also returns email/phone/address/DOB/notes, which we deliberately drop here to
// keep client PII out of the model context. Read-only.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";

const num = (v: unknown): number =>
  typeof v === "number" ? v : Number(v) || 0;

async function run(_input: Record<string, unknown>, ctx: AssistantToolContext) {
  const { data, error } = await ctx.db.rpc("get_clients_with_stats", {});
  if (error) return { available: false, reason: "unavailable" };
  const rows = (data as Array<Record<string, unknown>>) ?? [];
  if (rows.length === 0) return { available: false, reason: "no_client_data" };

  const totalClients = rows.length;
  const clientsWithActivePolicies = rows.filter(
    (r) => num(r.active_policy_count) > 0,
  ).length;
  const totalPremium = rows.reduce((s, r) => s + num(r.total_premium), 0);
  const topClients = [...rows]
    .sort((a, b) => num(b.total_premium) - num(a.total_premium))
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      policyCount: num(r.policy_count),
      activePolicyCount: num(r.active_policy_count),
      totalPremium: num(r.total_premium),
    }));

  return {
    available: true,
    data: {
      summary: {
        totalClients,
        clientsWithActivePolicies,
        totalPremium,
        avgPremiumPerClient: totalClients ? totalPremium / totalClients : 0,
      },
      topClients,
    },
  };
}

export const getClientSnapshot: RegisteredTool = {
  name: "getClientSnapshot",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  run,
};
