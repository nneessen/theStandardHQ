import { useState } from "react";
import type { UserProfile } from "@/types/hierarchy.types";
import { Button } from "@/components/ui/button";
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

// ─── Hint copy ────────────────────────────────────────────────────────────────
// Plain-language one-liners surfaced as tooltips on every action button.
const HINT = {
  advance:
    "Move this recruit to the next phase. Use when all required items are checked off.",
  revert: "Move back one phase. Audit-logged. Checklist progress is preserved.",
  block:
    "Pause progress and add a reason. The recruit sees the reason on their pipeline page.",
  unblock: "Resume progress on the blocked phase.",
  unenroll:
    "Remove from the current pipeline so you can re-enroll them in a different one.",
  initialize:
    "Enroll this recruit in the active pipeline so they can start checking off steps.",
  invite:
    "Send the welcome / sign-in invitation again. Useful if the original email was missed.",
  resendInvite: "Re-send the invitation email — the existing link stays valid.",
  cancelInvite:
    "Cancel this invitation. The registration link will no longer work.",
  delete:
    "Permanently delete this recruit and all their progress. Cannot be undone.",
  graduate:
    "Promote to a full agent. Sets their NPN, removes the recruit role, audit-logged.",
  slackNew:
    "Post a 'new recruit' announcement to your recruiting Slack channel.",
  slackNpn:
    "Post 'NPN received' to your recruiting Slack channel. Requires NPN to be set first.",
} as const;

const buttonBase =
  "h-7 text-[11px] uppercase tracking-[0.16em] font-semibold px-2.5 flex-shrink-0";

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
      <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-700 dark:text-amber-400">
        {entity.invitationStatus
          ? INVITATION_STATUS_LABELS[entity.invitationStatus]
          : "Pending"}
      </span>
      <ActionTooltip hint={HINT.resendInvite}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onResendInvite().catch(() => {});
          }}
          disabled={!policy.canResendInvite}
          className={buttonBase}
        >
          {loading.isResendingInvite ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <SendHorizontal className="h-3 w-3 mr-1" />
          )}
          Resend
        </Button>
      </ActionTooltip>
      <div className="flex-1" />
      <ActionTooltip hint={HINT.cancelInvite}>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancelClick}
          disabled={!policy.canCancelInvitation}
          className={cn(
            buttonBase,
            "text-red-700 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-950/30",
          )}
        >
          {loading.isCancellingInvitation ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3 mr-1" />
          )}
          Cancel
        </Button>
      </ActionTooltip>
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
          <ActionTooltip hint={HINT.advance}>
            <Button
              size="sm"
              variant="outline"
              onClick={onAdvanceClick}
              disabled={!policy.canAdvance}
              className={buttonBase}
            >
              <ArrowRight className="h-3 w-3 mr-1" />
              Advance
            </Button>
          </ActionTooltip>
          {policy.canRevert && (
            <ActionTooltip hint={HINT.revert}>
              <Button
                size="sm"
                variant="outline"
                onClick={onRevertClick}
                disabled={loading.isReverting}
                className={buttonBase}
              >
                {loading.isReverting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Undo2 className="h-3 w-3 mr-1" />
                )}
                Revert
              </Button>
            </ActionTooltip>
          )}
          {policy.canUnblock ? (
            <ActionTooltip hint={HINT.unblock}>
              <Button
                size="sm"
                variant="default"
                onClick={onUnblockClick}
                className={buttonBase}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Unblock
              </Button>
            </ActionTooltip>
          ) : (
            <ActionTooltip hint={HINT.block}>
              <Button
                size="sm"
                variant="outline"
                onClick={onBlockClick}
                disabled={!policy.canBlock}
                className={buttonBase}
              >
                <Ban className="h-3 w-3 mr-1" />
                Block
              </Button>
            </ActionTooltip>
          )}
          <ActionTooltip hint={HINT.unenroll}>
            <Button
              size="sm"
              variant="ghost"
              onClick={onUnenroll}
              disabled={loading.isUnenrolling}
              className={cn(
                buttonBase,
                "text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30",
              )}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Unenroll
            </Button>
          </ActionTooltip>
        </>
      ) : (
        <ActionTooltip hint={HINT.initialize}>
          <Button
            size="sm"
            variant="outline"
            onClick={onInitialize}
            disabled={loading.isInitializing}
            className={buttonBase}
          >
            {loading.isInitializing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Clock className="h-3 w-3 mr-1" />
            )}
            Initialize
          </Button>
        </ActionTooltip>
      )}
      <ActionTooltip hint={HINT.invite}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onResendInvite().catch(() => {});
          }}
          disabled={!policy.canResendInvite}
          className={buttonBase}
        >
          {loading.isResendingInvite ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <SendHorizontal className="h-3 w-3 mr-1" />
          )}
          Invite
        </Button>
      </ActionTooltip>
      <div className="flex-1" />
      {permissions.canDelete && (
        <ActionTooltip hint={HINT.delete}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDeleteOpen}
            aria-label="Delete recruit"
            className={cn(
              "h-7 px-2 flex-shrink-0 text-red-700 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-950/30",
            )}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </ActionTooltip>
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
  return (
    <>
      {policy.showNewRecruitSlack && (
        <ActionTooltip
          hint={
            slack.notificationStatus?.newRecruitSent
              ? "New-recruit announcement already sent. Click would send again."
              : HINT.slackNew
          }
        >
          <Button
            size="sm"
            variant="outline"
            disabled={policy.newRecruitSlackDisabled}
            onClick={onSendNew}
            className={cn(
              buttonBase,
              slack.notificationStatus?.newRecruitSent &&
                "text-teal-700 border-teal-300 dark:text-teal-400 dark:border-teal-700",
            )}
          >
            {sendingType === "new_recruit" && loading.isSendingSlack ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : slack.notificationStatus?.newRecruitSent ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Hash className="h-3 w-3 mr-1" />
            )}
            {slack.notificationStatus?.newRecruitSent
              ? "Sent"
              : "Slack: new recruit"}
          </Button>
        </ActionTooltip>
      )}
      {policy.showNpnSlack && (
        <ActionTooltip
          hint={
            slack.notificationStatus?.npnReceivedSent
              ? "NPN-received already sent. Click would send again."
              : HINT.slackNpn
          }
        >
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
              buttonBase,
              slack.notificationStatus?.npnReceivedSent &&
                "text-teal-700 border-teal-300 dark:text-teal-400 dark:border-teal-700",
            )}
          >
            {sendingType === "npn_received" && loading.isSendingSlack ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : slack.notificationStatus?.npnReceivedSent ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Hash className="h-3 w-3 mr-1" />
            )}
            {slack.notificationStatus?.npnReceivedSent ? "Sent" : "Slack: NPN"}
          </Button>
        </ActionTooltip>
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
    <TooltipProvider delayDuration={250}>
      <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-v2-ring">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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

        {!isInvitation && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
            <ActionTooltip hint={HINT.graduate}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGraduateDialogOpen(true)}
                className={cn(
                  buttonBase,
                  "text-teal-700 border-teal-300 hover:text-teal-800 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-800 dark:hover:bg-teal-950/30",
                )}
              >
                <GraduationCap className="h-3 w-3 mr-1" />
                Graduate
              </Button>
            </ActionTooltip>
          </div>
        )}
      </div>

      {graduateDialogOpen && (
        <GraduateToAgentDialog
          recruit={recruit}
          open={graduateDialogOpen}
          onOpenChange={setGraduateDialogOpen}
        />
      )}

      <AlertDialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Advance phase
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs italic">
              Move this recruit to the next phase. They will see the new phase
              on their pipeline page immediately.
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

      <AlertDialog
        open={blockDialogOpen}
        onOpenChange={(open) => {
          setBlockDialogOpen(open);
          if (!open) setBlockReason("");
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Block phase</AlertDialogTitle>
            <AlertDialogDescription className="text-xs italic">
              The recruit sees this reason on their pipeline page. Be specific —
              they need to know what to do to unblock.
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
              placeholder="e.g. Background-check application missing on file"
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

      <AlertDialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Unblock phase
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs italic">
              Clears the block reason and resumes progress. The recruit can keep
              checking off items.
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

      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Revert phase
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs italic">
              Move back one phase. Checklist progress on the current phase is
              preserved. This is audit-logged.
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

      <AlertDialog
        open={cancelInviteDialogOpen}
        onOpenChange={setCancelInviteDialogOpen}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Cancel invitation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs italic">
              The registration link will stop working. You can always send a new
              invite later.
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
              Cancel invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

interface ActionTooltipProps {
  hint: string;
  children: React.ReactNode;
}

function ActionTooltip({ hint, children }: ActionTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-[260px] text-[11px] leading-relaxed"
      >
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
