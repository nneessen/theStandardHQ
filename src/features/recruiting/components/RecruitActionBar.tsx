// src/features/recruiting/components/RecruitActionBar.tsx
import { useState } from "react";
import type { UserProfile } from "@/types/hierarchy.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Ban,
  SendHorizontal,
  Loader2,
  CheckCircle2,
  Clock,
  Check,
  RotateCcw,
  X,
  Trash2,
  Undo2,
  Hash,
  GraduationCap,
} from "lucide-react";
import { INVITATION_STATUS_LABELS } from "@/types/recruiting.types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GraduateToAgentDialog } from "@/features/admin";
import type {
  RecruitEntity,
  RecruitPermissions,
  PhaseProgress,
  RecruitActionCallbacks,
  RecruitActionLoading,
  RecruitSlackContext,
  RecruitActionPolicy,
} from "../types/recruit-detail.types";
import { getRecruitActionPolicy } from "../utils/recruit-action-policy";

interface RecruitActionBarProps {
  entity: RecruitEntity;
  permissions: RecruitPermissions;
  recruit: UserProfile;
  hasPipelineProgress: boolean;
  currentPhase: PhaseProgress | null | undefined;
  canRevert: boolean;
  slack: RecruitSlackContext;
  actions: RecruitActionCallbacks;
  loading: RecruitActionLoading;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InvitationActionBarProps {
  entity: RecruitEntity;
  policy: RecruitActionPolicy;
  loading: RecruitActionLoading;
  onResendInvite: () => Promise<void>;
  onCancelClick: () => void;
}

function InvitationActionBar({
  entity,
  policy,
  loading,
  onResendInvite,
  onCancelClick,
}: InvitationActionBarProps) {
  if (entity.kind !== "invitation") return null;
  return (
    <>
      <Badge
        variant="secondary"
        className="text-[10px] px-1.5 py-0 h-5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      >
        {entity.invitationStatus
          ? INVITATION_STATUS_LABELS[entity.invitationStatus]
          : "Pending"}
      </Badge>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          onResendInvite().catch(() => {});
        }}
        disabled={!policy.canResendInvite}
        className="h-6 text-[10px] px-2 flex-shrink-0"
      >
        {loading.isResendingInvite ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SendHorizontal className="h-3 w-3 mr-0.5" />
        )}
        Resend
      </Button>
      <div className="flex-1" />
      <Button
        size="sm"
        variant="ghost"
        onClick={onCancelClick}
        disabled={!policy.canCancelInvitation}
        className="h-6 text-[10px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
      >
        {loading.isCancellingInvitation ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <X className="h-3 w-3 mr-0.5" />
        )}
        Cancel
      </Button>
    </>
  );
}

interface PipelineActionBarProps {
  policy: RecruitActionPolicy;
  loading: RecruitActionLoading;
  permissions: RecruitPermissions;
  onAdvanceClick: () => void;
  onRevertClick: () => void;
  onBlockClick: () => void;
  onUnblockClick: () => void;
  onUnenroll: () => void;
  onInitialize: () => void;
  onResendInvite: () => Promise<void>;
  onDeleteOpen: () => void;
  hasPipelineProgress: boolean;
}

function PipelineActionBar({
  policy,
  loading,
  permissions,
  onAdvanceClick,
  onRevertClick,
  onBlockClick,
  onUnblockClick,
  onUnenroll,
  onInitialize,
  onResendInvite,
  onDeleteOpen,
  hasPipelineProgress,
}: PipelineActionBarProps) {
  return (
    <>
      {hasPipelineProgress ? (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onAdvanceClick}
            disabled={!policy.canAdvance}
            className="h-6 text-[10px] px-2 flex-shrink-0"
          >
            <ArrowRight className="h-3 w-3 mr-0.5" />
            Advance
          </Button>
          {policy.canRevert && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRevertClick}
              disabled={loading.isReverting}
              className="h-6 text-[10px] px-2 flex-shrink-0"
            >
              {loading.isReverting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Undo2 className="h-3 w-3 mr-0.5" />
              )}
              Revert
            </Button>
          )}
          {policy.canUnblock ? (
            <Button
              size="sm"
              variant="default"
              onClick={onUnblockClick}
              className="h-6 text-[10px] px-2 flex-shrink-0"
            >
              <CheckCircle2 className="h-3 w-3 mr-0.5" />
              Unblock
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onBlockClick}
              disabled={!policy.canBlock}
              className="h-6 text-[10px] px-2 flex-shrink-0"
            >
              <Ban className="h-3 w-3 mr-0.5" />
              Block
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onUnenroll}
            disabled={loading.isUnenrolling}
            className="h-6 text-[10px] px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 flex-shrink-0"
            title="Remove from pipeline to re-enroll in a different one"
          >
            <RotateCcw className="h-3 w-3 mr-0.5" />
            Unenroll
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={onInitialize}
          disabled={loading.isInitializing}
          className="h-6 text-[10px] px-2 flex-shrink-0"
        >
          {loading.isInitializing ? (
            <Loader2 className="h-3 w-3 mr-0.5 animate-spin" />
          ) : (
            <Clock className="h-3 w-3 mr-0.5" />
          )}
          Initialize
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          onResendInvite().catch(() => {});
        }}
        disabled={!policy.canResendInvite}
        className="h-6 text-[10px] px-2 flex-shrink-0"
      >
        {loading.isResendingInvite ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SendHorizontal className="h-3 w-3 mr-0.5" />
        )}
        Invite
      </Button>
      <div className="flex-1" />
      {permissions.canDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDeleteOpen}
          aria-label="Delete recruit"
          className="h-6 text-[10px] px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </>
  );
}

interface SlackActionBarProps {
  policy: RecruitActionPolicy;
  loading: RecruitActionLoading;
  slack: RecruitSlackContext;
  recruit: UserProfile;
  sendingType: "new_recruit" | "npn_received" | null;
  onSendNew: () => void;
  onSendNpn: () => void;
}

function SlackActionBar({
  policy,
  loading,
  slack,
  recruit,
  sendingType,
  onSendNew,
  onSendNpn,
}: SlackActionBarProps) {
  const channelLabel = slack.recruitChannel?.name
    ? `#${slack.recruitChannel.name}`
    : "the recruiting channel";

  return (
    <>
      {policy.showNewRecruitSlack && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={policy.newRecruitSlackDisabled}
                onClick={onSendNew}
                className={cn(
                  "h-6 text-[10px] px-2 flex-shrink-0",
                  slack.notificationStatus?.newRecruitSent &&
                    "text-emerald-600 border-emerald-300",
                )}
              >
                {sendingType === "new_recruit" && loading.isSendingSlack ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : slack.notificationStatus?.newRecruitSent ? (
                  <Check className="h-3 w-3 mr-0.5" />
                ) : (
                  <Hash className="h-3 w-3 mr-0.5" />
                )}
                {slack.notificationStatus?.newRecruitSent
                  ? "Sent"
                  : "Slack: New Recruit"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-[10px]">
                {slack.notificationStatus?.newRecruitSent
                  ? "New recruit notification already sent"
                  : `Post to ${channelLabel}`}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {policy.showNpnSlack && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={policy.npnSlackDisabled}
                onClick={() => {
                  if (!recruit.npn) {
                    toast.error("Set the recruit's NPN first, then post.");
                    return;
                  }
                  onSendNpn();
                }}
                className={cn(
                  "h-6 text-[10px] px-2 flex-shrink-0",
                  slack.notificationStatus?.npnReceivedSent &&
                    "text-emerald-600 border-emerald-300",
                )}
              >
                {sendingType === "npn_received" && loading.isSendingSlack ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : slack.notificationStatus?.npnReceivedSent ? (
                  <Check className="h-3 w-3 mr-0.5" />
                ) : (
                  <Hash className="h-3 w-3 mr-0.5" />
                )}
                {slack.notificationStatus?.npnReceivedSent
                  ? "Sent"
                  : "Slack: NPN"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-[10px]">
                {slack.notificationStatus?.npnReceivedSent
                  ? "NPN received notification already sent"
                  : `Post NPN received to ${channelLabel}`}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecruitActionBar({
  entity,
  permissions,
  recruit,
  hasPipelineProgress,
  currentPhase,
  canRevert,
  slack,
  actions,
  loading,
}: RecruitActionBarProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [sendingNotificationType, setSendingNotificationType] = useState<
    "new_recruit" | "npn_received" | null
  >(null);

  // Dialog open state
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [cancelInviteDialogOpen, setCancelInviteDialogOpen] = useState(false);
  const [graduateDialogOpen, setGraduateDialogOpen] = useState(false);

  if (!permissions.canManage) return null;

  const policy = getRecruitActionPolicy({
    entity,
    currentPhase,
    canRevert,
    hasPipelineProgress,
    recruit,
    slack,
    loading,
  });

  /**
   * Wraps an async action: keeps the dialog open on failure so the user can
   * retry. Dialog is only closed after a successful await.
   */
  async function runAction(
    actionKey: string,
    dialogCloser: () => void,
    fn: () => Promise<void>,
    opts?: { onSuccess?: () => void },
  ): Promise<void> {
    setPendingAction(actionKey);
    try {
      await fn();
      dialogCloser();
      opts?.onSuccess?.();
    } catch {
      // dialog stays open; error toast is fired by the mutation's onError
    } finally {
      setPendingAction(null);
    }
  }

  const isInvitation = entity.kind === "invitation";

  return (
    <>
      <div className="flex flex-col gap-1 mt-2">
        <div className="flex items-center gap-1 flex-wrap">
          {isInvitation ? (
            <InvitationActionBar
              entity={entity}
              policy={policy}
              loading={loading}
              onResendInvite={actions.onResendInvite}
              onCancelClick={() => setCancelInviteDialogOpen(true)}
            />
          ) : (
            <PipelineActionBar
              policy={policy}
              loading={loading}
              permissions={permissions}
              onAdvanceClick={() => setAdvanceDialogOpen(true)}
              onRevertClick={() => setRevertDialogOpen(true)}
              onBlockClick={() => setBlockDialogOpen(true)}
              onUnblockClick={() => setUnblockDialogOpen(true)}
              onUnenroll={actions.onUnenroll}
              onInitialize={actions.onInitialize}
              onResendInvite={actions.onResendInvite}
              onDeleteOpen={actions.onDeleteOpen}
              hasPipelineProgress={hasPipelineProgress}
            />
          )}
        </div>

        {/* Notification buttons — registered recruits only */}
        {!isInvitation && (
          <div className="flex items-center gap-1">
            <SlackActionBar
              policy={policy}
              loading={loading}
              slack={slack}
              recruit={recruit}
              sendingType={sendingNotificationType}
              onSendNew={async () => {
                setSendingNotificationType("new_recruit");
                try {
                  await actions.onSendSlackNotification("new_recruit");
                } catch {
                  // hook's onError fires toast; spinner resets via finally
                } finally {
                  setSendingNotificationType(null);
                }
              }}
              onSendNpn={async () => {
                setSendingNotificationType("npn_received");
                try {
                  await actions.onSendSlackNotification("npn_received");
                } catch {
                  // hook's onError fires toast; spinner resets via finally
                } finally {
                  setSendingNotificationType(null);
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGraduateDialogOpen(true)}
              className="h-6 text-[10px] px-2 text-emerald-600 hover:text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/20 flex-shrink-0"
            >
              <GraduationCap className="h-3 w-3 mr-0.5" />
              Graduate
            </Button>
          </div>
        )}
      </div>

      {/* Graduate to Agent Dialog */}
      {graduateDialogOpen && (
        <GraduateToAgentDialog
          recruit={recruit}
          open={graduateDialogOpen}
          onOpenChange={setGraduateDialogOpen}
        />
      )}

      {/* Advance Phase Confirmation */}
      <AlertDialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Advance Phase
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Advance this recruit to the next phase?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1">
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingAction === "advance"}
              onClick={(e) => {
                e.preventDefault();
                runAction(
                  "advance",
                  () => setAdvanceDialogOpen(false),
                  actions.onAdvancePhase,
                );
              }}
              className="h-7 text-xs"
            >
              {pendingAction === "advance" ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Advance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Phase Dialog (with reason input) */}
      <AlertDialog
        open={blockDialogOpen}
        onOpenChange={(open) => {
          setBlockDialogOpen(open);
          if (!open) setBlockReason("");
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Block Phase</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Provide a reason for blocking this phase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="block-reason" className="text-xs">
              Reason
            </Label>
            <Input
              id="block-reason"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Enter reason for blocking..."
              className="h-8 text-xs mt-1"
              autoFocus
            />
          </div>
          <AlertDialogFooter className="gap-1">
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!blockReason.trim()) return;
                runAction(
                  "block",
                  () => setBlockDialogOpen(false),
                  () => actions.onBlockPhase(blockReason.trim()),
                  { onSuccess: () => setBlockReason("") },
                );
              }}
              disabled={!blockReason.trim() || pendingAction === "block"}
              className="bg-red-600 hover:bg-red-700 h-7 text-xs"
            >
              {pendingAction === "block" ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock Phase Confirmation */}
      <AlertDialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Unblock Phase
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Unblock this phase and resume progress?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1">
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingAction === "unblock"}
              onClick={(e) => {
                e.preventDefault();
                runAction(
                  "unblock",
                  () => setUnblockDialogOpen(false),
                  actions.onUnblockPhase,
                );
              }}
              className="h-7 text-xs"
            >
              {pendingAction === "unblock" ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert Phase Confirmation */}
      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Revert Phase
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Revert this phase back to In Progress? Checklist progress will be
              preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1">
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingAction === "revert"}
              onClick={(e) => {
                e.preventDefault();
                runAction(
                  "revert",
                  () => setRevertDialogOpen(false),
                  actions.onRevertPhase,
                );
              }}
              className="h-7 text-xs"
            >
              {pendingAction === "revert" ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invitation Confirmation */}
      <AlertDialog
        open={cancelInviteDialogOpen}
        onOpenChange={setCancelInviteDialogOpen}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Cancel Invitation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Cancel this invitation? The registration link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1">
            <AlertDialogCancel className="h-7 text-xs">Keep</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingAction === "cancel-invite"}
              onClick={(e) => {
                e.preventDefault();
                runAction(
                  "cancel-invite",
                  () => setCancelInviteDialogOpen(false),
                  actions.onCancelInvitation,
                );
              }}
              className="bg-red-600 hover:bg-red-700 h-7 text-xs"
            >
              {pendingAction === "cancel-invite" ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
