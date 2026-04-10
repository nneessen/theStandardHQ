// src/features/recruiting/types/recruit-detail.types.ts
import type { UserProfile } from "@/types/hierarchy.types";
import type {
  InvitationStatus,
  PhaseProgressStatus,
} from "@/types/recruiting.types";

/**
 * Discriminated union for recruit entities.
 * Replaces `as any` casts for invitation fields.
 */
export type RecruitEntity =
  | { kind: "registered"; recruit: UserProfile; recruitId: string }
  | {
      kind: "invitation";
      recruit: UserProfile;
      invitationId: string;
      invitationStatus: InvitationStatus;
    };

/**
 * Centralized permission derivation — computed once in the orchestrator,
 * passed to all subcomponents. Fixes inconsistent permission checks
 * (e.g., initialize-pipeline only checked isUpline, header checked all three).
 */
export interface RecruitPermissions {
  /** isUpline || is_admin || staff role */
  canManage: boolean;
  /** Same as canManage — fixes bug where initialize only checked isUpline */
  canInitialize: boolean;
  /** canManage && not viewing self */
  canDelete: boolean;
  /** is_admin || trainer || contracting_manager */
  isStaff: boolean;
}

/** Replaces loose `{ phase_id: string; status: string }` inline type */
export interface PhaseProgress {
  phase_id: string;
  status: PhaseProgressStatus;
}

export interface RecruitNotificationStatus {
  newRecruitSent: boolean;
  npnReceivedSent: boolean;
}

/** Mutating callbacks return Promise<void>; non-mutating stay void */
export interface RecruitActionCallbacks {
  onAdvancePhase: () => Promise<void>;
  onBlockPhase: (reason: string) => Promise<void>;
  onUnblockPhase: () => Promise<void>;
  onRevertPhase: () => Promise<void>;
  onInitialize: () => void;
  onUnenroll: () => void;
  onResendInvite: () => Promise<void>;
  onCancelInvitation: () => Promise<void>;
  onDeleteOpen: () => void;
  onSendSlackNotification: (
    type: "new_recruit" | "npn_received",
  ) => Promise<void>;
}

export interface RecruitActionLoading {
  isAdvancing: boolean;
  isReverting: boolean;
  isInitializing: boolean;
  isUnenrolling: boolean;
  isResendingInvite: boolean;
  isCancellingInvitation: boolean;
  isSendingSlack: boolean;
}

export interface RecruitSlackContext {
  selfMadeIntegration: { id: string } | null;
  recruitChannel: { id: string; name?: string } | null;
  imoId: string | null;
  notificationStatus: RecruitNotificationStatus | undefined;
}

export interface RecruitActionPolicy {
  canAdvance: boolean;
  canBlock: boolean;
  canUnblock: boolean;
  canRevert: boolean;
  canUnenroll: boolean;
  canResendInvite: boolean;
  canCancelInvitation: boolean;
  showNewRecruitSlack: boolean;
  showNpnSlack: boolean;
  newRecruitSlackDisabled: boolean;
  npnSlackDisabled: boolean;
}
