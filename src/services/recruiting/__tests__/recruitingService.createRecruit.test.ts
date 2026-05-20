import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../base/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("../../events/workflowEventEmitter", () => ({
  WORKFLOW_EVENTS: {
    RECRUIT_CREATED: "recruit.created",
  },
  workflowEventEmitter: {
    emit: vi.fn(),
  },
}));

vi.mock("@/services/documents", () => ({
  documentService: {},
  documentStorageService: {},
}));

vi.mock("@/services/activity", () => ({
  activityLogService: {},
}));

import { supabase } from "../../base/supabase";
import { workflowEventEmitter } from "../../events/workflowEventEmitter";
import { recruitingService } from "../recruitingService";

describe("recruitingService.createRecruit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects edge partial success when the recruit profile was not persisted", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        user: { id: "auth-user-1" },
        profile: null,
        profileUpdateError: "Profile update failed after auth creation",
      },
      error: null,
    });

    await expect(
      recruitingService.createRecruit({
        first_name: "Taylor",
        last_name: "Agent",
        email: "taylor@example.com",
        agent_status: "unlicensed",
      }),
    ).rejects.toThrow("Profile update failed after auth creation");

    expect(workflowEventEmitter.emit).not.toHaveBeenCalled();
  });

  it("emits recruit-created only after a persisted profile is returned", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        user: { id: "recruit-1" },
        profile: {
          id: "recruit-1",
          email: "taylor@example.com",
          first_name: "Taylor",
          last_name: "Agent",
          recruiter_id: "agent-1",
          upline_id: "agent-1",
          agent_status: "unlicensed",
          onboarding_status: "prospect",
        },
        profileUpdateError: null,
      },
      error: null,
    });

    const recruit = await recruitingService.createRecruit({
      first_name: "Taylor",
      last_name: "Agent",
      email: "taylor@example.com",
      agent_status: "unlicensed",
    });

    expect(recruit.id).toBe("recruit-1");
    expect(workflowEventEmitter.emit).toHaveBeenCalledWith(
      "recruit.created",
      expect.objectContaining({
        recruitId: "recruit-1",
        recruiterId: "agent-1",
        uplineId: "agent-1",
      }),
    );
  });
});
