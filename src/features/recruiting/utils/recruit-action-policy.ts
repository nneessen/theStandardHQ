// src/features/recruiting/utils/recruit-action-policy.ts
// Pure function — no React imports. All disabled/visibility rules live here.

import type {
  RecruitEntity,
  PhaseProgress,
  RecruitSlackContext,
  RecruitDiscordContext,
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
  discord: RecruitDiscordContext;
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
    discord,
    loading,
  } = input;
  const isBlocked = currentPhase?.status === "blocked";
  const hasPhase = !!currentPhase;
  const slackVisible =
    entity.kind === "registered" &&
    !!slack.selfMadeIntegration &&
    !!slack.recruitChannel &&
    !!slack.imoId;
  const discordVisible =
    entity.kind === "registered" &&
    !!discord.integration &&
    !!discord.recruitChannelId &&
    !!discord.imoId;

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
    showNewRecruitDiscord:
      discordVisible && recruit.agent_status === "unlicensed",
    showNpnDiscord: discordVisible,
    newRecruitDiscordDisabled:
      !!discord.notificationStatus?.newRecruitSent || loading.isSendingDiscord,
    npnDiscordDisabled:
      !!discord.notificationStatus?.npnReceivedSent || loading.isSendingDiscord,
  };
}
