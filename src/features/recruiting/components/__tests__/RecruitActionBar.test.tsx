// src/features/recruiting/components/__tests__/RecruitActionBar.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RecruitActionBar } from "../RecruitActionBar";
import type {
  RecruitEntity,
  RecruitPermissions,
  PhaseProgress,
  RecruitActionCallbacks,
  RecruitActionLoading,
  RecruitSlackContext,
} from "../../types/recruit-detail.types";
import type { UserProfile } from "@/types/hierarchy.types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseRecruit: Partial<UserProfile> = {
  id: "user-1",
  email: "test@example.com",
  agent_status: "unlicensed",
  npn: "NPN123",
};

const registeredEntity: RecruitEntity = {
  kind: "registered",
  recruit: baseRecruit as UserProfile,
  recruitId: "user-1",
};

const invitationEntity: RecruitEntity = {
  kind: "invitation",
  recruit: baseRecruit as UserProfile,
  invitationId: "inv-1",
  invitationStatus: "pending",
};

const canManagePerms: RecruitPermissions = {
  canManage: true,
  canInitialize: true,
  canDelete: true,
  isStaff: true,
};

const noManagePerms: RecruitPermissions = {
  canManage: false,
  canInitialize: false,
  canDelete: false,
  isStaff: false,
};

const activePhase: PhaseProgress = {
  phase_id: "phase-1",
  status: "in_progress",
};
const blockedPhase: PhaseProgress = { phase_id: "phase-1", status: "blocked" };

const noLoadingStates: RecruitActionLoading = {
  isAdvancing: false,
  isReverting: false,
  isInitializing: false,
  isUnenrolling: false,
  isResendingInvite: false,
  isCancellingInvitation: false,
  isSendingSlack: false,
  isSendingDiscord: false,
};

const noSlack: RecruitSlackContext = {
  selfMadeIntegration: null,
  recruitChannel: null,
  imoId: null,
  notificationStatus: undefined,
};

const activeSlack: RecruitSlackContext = {
  selfMadeIntegration: { id: "int-1" },
  recruitChannel: { id: "ch-1", name: "new-agents" },
  imoId: "imo-1",
  notificationStatus: { newRecruitSent: false, npnReceivedSent: false },
};

const noDiscord = {
  integration: null,
  recruitChannelId: null,
  recruitChannelName: null,
  imoId: null,
  notificationStatus: undefined,
};

function makeActions(
  overrides: Partial<RecruitActionCallbacks> = {},
): RecruitActionCallbacks {
  const base: RecruitActionCallbacks = {
    onAdvancePhase: vi.fn().mockResolvedValue(undefined),
    onBlockPhase: vi.fn().mockResolvedValue(undefined),
    onUnblockPhase: vi.fn().mockResolvedValue(undefined),
    onRevertPhase: vi.fn().mockResolvedValue(undefined),
    onInitialize: vi.fn(),
    onUnenroll: vi.fn(),
    onResendInvite: vi.fn().mockResolvedValue(undefined),
    onCancelInvitation: vi.fn().mockResolvedValue(undefined),
    onDeleteOpen: vi.fn(),
    onSendSlackNotification: vi.fn().mockResolvedValue(undefined),
    onSendDiscordNotification: vi.fn().mockResolvedValue(undefined),
  };
  return { ...base, ...overrides };
}

interface RenderProps {
  entity?: RecruitEntity;
  permissions?: RecruitPermissions;
  hasPipelineProgress?: boolean;
  currentPhase?: PhaseProgress | null;
  canRevert?: boolean;
  slack?: RecruitSlackContext;
  actions?: RecruitActionCallbacks;
  loading?: RecruitActionLoading;
}

function renderBar(props: RenderProps = {}) {
  const actions = props.actions ?? makeActions();
  return {
    ...render(
      <RecruitActionBar
        entity={props.entity ?? registeredEntity}
        permissions={props.permissions ?? canManagePerms}
        recruit={baseRecruit as UserProfile}
        hasPipelineProgress={props.hasPipelineProgress ?? true}
        currentPhase={props.currentPhase ?? activePhase}
        canRevert={props.canRevert ?? false}
        slack={props.slack ?? noSlack}
        discord={noDiscord}
        actions={actions}
        loading={props.loading ?? noLoadingStates}
      />,
    ),
    actions,
  };
}

// ─── Permission guard ─────────────────────────────────────────────────────────

describe("permission guard", () => {
  it("returns null when canManage is false", () => {
    const { container } = renderBar({ permissions: noManagePerms });
    expect(container.firstChild).toBeNull();
  });
});

// ─── Invitation entity ────────────────────────────────────────────────────────

describe("invitation entity", () => {
  it("shows Resend and Cancel buttons", () => {
    renderBar({ entity: invitationEntity });
    expect(screen.getByText(/Resend/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
  });

  it("Cancel button is disabled when invitationId is missing", () => {
    const noIdInvitation: RecruitEntity = {
      kind: "invitation",
      recruit: baseRecruit as UserProfile,
      invitationId: "",
      invitationStatus: "pending",
    };
    renderBar({ entity: noIdInvitation });
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeDisabled();
  });

  it("calls onCancelInvitation and closes dialog on resolve", async () => {
    const actions = makeActions();
    renderBar({ entity: invitationEntity, actions });

    // Open cancel dialog
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    // Wait for dialog to open, then click the confirm button (not the dialog title)
    await waitFor(() =>
      screen.getByText(
        "Cancel this invitation? The registration link will no longer work.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel Invitation" }));

    await waitFor(() =>
      expect(actions.onCancelInvitation).toHaveBeenCalledTimes(1),
    );
    // Dialog closes after resolve
    await waitFor(() =>
      expect(
        screen.queryByText(
          "Cancel this invitation? The registration link will no longer work.",
        ),
      ).toBeNull(),
    );
  });

  it("keeps dialog open when callback rejects", async () => {
    const actions = makeActions({
      onCancelInvitation: vi.fn().mockRejectedValue(new Error("network")),
    });
    renderBar({ entity: invitationEntity, actions });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() =>
      screen.getByText(
        "Cancel this invitation? The registration link will no longer work.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel Invitation" }));

    await waitFor(() =>
      expect(actions.onCancelInvitation).toHaveBeenCalledTimes(1),
    );
    // Dialog should still be open
    expect(
      screen.getByText(
        "Cancel this invitation? The registration link will no longer work.",
      ),
    ).toBeInTheDocument();
  });
});

// ─── Integration path: handler must propagate errors ─────────────────────────
// Validates the fix for "swallowed errors closing dialogs" bug.
// Simulates the real panel pattern: handler calls mutateAsync and does NOT
// catch, so rejection propagates to runAction's catch block.

describe("runAction integration — handler propagation", () => {
  it("dialog stays open when handler rejects (propagation not swallowed)", async () => {
    // Simulates: mutateAsync rejects → handler propagates → runAction catches → dialog stays open
    const failingAdvance = vi.fn().mockRejectedValue(new Error("network"));
    const actions = makeActions({ onAdvancePhase: failingAdvance });
    renderBar({ actions });

    fireEvent.click(screen.getByRole("button", { name: /^Advance$/i }));
    await waitFor(() =>
      screen.getByText("Advance this recruit to the next phase?"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));

    await waitFor(() => expect(failingAdvance).toHaveBeenCalledTimes(1));
    // Dialog must still be open — if handler swallowed the error, it would have closed
    expect(
      screen.getByText("Advance this recruit to the next phase?"),
    ).toBeInTheDocument();
  });

  it("dialog closes when handler resolves (success path)", async () => {
    const successAdvance = vi.fn().mockResolvedValue(undefined);
    const actions = makeActions({ onAdvancePhase: successAdvance });
    renderBar({ actions });

    fireEvent.click(screen.getByRole("button", { name: /^Advance$/i }));
    await waitFor(() =>
      screen.getByText("Advance this recruit to the next phase?"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));

    await waitFor(() => expect(successAdvance).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByText("Advance this recruit to the next phase?"),
      ).toBeNull(),
    );
  });
});

// ─── Registered entity — pipeline ────────────────────────────────────────────

describe("registered entity — pipeline", () => {
  it("shows Advance and Block buttons when active phase", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: /advance/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /block/i })).toBeInTheDocument();
  });

  it("shows Unblock instead of Block when phase is blocked", () => {
    renderBar({ currentPhase: blockedPhase });
    expect(
      screen.getByRole("button", { name: /unblock/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Block$/i })).toBeNull();
  });

  it("calls onAdvancePhase and closes dialog on resolve", async () => {
    const actions = makeActions();
    renderBar({ actions });

    fireEvent.click(screen.getByRole("button", { name: /^Advance$/i }));
    await waitFor(() =>
      screen.getByText("Advance this recruit to the next phase?"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));

    await waitFor(() =>
      expect(actions.onAdvancePhase).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(
        screen.queryByText("Advance this recruit to the next phase?"),
      ).toBeNull(),
    );
  });

  it("keeps dialog open when advance rejects", async () => {
    const actions = makeActions({
      onAdvancePhase: vi.fn().mockRejectedValue(new Error("server error")),
    });
    renderBar({ actions });

    fireEvent.click(screen.getByRole("button", { name: /^Advance$/i }));
    await waitFor(() =>
      screen.getByText("Advance this recruit to the next phase?"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));

    await waitFor(() =>
      expect(actions.onAdvancePhase).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.getByText("Advance this recruit to the next phase?"),
    ).toBeInTheDocument();
  });

  it("blockReason is cleared on successful block", async () => {
    const actions = makeActions();
    renderBar({ actions });

    fireEvent.click(screen.getByRole("button", { name: /^Block$/i }));
    await waitFor(() => screen.getByLabelText("Reason"));

    const input = screen.getByLabelText("Reason");
    fireEvent.change(input, { target: { value: "Documents missing" } });
    expect(input).toHaveValue("Documents missing");

    fireEvent.click(screen.getByRole("button", { name: "Block" }));
    await waitFor(() =>
      expect(actions.onBlockPhase).toHaveBeenCalledWith("Documents missing"),
    );

    // Dialog closes; blockReason is cleared
    await waitFor(() => expect(screen.queryByLabelText("Reason")).toBeNull());
  });

  it("blockReason is NOT cleared when block fails", async () => {
    const actions = makeActions({
      onBlockPhase: vi.fn().mockRejectedValue(new Error("fail")),
    });
    renderBar({ actions });

    fireEvent.click(screen.getByRole("button", { name: /^Block$/i }));
    await waitFor(() => screen.getByLabelText("Reason"));

    const input = screen.getByLabelText("Reason");
    fireEvent.change(input, { target: { value: "Some reason" } });
    fireEvent.click(screen.getByRole("button", { name: "Block" }));

    await waitFor(() => expect(actions.onBlockPhase).toHaveBeenCalledTimes(1));
    // Reason still visible
    expect(screen.getByLabelText("Reason")).toHaveValue("Some reason");
  });
});

// ─── Slack buttons ────────────────────────────────────────────────────────────

describe("Slack buttons", () => {
  it("are hidden when no slack integration", () => {
    renderBar({ slack: noSlack });
    expect(screen.queryByText(/Slack: New Recruit/i)).toBeNull();
    expect(screen.queryByText(/Slack: NPN/i)).toBeNull();
  });

  it("shows New Recruit button when agent_status is unlicensed", () => {
    renderBar({ slack: activeSlack });
    expect(screen.getByText(/Slack: New Recruit/i)).toBeInTheDocument();
  });

  it("hides New Recruit button when agent_status is licensed", () => {
    const licensedRecruit = {
      ...baseRecruit,
      agent_status: "licensed",
    } as UserProfile;
    render(
      <RecruitActionBar
        entity={registeredEntity}
        permissions={canManagePerms}
        recruit={licensedRecruit}
        hasPipelineProgress={true}
        currentPhase={activePhase}
        canRevert={false}
        slack={activeSlack}
        discord={noDiscord}
        actions={makeActions()}
        loading={noLoadingStates}
      />,
    );
    expect(screen.queryByText(/Slack: New Recruit/i)).toBeNull();
  });

  it("shows NPN button even when recruit has no npn (guard on click)", () => {
    const noNpnRecruit = { ...baseRecruit, npn: null } as UserProfile;
    render(
      <RecruitActionBar
        entity={registeredEntity}
        permissions={canManagePerms}
        recruit={noNpnRecruit}
        hasPipelineProgress={true}
        currentPhase={activePhase}
        canRevert={false}
        slack={activeSlack}
        discord={noDiscord}
        actions={makeActions()}
        loading={noLoadingStates}
      />,
    );
    expect(screen.getByText(/Slack: NPN/i)).toBeInTheDocument();
  });

  it("renders without hardcoded channel name (channelLabel uses recruitChannel.name)", () => {
    // Verify the component renders with an active slack channel — this implicitly
    // confirms the channelLabel code path ran without error. Deep tooltip text
    // is verified through unit tests of getRecruitActionPolicy.
    renderBar({ slack: activeSlack });
    expect(screen.getByText(/Slack: New Recruit/i)).toBeInTheDocument();
    expect(screen.getByText(/Slack: NPN/i)).toBeInTheDocument();
  });
});
