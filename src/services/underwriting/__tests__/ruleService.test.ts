import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/services/base/supabase";
import { logEvaluation, reorderRules } from "../ruleService";

vi.mock("@/services/base/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("underwriting ruleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the atomic reorder RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, updated: 2 },
      error: null,
    } as never);

    await expect(
      reorderRules("rule-set-1", ["rule-1", "rule-2"]),
    ).resolves.toBe(undefined);

    expect(supabase.rpc).toHaveBeenCalledWith("reorder_underwriting_rules", {
      p_rule_ids: ["rule-1", "rule-2"],
      p_rule_set_id: "rule-set-1",
    });
  });

  it("surfaces logical reorder failures from the RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        success: false,
        error: "Rule list does not exactly match the current rule set",
      },
      error: null,
    } as never);

    await expect(reorderRules("rule-set-1", ["rule-1"])).rejects.toThrow(
      "Rule list does not exactly match the current rule set",
    );
  });

  it("throws when underwriting audit logging fails", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    } as never);

    await expect(
      logEvaluation(
        "session-1",
        "rule-set-1",
        "rule-1",
        "diabetes",
        "matched",
        {
          inputHash: "hash-1",
          matchedConditions: [{ field: "client.age" }],
        },
      ),
    ).rejects.toThrow("Failed to write underwriting audit log: rpc failed");
  });

  it("surfaces logical underwriting audit log failures from the RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: "Access denied" },
      error: null,
    } as never);

    await expect(
      logEvaluation(
        "session-1",
        "rule-set-1",
        "rule-1",
        "diabetes",
        "matched",
        {
          inputHash: "hash-1",
        },
      ),
    ).rejects.toThrow("Access denied");
  });
});
