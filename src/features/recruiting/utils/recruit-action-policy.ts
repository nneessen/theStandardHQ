// src/features/recruiting/utils/recruit-action-policy.ts
// Pure function — no React imports. All disabled/visibility rules live here.

import type {
  RecruitEntity,
  PhaseProgress,
  RecruitSlackContext,
  RecruitActionLoading,
  RecruitActionPolicy,
} from "../types/recruit-detail.types";
import type { UserProfile } from "@/types/hierarchy.types";

export interface PolicyInput {
  entity: RecruitEntity;
  currentPhase: PhaseProgress | null | undefined;
  canRevert: boolean;
  hasPipelineProgress: boolean;
  recruit: UserProfile;
  slack: RecruitSlackContext;
  loading: RecruitActionLoading;
}

export function getRecruitActionPolicy(
  input: PolicyInput,
): RecruitActionPolicy {
  const {
    entity,
    currentPhase,
    canRevert,
    hasPipelineProgress,
    recruit,
    slack,
    loading,
  } = input;
  const isBlocked = currentPhase?.status === "blocked";
  const hasPhase = !!currentPhase;
  // Visibility intentionally permissive: show the buttons whenever we have a
  // connected Slack integration for the IMO, even if the recruit channel
  // can't be resolved here. The click handler resolves the channel (explicit
  // setting → name fallback) and surfaces a toast pointing to Settings if
  // nothing is configured. Hiding the buttons on missing config is what
  // caused them to silently disappear after the per-IMO refactor.
  const slackVisible =
    entity.kind === "registered" && !!slack.recruitIntegration && !!slack.imoId;

  return {
    canAdvance: hasPhase && !isBlocked && !loading.isAdvancing,
    canBlock: hasPhase && !isBlocked,
    canUnblock: isBlocked,
    canRevert,
    canUnenroll: hasPipelineProgress,
    canResendInvite: !!recruit.email && !loading.isResendingInvite,
    canCancelInvitation:
      entity.kind === "invitation" &&
      !!entity.invitationId &&
      !loading.isCancellingInvitation,
    showNewRecruitSlack: slackVisible && recruit.agent_status === "unlicensed",
    showNpnSlack: slackVisible,
    newRecruitSlackDisabled:
      !!slack.notificationStatus?.newRecruitSent || loading.isSendingSlack,
    npnSlackDisabled:
      !!slack.notificationStatus?.npnReceivedSent || loading.isSendingSlack,
  };
}
