// getAgencyAgentLeaderboard merges the additive get_agency_ap_leaderboard RPC's
// SUBMITTED policy count (matches AP) onto the canonical leaderboard entries (#2).
// The enrichment is non-fatal: if the companion RPC fails, the call still succeeds
// and entries fall back to the legacy approved policyCount.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LeaderboardFilters } from "@/types/leaderboard.types";

const rpc = vi.fn();
vi.mock("@/services/base/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { leaderboardService } from "../leaderboardService";

const FILTERS = {
  timePeriod: "mtd",
  scope: "agency",
} as unknown as LeaderboardFilters;

function lbRow(over: Record<string, unknown>) {
  return {
    agent_id: "a1",
    agent_name: "Marcus Webb",
    agent_email: "m@example.com",
    profile_photo_url: null,
    agency_id: "ag1",
    agency_name: "The Standard",
    direct_downline_count: 0,
    ip_total: 0,
    ap_total: 1000,
    policy_count: 1,
    pending_policy_count: 0,
    prospect_count: 0,
    pipeline_count: 0,
    rank_overall: 1,
    ...over,
  };
}

beforeEach(() => rpc.mockReset());

describe("getAgencyAgentLeaderboard — submitted-count merge (#2)", () => {
  it("merges submitted_policies (matches AP), re-ranks by AP, keeps legacy policyCount", async () => {
    rpc.mockImplementation((name: string) =>
      name === "get_leaderboard_data"
        ? Promise.resolve({
            data: [
              lbRow({
                agent_id: "a1",
                ap_total: 1000,
                policy_count: 1,
                rank_overall: 2,
              }),
              lbRow({
                agent_id: "a2",
                agent_name: "Alyssa Chen",
                ap_total: 5000,
                policy_count: 2,
                rank_overall: 1,
              }),
            ],
            error: null,
          })
        : Promise.resolve({
            // submitted counts DIFFER from the approved policy_count above
            data: [
              {
                agent_id: "a1",
                agent_name: "Marcus Webb",
                profile_photo_url: null,
                ap_total: 1000,
                submitted_policies: 7,
              },
              {
                agent_id: "a2",
                agent_name: "Alyssa Chen",
                profile_photo_url: null,
                ap_total: 5000,
                submitted_policies: 9,
              },
            ],
            error: null,
          }),
    );

    const res = await leaderboardService.getAgencyAgentLeaderboard(
      FILTERS,
      "ag1",
    );

    // re-ranked by AP desc
    expect(res.entries.map((e) => e.agentId)).toEqual(["a2", "a1"]);
    expect(res.entries[0].rankOverall).toBe(1);
    const a1 = res.entries.find((e) => e.agentId === "a1")!;
    expect(a1.submittedPolicies).toBe(7); // submitted (matches AP)
    expect(a1.policyCount).toBe(1); // legacy approved, preserved
    expect(res.entries.find((e) => e.agentId === "a2")!.submittedPolicies).toBe(
      9,
    );
  });

  it("falls back gracefully (submittedPolicies undefined) when the companion RPC errors", async () => {
    rpc.mockImplementation((name: string) =>
      name === "get_leaderboard_data"
        ? Promise.resolve({
            data: [lbRow({ agent_id: "a1", policy_count: 3 })],
            error: null,
          })
        : Promise.resolve({ data: null, error: new Error("companion boom") }),
    );

    const res = await leaderboardService.getAgencyAgentLeaderboard(
      FILTERS,
      "ag1",
    );

    // whole call still succeeds; cards fall back to policyCount when submitted is absent
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].submittedPolicies).toBeUndefined();
    expect(res.entries[0].policyCount).toBe(3);
  });

  it("throws when the primary leaderboard RPC errors", async () => {
    rpc.mockImplementation((name: string) =>
      name === "get_leaderboard_data"
        ? Promise.resolve({ data: null, error: new Error("primary boom") })
        : Promise.resolve({ data: [], error: null }),
    );

    await expect(
      leaderboardService.getAgencyAgentLeaderboard(FILTERS, "ag1"),
    ).rejects.toThrow(/Failed to fetch agency agent leaderboard/i);
  });
});
