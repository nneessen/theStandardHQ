// src/features/recruiting/utils/__tests__/recruit-action-policy.test.ts
import { describe, it, expect } from "vitest";
import { getRecruitActionPolicy } from "../recruit-action-policy";
import type { PolicyInput } from "../recruit-action-policy";
import type {
  PhaseProgress,
  RecruitSlackContext,
  RecruitActionLoading,
} from "../../types/recruit-detail.types";
import type { UserProfile } from "@/types/hierarchy.types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseRecruit: Partial<UserProfile> = {
  id: "user-1",
  email: "test@example.com",
  agent_status: "unlicensed",
  npn: "NPN123",
};

const baseSlack: RecruitSlackContext = {
  recruitIntegration: { id: "int-1" },
  recruitChannel: { id: "ch-1", name: "new-agents" },
  imoId: "imo-1",
  notificationStatus: { newRecruitSent: false, npnReceivedSent: false },
};

const noLoadingStates: RecruitActionLoading = {
  isAdvancing: false,
  isReverting: false,
  isInitializing: false,
  isUnenrolling: false,
  isResendingInvite: false,
  isCancellingInvitation: false,
  isSendingSlack: false,
};

const activePhase: PhaseProgress = {
  phase_id: "phase-1",
  status: "in_progress",
};
const blockedPhase: PhaseProgress = { phase_id: "phase-1", status: "blocked" };

function buildInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  const base: PolicyInput = {
    entity: {
      kind: "registered",
      recruit: baseRecruit as UserProfile,
      recruitId: "user-1",
    },
    currentPhase: activePhase,
    canRevert: false,
    hasPipelineProgress: true,
    recruit: baseRecruit as UserProfile,
    slack: baseSlack,
    loading: noLoadingStates,
  };
  return { ...base, ...overrides };
}

// ─── canResendInvite ──────────────────────────────────────────────────────────

describe("canResendInvite", () => {
  it("is true when recruit has email and is not resending", () => {
    const result = getRecruitActionPolicy(buildInput());
    expect(result.canResendInvite).toBe(true);
  });

  it("is false when recruit has no email (no-op guard)", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        recruit: { ...baseRecruit, email: undefined } as unknown as UserProfile,
      }),
    );
    expect(result.canResendInvite).toBe(false);
  });

  it("is false when currently resending", () => {
    const result = getRecruitActionPolicy(
      buildInput({ loading: { ...noLoadingStates, isResendingInvite: true } }),
    );
    expect(result.canResendInvite).toBe(false);
  });
});

// ─── canAdvance ───────────────────────────────────────────────────────────────

describe("canAdvance", () => {
  it("is true when phase is active and not advancing", () => {
    const result = getRecruitActionPolicy(buildInput());
    expect(result.canAdvance).toBe(true);
  });

  it("is false when currentPhase is null", () => {
    const result = getRecruitActionPolicy(buildInput({ currentPhase: null }));
    expect(result.canAdvance).toBe(false);
  });

  it("is false when phase is blocked", () => {
    const result = getRecruitActionPolicy(
      buildInput({ currentPhase: blockedPhase }),
    );
    expect(result.canAdvance).toBe(false);
  });

  it("is false when isAdvancing is true", () => {
    const result = getRecruitActionPolicy(
      buildInput({ loading: { ...noLoadingStates, isAdvancing: true } }),
    );
    expect(result.canAdvance).toBe(false);
  });
});

// ─── canBlock / canUnblock ────────────────────────────────────────────────────

describe("canBlock", () => {
  it("is false when phase is already blocked", () => {
    const result = getRecruitActionPolicy(
      buildInput({ currentPhase: blockedPhase }),
    );
    expect(result.canBlock).toBe(false);
  });

  it("is false when there is no phase", () => {
    const result = getRecruitActionPolicy(buildInput({ currentPhase: null }));
    expect(result.canBlock).toBe(false);
  });

  it("is true when phase is in_progress", () => {
    const result = getRecruitActionPolicy(buildInput());
    expect(result.canBlock).toBe(true);
  });
});

describe("canUnblock", () => {
  it("is true only when phase is blocked", () => {
    const blocked = getRecruitActionPolicy(
      buildInput({ currentPhase: blockedPhase }),
    );
    const active = getRecruitActionPolicy(buildInput());
    expect(blocked.canUnblock).toBe(true);
    expect(active.canUnblock).toBe(false);
  });
});

// ─── canCancelInvitation ──────────────────────────────────────────────────────

describe("canCancelInvitation", () => {
  it("is false when entity kind is registered", () => {
    const result = getRecruitActionPolicy(buildInput());
    expect(result.canCancelInvitation).toBe(false);
  });

  it("is false when invitationId is empty", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        entity: {
          kind: "invitation",
          recruit: baseRecruit as UserProfile,
          invitationId: "",
          invitationStatus: "pending",
        },
      }),
    );
    expect(result.canCancelInvitation).toBe(false);
  });

  it("is false when isCancellingInvitation is true", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        entity: {
          kind: "invitation",
          recruit: baseRecruit as UserProfile,
          invitationId: "inv-1",
          invitationStatus: "pending",
        },
        loading: { ...noLoadingStates, isCancellingInvitation: true },
      }),
    );
    expect(result.canCancelInvitation).toBe(false);
  });

  it("is true when invitation exists and not cancelling", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        entity: {
          kind: "invitation",
          recruit: baseRecruit as UserProfile,
          invitationId: "inv-1",
          invitationStatus: "pending",
        },
      }),
    );
    expect(result.canCancelInvitation).toBe(true);
  });
});

// ─── Slack visibility ─────────────────────────────────────────────────────────

describe("showNewRecruitSlack", () => {
  it("is false when recruitIntegration is null", () => {
    const result = getRecruitActionPolicy(
      buildInput({ slack: { ...baseSlack, recruitIntegration: null } }),
    );
    expect(result.showNewRecruitSlack).toBe(false);
  });

  it("is false when recruitChannel is null", () => {
    const result = getRecruitActionPolicy(
      buildInput({ slack: { ...baseSlack, recruitChannel: null } }),
    );
    expect(result.showNewRecruitSlack).toBe(false);
  });

  it("is false when agent_status is not unlicensed", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        recruit: { ...baseRecruit, agent_status: "licensed" } as UserProfile,
      }),
    );
    expect(result.showNewRecruitSlack).toBe(false);
  });

  it("is true when all conditions are met", () => {
    const result = getRecruitActionPolicy(buildInput());
    expect(result.showNewRecruitSlack).toBe(true);
  });

  it("is false for invitation entities (not registered)", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        entity: {
          kind: "invitation",
          recruit: baseRecruit as UserProfile,
          invitationId: "inv-1",
          invitationStatus: "pending",
        },
      }),
    );
    expect(result.showNewRecruitSlack).toBe(false);
  });
});

describe("showNpnSlack", () => {
  it("is true even when npn is null (button always visible, guard on click)", () => {
    const result = getRecruitActionPolicy(
      buildInput({ recruit: { ...baseRecruit, npn: null } as UserProfile }),
    );
    expect(result.showNpnSlack).toBe(true);
  });

  it("is true when npn exists and integration is present", () => {
    const result = getRecruitActionPolicy(buildInput());
    expect(result.showNpnSlack).toBe(true);
  });

  it("is false when recruitIntegration is null", () => {
    const result = getRecruitActionPolicy(
      buildInput({ slack: { ...baseSlack, recruitIntegration: null } }),
    );
    expect(result.showNpnSlack).toBe(false);
  });

  it("is false for invitation entities", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        entity: {
          kind: "invitation",
          recruit: baseRecruit as UserProfile,
          invitationId: "inv-1",
          invitationStatus: "pending",
        },
      }),
    );
    expect(result.showNpnSlack).toBe(false);
  });
});

// ─── Slack disabled states ────────────────────────────────────────────────────

describe("newRecruitSlackDisabled", () => {
  it("is true when newRecruitSent is true", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        slack: {
          ...baseSlack,
          notificationStatus: { newRecruitSent: true, npnReceivedSent: false },
        },
      }),
    );
    expect(result.newRecruitSlackDisabled).toBe(true);
  });

  it("is true when isSendingSlack is true", () => {
    const result = getRecruitActionPolicy(
      buildInput({ loading: { ...noLoadingStates, isSendingSlack: true } }),
    );
    expect(result.newRecruitSlackDisabled).toBe(true);
  });

  it("is false when not yet sent and not currently sending", () => {
    const result = getRecruitActionPolicy(buildInput());
    expect(result.newRecruitSlackDisabled).toBe(false);
  });
});

describe("npnSlackDisabled", () => {
  it("is true when npnReceivedSent is true", () => {
    const result = getRecruitActionPolicy(
      buildInput({
        slack: {
          ...baseSlack,
          notificationStatus: { newRecruitSent: false, npnReceivedSent: true },
        },
      }),
    );
    expect(result.npnSlackDisabled).toBe(true);
  });
});
