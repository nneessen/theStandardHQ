// src/features/recruiting/utils/recruit-action-policy.ts
// Pure function — no React imports. All disabled/visibility rules live here.

import type {
  RecruitEntity,
  PhaseProgress,
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
    loading,
  } = input;
  const isBlocked = currentPhase?.status === "blocked";
  const hasPhase = !!currentPhase;

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
  };
}
