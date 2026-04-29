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
  // Visibility: buttons show for any registered recruit. Integration/channel
  // resolution is deferred to the click handler, which surfaces a toast if
  // the workspace isn't connected or the channel can't be resolved.
  const slackVisible = entity.kind === "registered";

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
    showNewRecruitSlack: slackVisible,
    showNpnSlack: slackVisible,
    newRecruitSlackDisabled:
      !!slack.notificationStatus?.newRecruitSent || loading.isSendingSlack,
    npnSlackDisabled:
      !!slack.notificationStatus?.npnReceivedSent || loading.isSendingSlack,
  };
}
