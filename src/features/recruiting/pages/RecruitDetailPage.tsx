// src/features/recruiting/pages/RecruitDetailPage.tsx
// Full-page recruit detail. Custom chrome AND custom interaction surfaces —
// no RecruitActionBar, no PhaseStepper, no tabbed shell. Stacked sections
// with new visual treatment.

import { useState, useMemo } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Mail,
  Circle,
  RotateCcw,
  Activity as ActivityIcon,
  FolderOpen,
  ListChecks,
  Phone,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Hash,
  Send,
  Trash2,
  Lock,
  Unlock,
  Undo2,
  PlayCircle,
  XCircle,
  Check,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  useRecruitById,
  usePendingInvitations,
  useUpdateRecruit,
  useCancelInvitation,
  useResendInvitation,
} from "../hooks";
import {
  useRecruitPhaseProgress,
  useCurrentPhase,
  useChecklistProgress,
  useAdvancePhase,
  useBlockPhase,
  useRevertPhase,
  useUpdatePhaseStatus,
  useInitializeRecruitProgress,
  useUnenrollFromPipeline,
} from "../hooks/useRecruitProgress";
import { useTemplate, useActiveTemplate } from "../hooks/usePipeline";
import { useCurrentUserProfile } from "@/hooks/admin";
import { useRecruitDocuments } from "../hooks/useRecruitDocuments";
import { useRecruitEmails } from "../hooks/useRecruitEmails";
import { useRecruitActivityLog } from "../hooks/useRecruitActivity";
import { useResendInvite } from "../hooks/useAuthUser";
import {
  useSlackIntegrations,
  useSlackChannelsById,
  useRecruitNotificationStatus,
  useSendRecruitSlackNotification,
  findRecruitIntegration,
  findRecruitChannel,
  buildNewRecruitMessage,
  buildNpnReceivedMessage,
} from "@/hooks/slack";
import { STAFF_ONLY_ROLES } from "@/constants/roles";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { PhaseChecklist } from "../components/PhaseChecklist";
import { DocumentManager } from "../components/DocumentManager";
import { EmailManager } from "../components/EmailManager";
import { ActivityTab } from "../components/ActivityTab";
import { DeleteRecruitDialogOptimized } from "../components/DeleteRecruitDialog.optimized";
import { InitializePipelineDialog } from "../components/InitializePipelineDialog";
import { getRecruitActionPolicy } from "../utils/recruit-action-policy";

import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { UserProfile } from "@/types/hierarchy.types";
import type {
  PipelinePhase,
  PhaseChecklistItem,
  InvitationStatus,
} from "@/types/recruiting.types";
import type { RecruitEntity } from "../types/recruit-detail.types";

type PhaseWithChecklist = PipelinePhase & {
  checklist_items: PhaseChecklistItem[];
};

export function RecruitDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recruitId } = useParams({ from: "/recruiting/$recruitId" });

  // ─── Invitation resolution ────────────────────────────────────────
  const isInvitationId = recruitId.startsWith("invitation-");
  const invitationId = isInvitationId
    ? recruitId.slice("invitation-".length)
    : null;

  const {
    data: realRecruit,
    isLoading: realLoading,
    error: realError,
  } = useRecruitById(isInvitationId ? "" : recruitId);

  const { data: pendingInvitations = [], isLoading: invitationsLoading } =
    usePendingInvitations();

  const invitation = useMemo(
    () =>
      isInvitationId
        ? pendingInvitations.find((inv) => inv.id === invitationId)
        : null,
    [isInvitationId, invitationId, pendingInvitations],
  );

  const syntheticInvitationRecruit = useMemo<UserProfile | null>(() => {
    if (!isInvitationId || !invitation) return null;
    return {
      id: `invitation-${invitation.id}`,
      email: invitation.email,
      first_name: invitation.first_name || null,
      last_name: invitation.last_name || null,
      phone: invitation.phone || null,
      city: invitation.city || null,
      state: invitation.state || null,
      onboarding_status: "invited",
      created_at: invitation.created_at,
      updated_at: invitation.updated_at,
      is_invitation: true,
      invitation_id: invitation.id,
      invitation_status: invitation.status,
      invitation_sent_at: invitation.sent_at,
      recruiter_id: invitation.inviter_id,
      upline_id: invitation.upline_id || invitation.inviter_id,
      roles: ["recruit"],
      is_admin: false,
      imo_id: user?.imo_id || null,
      agency_id: user?.agency_id || null,
    } as unknown as UserProfile;
  }, [isInvitationId, invitation, user?.imo_id, user?.agency_id]);

  const recruit: UserProfile | null | undefined = isInvitationId
    ? syntheticInvitationRecruit
    : realRecruit;
  const baseLoading = isInvitationId ? invitationsLoading : realLoading;
  const baseError = isInvitationId
    ? !invitationsLoading && !invitation
      ? new Error("Invitation not found")
      : null
    : realError;

  const goBack = () => navigate({ to: "/recruiting" });

  // ─── Page state ───────────────────────────────────────────────────
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [initializeDialogOpen, setInitializeDialogOpen] = useState(false);
  const [unenrollDialogOpen, setUnenrollDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [slackSendingType, setSlackSendingType] = useState<
    "new_recruit" | "npn_received" | null
  >(null);

  // ─── Entity ───────────────────────────────────────────────────────
  const isInvitation = recruit?.id?.startsWith("invitation-") ?? false;
  const entity: RecruitEntity = useMemo(() => {
    if (!recruit) {
      return { kind: "registered", recruit: {} as UserProfile, recruitId: "" };
    }
    if (isInvitation) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- synthetic invitation fields
      const r = recruit as any;
      return {
        kind: "invitation",
        recruit,
        invitationId: r?.invitation_id ?? "",
        invitationStatus:
          (r.invitation_status as InvitationStatus) ?? "pending",
      };
    }
    return { kind: "registered", recruit, recruitId: recruit.id };
  }, [recruit, isInvitation]);

  const { data: currentUserProfile } = useCurrentUserProfile();
  const hasStaffRole =
    currentUserProfile?.roles?.some((role) =>
      STAFF_ONLY_ROLES.includes(role as (typeof STAFF_ONLY_ROLES)[number]),
    ) || false;
  const isStaff = currentUserProfile?.is_admin || hasStaffRole || false;

  const recruitIdForQueries = isInvitation || !recruit ? undefined : recruit.id;

  // ─── Pipeline hooks ───────────────────────────────────────────────
  const {
    data: phaseProgress,
    isLoading: progressLoading,
    error: progressError,
  } = useRecruitPhaseProgress(recruitIdForQueries);
  const {
    data: currentPhase,
    isLoading: currentPhaseLoading,
    error: currentPhaseError,
  } = useCurrentPhase(recruitIdForQueries);

  const recruitTemplateId = isInvitation
    ? null
    : phaseProgress?.[0]?.template_id || recruit?.pipeline_template_id || null;
  const { data: recruitTemplate, isLoading: recruitTemplateLoading } =
    useTemplate(recruitTemplateId ?? undefined);
  const { data: defaultTemplate, isLoading: defaultTemplateLoading } =
    useActiveTemplate();
  const template = recruitTemplateId ? recruitTemplate : defaultTemplate;
  const templateLoading = recruitTemplateId
    ? recruitTemplateLoading
    : defaultTemplateLoading;

  // ─── Tab data (now all loaded since page renders all sections) ────
  const { data: checklistProgress } = useChecklistProgress(
    recruitIdForQueries,
    selectedPhaseId || currentPhase?.phase_id,
  );
  const { data: documents } = useRecruitDocuments(recruitIdForQueries);
  const { data: emails } = useRecruitEmails(recruitIdForQueries);
  const {
    data: activityLog,
    isLoading: activityLoading,
    error: activityError,
  } = useRecruitActivityLog(recruitIdForQueries);

  // ─── Mutations ────────────────────────────────────────────────────
  const advancePhase = useAdvancePhase();
  const blockPhase = useBlockPhase();
  const revertPhase = useRevertPhase();
  const updatePhaseStatus = useUpdatePhaseStatus();
  const initializeProgress = useInitializeRecruitProgress();
  const unenrollPipeline = useUnenrollFromPipeline();
  const cancelInvitation = useCancelInvitation();
  const resendInvite = useResendInvite();
  const resendInvitation = useResendInvitation();
  const updateRecruit = useUpdateRecruit();

  // ─── Slack ────────────────────────────────────────────────────────
  const { data: slackIntegrations = [] } = useSlackIntegrations();
  const recruitIntegration = findRecruitIntegration(slackIntegrations);
  const { data: slackChannels = [] } = useSlackChannelsById(
    recruitIntegration?.id,
  );
  const recruitChannel = findRecruitChannel(recruitIntegration, slackChannels);
  const { data: notificationStatus } =
    useRecruitNotificationStatus(recruitIdForQueries);
  const sendSlackNotification = useSendRecruitSlackNotification();

  // ─── Derived ──────────────────────────────────────────────────────
  const phases: PhaseWithChecklist[] = useMemo(
    () => (template?.phases || []) as PhaseWithChecklist[],
    [template?.phases],
  );
  const sortedPhases = useMemo(
    () => [...phases].sort((a, b) => a.phase_order - b.phase_order),
    [phases],
  );
  const progressMap = useMemo(
    () => new Map(phaseProgress?.map((p) => [p.phase_id, p]) || []),
    [phaseProgress],
  );
  const completedCount =
    phaseProgress?.filter((p) => p.status === "completed").length || 0;
  const hasPipelineProgress = phaseProgress && phaseProgress.length > 0;

  const viewingPhaseId = selectedPhaseId || currentPhase?.phase_id;
  const viewingPhase = sortedPhases.find((p) => p.id === viewingPhaseId);
  const viewingChecklistItems = viewingPhase?.checklist_items || [];
  const viewingPhaseProgress = viewingPhaseId
    ? progressMap.get(viewingPhaseId)
    : null;
  const canRevertViewingPhase = viewingPhaseProgress?.status === "completed";
  const hasCompletedPhaseBefore = useMemo(() => {
    const currentIndex = sortedPhases.findIndex(
      (p) => p.id === currentPhase?.phase_id,
    );
    if (currentIndex <= 0) return false;
    for (let i = currentIndex - 1; i >= 0; i--) {
      const progress = progressMap.get(sortedPhases[i].id);
      if (progress?.status === "completed") return true;
    }
    return false;
  }, [sortedPhases, currentPhase?.phase_id, progressMap]);
  const canRevert = canRevertViewingPhase || hasCompletedPhaseBefore;

  const policy = useMemo(
    () =>
      recruit
        ? getRecruitActionPolicy({
            entity,
            currentPhase,
            canRevert,
            hasPipelineProgress: !!hasPipelineProgress,
            recruit,
            slack: {
              recruitIntegration,
              recruitChannel,
              imoId: currentUserProfile?.imo_id ?? null,
              notificationStatus,
            },
            loading: {
              isAdvancing: advancePhase.isPending,
              isReverting: revertPhase.isPending,
              isInitializing: initializeProgress.isPending,
              isUnenrolling: unenrollPipeline.isPending,
              isResendingInvite:
                resendInvite.isPending || resendInvitation.isPending,
              isCancellingInvitation: cancelInvitation.isPending,
              isSendingSlack: sendSlackNotification.isPending,
            },
          })
        : null,
    [
      entity,
      currentPhase,
      canRevert,
      hasPipelineProgress,
      recruit,
      recruitIntegration,
      recruitChannel,
      currentUserProfile?.imo_id,
      notificationStatus,
      advancePhase.isPending,
      revertPhase.isPending,
      initializeProgress.isPending,
      unenrollPipeline.isPending,
      resendInvite.isPending,
      resendInvitation.isPending,
      cancelInvitation.isPending,
      sendSlackNotification.isPending,
    ],
  );

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleAdvancePhase = async () => {
    if (!currentPhase || !recruit) return;
    await advancePhase.mutateAsync({
      userId: recruit.id,
      currentPhaseId: currentPhase.phase_id,
    });
  };

  const handleBlockPhase = async () => {
    if (!currentPhase || !recruit) return;
    await blockPhase.mutateAsync({
      userId: recruit.id,
      phaseId: currentPhase.phase_id,
      reason: blockReason || "Blocked",
    });
    setBlockDialogOpen(false);
    setBlockReason("");
  };

  const handleUnblockPhase = async () => {
    if (!currentPhase || !recruit) return;
    await updatePhaseStatus.mutateAsync({
      userId: recruit.id,
      phaseId: currentPhase.phase_id,
      status: "in_progress",
      notes: "Unblocked",
    });
  };

  const handleRevertPhase = async () => {
    if (!recruit) return;
    const phaseToRevert = viewingPhaseId
      ? progressMap.get(viewingPhaseId)
      : null;
    if (phaseToRevert?.status === "completed") {
      await revertPhase.mutateAsync({
        userId: recruit.id,
        phaseId: viewingPhaseId!,
      });
      return;
    }
    const currentIndex = sortedPhases.findIndex(
      (p) => p.id === currentPhase?.phase_id,
    );
    if (currentIndex <= 0) return;
    for (let i = currentIndex - 1; i >= 0; i--) {
      const phase = sortedPhases[i];
      const progress = progressMap.get(phase.id);
      if (progress?.status === "completed") {
        await revertPhase.mutateAsync({
          userId: recruit.id,
          phaseId: phase.id,
        });
        return;
      }
    }
  };

  const handlePhasePillClick = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
  };

  const handleResendInvite = async () => {
    if (!recruit?.email) return;
    // Invitations (no auth.user yet) need a fresh registration token via
    // recruitInvitationService.resendInvitation, which also re-fires the
    // invite email. Password-reset would 404 since there's no auth user.
    if (entity.kind === "invitation" && entity.invitationId) {
      const displayName =
        `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim() ||
        undefined;
      await resendInvitation.mutateAsync({
        invitationId: entity.invitationId,
        email: recruit.email,
        recruitName: displayName,
      });
      return;
    }
    // Registered recruits already have an auth user — send a password-reset.
    await resendInvite.mutateAsync({
      email: recruit.email,
      fullName: `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim(),
      roles: (recruit.roles as string[]) || ["recruit"],
      existingProfileId: recruit.id,
    });
  };

  const handleCancelInvitation = async () => {
    if (entity.kind !== "invitation" || !entity.invitationId) return;
    await cancelInvitation.mutateAsync(entity.invitationId);
    goBack();
  };

  const handleConfirmInitialize = async (templateId: string) => {
    if (!recruit) return;
    try {
      await initializeProgress.mutateAsync({
        userId: recruit.id,
        templateId,
      });
    } finally {
      setInitializeDialogOpen(false);
    }
  };

  const handleUnenroll = async () => {
    if (!recruit) return;
    try {
      await unenrollPipeline.mutateAsync({ userId: recruit.id });
      toast.success("Recruit unenrolled from pipeline");
      setUnenrollDialogOpen(false);
      setSelectedPhaseId(null);
    } catch (error) {
      toast.error("Failed to unenroll recruit");
      console.error("[RecruitDetailPage] Unenroll failed:", error);
    }
  };

  const handleSendSlackNotification = async (
    notificationType: "new_recruit" | "npn_received",
  ) => {
    if (!recruit) return;
    if (notificationType === "npn_received" && !recruit.npn) {
      toast.error("Set the recruit's NPN first, then post.");
      return;
    }
    if (!recruitIntegration || !currentUserProfile?.imo_id) {
      toast.error("No connected Slack workspace for your IMO.");
      return;
    }
    if (!recruitChannel) {
      toast.error(
        "No recruit channel found. Open Settings → Integrations → Slack to pick one.",
      );
      return;
    }
    setSlackSendingType(notificationType);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upline = (recruit as any).upline as
        | { first_name?: string; last_name?: string; email?: string }
        | undefined;
      const uplineName =
        upline?.first_name && upline?.last_name
          ? `${upline.first_name} ${upline.last_name}`
          : upline?.email || null;
      const recruitWithUpline = { ...recruit, upline_name: uplineName };
      const msg =
        notificationType === "new_recruit"
          ? buildNewRecruitMessage(recruitWithUpline)
          : buildNpnReceivedMessage(recruitWithUpline);
      await sendSlackNotification.mutateAsync({
        integrationId: recruitIntegration.id,
        channelId: recruitChannel.id,
        text: msg.text,
        blocks: msg.blocks,
        notificationType,
        recruitId: recruit.id,
        imoId: currentUserProfile.imo_id!,
      });
    } finally {
      setSlackSendingType(null);
    }
  };

  // ─── Page-level loading + error ───────────────────────────────────
  if (baseLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-3" />
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
          Loading recruit…
        </p>
      </div>
    );
  }

  if (baseError || !recruit) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-[12px] text-muted-foreground">
          {baseError
            ? `Couldn't load recruit: ${baseError.message}`
            : "Recruit not found."}
        </p>
        <Button variant="outline" size="sm" onClick={goBack} className="h-7">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Recruiting
        </Button>
      </div>
    );
  }

  if (progressLoading || currentPhaseLoading || templateLoading) {
    return (
      <div className="p-4 space-y-3 max-w-[1400px] mx-auto">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (progressError || currentPhaseError) {
    return (
      <div className="p-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-destructive font-medium mb-1">
          Failed to load pipeline data
        </p>
        <p className="text-xs text-muted-foreground">
          {(progressError || currentPhaseError)?.message || "Unknown error"}
        </p>
      </div>
    );
  }

  // ─── Derived display ──────────────────────────────────────────────
  const displayName =
    recruit.first_name && recruit.last_name
      ? `${recruit.first_name} ${recruit.last_name}`
      : recruit.email || "Recruit";
  const initials = (
    recruit.first_name && recruit.last_name
      ? `${recruit.first_name[0]}${recruit.last_name[0]}`
      : (recruit.email?.substring(0, 2) ?? "??")
  ).toUpperCase();

  const totalPhases = sortedPhases.length;
  const completionPct = totalPhases
    ? Math.round((completedCount / totalPhases) * 100)
    : 0;
  const daysInPipeline = recruit.created_at
    ? Math.floor(
        (Date.now() - new Date(recruit.created_at).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;
  const currentPhaseObj = sortedPhases.find(
    (p) => p.id === currentPhase?.phase_id,
  );
  const isCurrentPhaseBlocked = currentPhase?.status === "blocked";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruiter = (recruit as any).recruiter as
    | { first_name?: string; last_name?: string; email?: string }
    | undefined;
  const recruiterName = recruiter?.first_name
    ? `${recruiter.first_name} ${recruiter.last_name ?? ""}`.trim()
    : (recruiter?.email ?? "—");

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Top breadcrumb */}
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Recruiting
        </button>

        {/* HERO — two-column: identity left, stats right */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 sm:gap-4">
          {/* Identity card */}
          <div className="rounded-xl bg-card border border-border p-5 sm:p-6 flex items-start gap-5">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-warning/30 via-warning/10 to-transparent blur" />
              <Avatar className="relative h-20 w-20 ring-2 ring-background">
                <AvatarImage src={recruit.profile_photo_url || undefined} />
                <AvatarFallback className="text-xl font-semibold bg-muted">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">
                  {displayName}
                </h1>
                <StatusBadge
                  isInvitation={isInvitation}
                  status={recruit.onboarding_status}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
                {recruit.email && (
                  <a
                    href={`mailto:${recruit.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {recruit.email}
                  </a>
                )}
                {recruit.phone && (
                  <a
                    href={`tel:${recruit.phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors font-mono tabular-nums"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {recruit.phone}
                  </a>
                )}
                {recruit.created_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined{" "}
                    {formatDistanceToNow(new Date(recruit.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
              {!isInvitation && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
                    NPN
                  </span>
                  <NpnInline
                    currentNpn={
                      (recruit as unknown as { npn?: string | null }).npn ??
                      null
                    }
                    saving={updateRecruit.isPending}
                    onSave={async (npn) => {
                      await updateRecruit.mutateAsync({
                        id: recruit.id,
                        updates: { npn: npn || null },
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stats panel */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/40">
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                At a glance
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <StatCell
                label="Pipeline progress"
                value={
                  isInvitation
                    ? "—"
                    : totalPhases
                      ? `${completedCount}/${totalPhases}`
                      : "—"
                }
                hint={`${completionPct}% complete`}
              />
              <StatCell
                label="Days active"
                value={daysInPipeline.toString()}
                hint="Since joined"
              />
              <StatCell
                label="Current phase"
                value={
                  isInvitation
                    ? "Invited"
                    : (currentPhaseObj?.phase_name ?? "—")
                }
                hint={
                  isCurrentPhaseBlocked
                    ? "BLOCKED"
                    : isInvitation
                      ? "Awaiting signup"
                      : currentPhase
                        ? "In progress"
                        : "Not started"
                }
                hintTone={isCurrentPhaseBlocked ? "destructive" : "muted"}
              />
              <StatCell
                label="Recruiter"
                value={recruiterName.split(" ")[0] ?? "—"}
                hint={recruiterName}
              />
            </div>
          </div>
        </section>

        {/* ACTIONS — grouped by purpose, custom buttons */}
        {policy && (
          <section className="rounded-xl bg-card border border-border p-4 sm:p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-foreground">
                Actions
              </h2>
              <span className="text-[10px] text-muted-foreground">
                {entity.kind === "invitation"
                  ? "Pre-registration"
                  : `Phase ${completedCount + (currentPhase ? 1 : 0)}/${totalPhases || 0}`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pipeline group */}
              {entity.kind === "registered" && (
                <ActionGroup label="Pipeline">
                  {!hasPipelineProgress ? (
                    <BigButton
                      icon={<PlayCircle className="h-4 w-4" />}
                      tone="primary"
                      onClick={() => setInitializeDialogOpen(true)}
                      loading={initializeProgress.isPending}
                    >
                      Initialize Pipeline
                    </BigButton>
                  ) : (
                    <>
                      <BigButton
                        icon={<ArrowRight className="h-4 w-4" />}
                        tone="primary"
                        disabled={!policy.canAdvance}
                        loading={advancePhase.isPending}
                        onClick={handleAdvancePhase}
                      >
                        Advance Phase
                      </BigButton>
                      {policy.canUnblock ? (
                        <BigButton
                          icon={<Unlock className="h-4 w-4" />}
                          tone="warning"
                          loading={updatePhaseStatus.isPending}
                          onClick={handleUnblockPhase}
                        >
                          Unblock
                        </BigButton>
                      ) : (
                        <BigButton
                          icon={<Lock className="h-4 w-4" />}
                          tone="muted"
                          disabled={!policy.canBlock}
                          onClick={() => setBlockDialogOpen(true)}
                        >
                          Block
                        </BigButton>
                      )}
                      <BigButton
                        icon={<Undo2 className="h-4 w-4" />}
                        tone="muted"
                        disabled={!policy.canRevert}
                        loading={revertPhase.isPending}
                        onClick={handleRevertPhase}
                      >
                        Revert
                      </BigButton>
                    </>
                  )}
                </ActionGroup>
              )}

              {/* Invitation group */}
              {entity.kind === "invitation" && (
                <ActionGroup label="Invitation">
                  <BigButton
                    icon={<Send className="h-4 w-4" />}
                    tone="primary"
                    loading={
                      resendInvite.isPending || resendInvitation.isPending
                    }
                    onClick={handleResendInvite}
                  >
                    Resend Invite
                  </BigButton>
                  <BigButton
                    icon={<XCircle className="h-4 w-4" />}
                    tone="destructive"
                    loading={cancelInvitation.isPending}
                    disabled={!policy.canCancelInvitation}
                    onClick={handleCancelInvitation}
                  >
                    Cancel Invitation
                  </BigButton>
                </ActionGroup>
              )}

              {/* Communications group */}
              {entity.kind === "registered" && (
                <ActionGroup label="Communications">
                  <BigButton
                    icon={
                      notificationStatus?.newRecruitSent ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Hash className="h-4 w-4" />
                      )
                    }
                    tone={
                      notificationStatus?.newRecruitSent ? "success" : "muted"
                    }
                    disabled={policy.newRecruitSlackDisabled}
                    loading={
                      slackSendingType === "new_recruit" &&
                      sendSlackNotification.isPending
                    }
                    onClick={() => handleSendSlackNotification("new_recruit")}
                  >
                    {notificationStatus?.newRecruitSent
                      ? "Slack: New (sent)"
                      : "Slack: New recruit"}
                  </BigButton>
                  <BigButton
                    icon={
                      notificationStatus?.npnReceivedSent ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Hash className="h-4 w-4" />
                      )
                    }
                    tone={
                      notificationStatus?.npnReceivedSent ? "success" : "muted"
                    }
                    disabled={policy.npnSlackDisabled}
                    loading={
                      slackSendingType === "npn_received" &&
                      sendSlackNotification.isPending
                    }
                    onClick={() => handleSendSlackNotification("npn_received")}
                  >
                    {notificationStatus?.npnReceivedSent
                      ? "Slack: NPN (sent)"
                      : "Slack: NPN"}
                  </BigButton>
                </ActionGroup>
              )}

              {/* Admin group — only render for registered recruits.
                  Invitation deletion lives in the Invitation group (Cancel Invitation)
                  because the synthetic `invitation-<id>` is NOT a real UUID and
                  admin_deleteuser would reject it. */}
              {entity.kind === "registered" && (
                <ActionGroup label="Admin">
                  {policy.canUnenroll && (
                    <BigButton
                      icon={<RotateCcw className="h-4 w-4" />}
                      tone="muted"
                      onClick={() => setUnenrollDialogOpen(true)}
                    >
                      Unenroll from Pipeline
                    </BigButton>
                  )}
                  <BigButton
                    icon={<Trash2 className="h-4 w-4" />}
                    tone="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Delete Recruit
                  </BigButton>
                </ActionGroup>
              )}
            </div>
          </section>
        )}

        {/* PHASE PROGRESS — custom horizontal flow */}
        {!isInvitation && hasPipelineProgress && sortedPhases.length > 0 && (
          <section className="rounded-xl bg-card border border-border p-4 sm:p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-foreground">
                Pipeline progress
              </h2>
              <span className="text-[10px] text-muted-foreground">
                {completedCount} of {totalPhases} phases complete
              </span>
            </div>
            <PhaseFlow
              phases={sortedPhases}
              progressMap={progressMap}
              currentPhaseId={currentPhase?.phase_id}
              viewingPhaseId={viewingPhaseId}
              onPhaseClick={handlePhasePillClick}
            />
          </section>
        )}

        {!isInvitation && !hasPipelineProgress && (
          <section className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
            <Circle className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
            <p className="text-[13px] font-medium text-foreground mb-1">
              Pipeline not initialized
            </p>
            <p className="text-[11px] text-muted-foreground mb-4 max-w-md mx-auto">
              Pick a pipeline template above to start tracking this
              recruit&apos;s progress.
            </p>
          </section>
        )}

        {isInvitation && (
          <section className="rounded-xl border border-warning/30 bg-warning/5 px-6 py-8 text-center">
            <Mail className="h-9 w-9 text-warning mx-auto mb-3" />
            <p className="text-[13px] font-semibold text-foreground mb-1">
              Awaiting registration
            </p>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
              {displayName} has been invited but hasn&apos;t completed their
              registration form yet. Resend or cancel the invitation above.
            </p>
          </section>
        )}

        {/* SECTIONS — stacked, no tabs */}
        {!isInvitation && hasPipelineProgress && (
          <SectionCard
            icon={<ListChecks className="h-4 w-4" />}
            title="Tasks"
            subtitle={
              viewingPhase
                ? `${viewingPhase.phase_name} · ${viewingChecklistItems.length} item${viewingChecklistItems.length === 1 ? "" : "s"}`
                : "Current phase"
            }
          >
            {viewingChecklistItems.length > 0 ? (
              <PhaseChecklist
                userId={recruit.id}
                checklistItems={viewingChecklistItems}
                checklistProgress={checklistProgress || []}
                isUpline={true}
                currentUserId={user?.id}
                currentPhaseId={currentPhase?.phase_id}
                viewedPhaseId={viewingPhaseId}
                isAdmin={isStaff}
                onPhaseComplete={() => {}}
                recruitEmail={recruit.email || ""}
                recruitName={displayName}
                documents={documents || []}
              />
            ) : (
              <EmptySectionState
                icon={<ListChecks className="h-7 w-7" />}
                message="No tasks defined for this phase."
              />
            )}
          </SectionCard>
        )}

        {!isInvitation && (
          <SectionCard
            icon={<FolderOpen className="h-4 w-4" />}
            title="Documents"
            subtitle={`${(documents || []).length} file${(documents || []).length === 1 ? "" : "s"}`}
          >
            <DocumentManager
              userId={recruit.id}
              documents={documents}
              isUpline={true}
              currentUserId={user?.id}
            />
          </SectionCard>
        )}

        {!isInvitation && (
          <SectionCard
            icon={<Mail className="h-4 w-4" />}
            title="Email history"
            subtitle={`${(emails || []).length} sent`}
          >
            <EmailManager
              recruitId={recruit.id}
              recruitEmail={recruit.email}
              recruitName={displayName}
              emails={emails}
              isUpline={true}
              currentUserId={user?.id}
            />
          </SectionCard>
        )}

        {!isInvitation && (
          <SectionCard
            icon={<ActivityIcon className="h-4 w-4" />}
            title="Activity log"
            subtitle="Recent events"
          >
            <ActivityTab
              activityLog={activityLog}
              isLoading={activityLoading}
              error={activityError}
            />
          </SectionCard>
        )}
      </div>

      {/* Dialogs */}
      <DeleteRecruitDialogOptimized
        recruit={recruit}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={goBack}
      />

      <InitializePipelineDialog
        open={initializeDialogOpen}
        onOpenChange={setInitializeDialogOpen}
        onConfirm={handleConfirmInitialize}
        isLoading={initializeProgress.isPending}
      />

      <AlertDialog
        open={unenrollDialogOpen}
        onOpenChange={setUnenrollDialogOpen}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-1 text-sm">
              <AlertTriangle className="h-3 w-3 text-warning" />
              Unenroll from Pipeline
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will remove all pipeline progress for{" "}
              <span className="font-medium">{displayName}</span>. They can be
              re-enrolled in a different pipeline afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1">
            <AlertDialogCancel
              disabled={unenrollPipeline.isPending}
              className="h-7 text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              disabled={unenrollPipeline.isPending}
              className="bg-warning hover:bg-warning h-7 text-xs"
            >
              {unenrollPipeline.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Unenrolling…
                </>
              ) : (
                <>
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Unenroll
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-warning" />
              Block current phase
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Pipeline progress will pause until unblocked. Add a reason so it
              shows up in the activity log.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              autoFocus
              placeholder="Reason (e.g., waiting on contract signature)"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="text-[12px] min-h-[90px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBlockDialogOpen(false)}
              disabled={blockPhase.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBlockPhase}
              disabled={blockPhase.isPending}
              className="bg-warning hover:bg-warning text-warning-foreground"
            >
              {blockPhase.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5 mr-1.5" />
              )}
              Block phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function StatusBadge({
  isInvitation,
  status,
}: {
  isInvitation: boolean;
  status: string | null | undefined;
}) {
  const label = isInvitation
    ? "Invited"
    : (status || "active").replace(/_/g, " ");
  const tone: "warning" | "success" | "destructive" | "muted" | "info" =
    isInvitation
      ? "warning"
      : status === "completed"
        ? "success"
        : status === "dropped" || status === "withdrawn"
          ? "destructive"
          : status === "blocked"
            ? "destructive"
            : status === "active"
              ? "info"
              : "muted";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] uppercase tracking-[0.16em] font-bold px-2 py-0.5",
        tone === "warning" && "bg-warning/10 text-warning border-warning/40",
        tone === "success" && "bg-success/10 text-success border-success/40",
        tone === "destructive" &&
          "bg-destructive/10 text-destructive border-destructive/40",
        tone === "info" && "bg-info/10 text-info border-info/40",
        tone === "muted" && "bg-muted text-foreground border-border",
      )}
    >
      {label}
    </Badge>
  );
}

function StatCell({
  label,
  value,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "muted" | "destructive";
}) {
  return (
    <div className="px-4 py-3 first:border-l-0 first:border-t-0">
      <div className="text-[9px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold tracking-tight text-foreground truncate">
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            "mt-0.5 text-[10px] truncate",
            hintTone === "destructive"
              ? "text-destructive font-semibold uppercase tracking-[0.18em]"
              : "text-muted-foreground",
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function ActionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[9px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function BigButton({
  icon,
  tone,
  onClick,
  disabled,
  loading,
  children,
}: {
  icon: React.ReactNode;
  tone: "primary" | "success" | "warning" | "destructive" | "muted";
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "w-full inline-flex items-center justify-between gap-2 px-3 h-10 rounded-lg border text-[12px] font-medium transition-all",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        tone === "primary" &&
          "bg-foreground text-background border-foreground hover:bg-foreground/90 disabled:hover:bg-foreground",
        tone === "success" &&
          "bg-success/10 text-success border-success/40 hover:bg-success/15",
        tone === "warning" &&
          "bg-warning/10 text-warning border-warning/40 hover:bg-warning/15",
        tone === "destructive" &&
          "bg-card text-destructive border-destructive/40 hover:bg-destructive/10",
        tone === "muted" &&
          "bg-card text-foreground border-border hover:bg-muted",
      )}
    >
      <span className="inline-flex items-center gap-2 min-w-0 truncate">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          <span className="shrink-0">{icon}</span>
        )}
        <span className="truncate">{children}</span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </button>
  );
}

function PhaseFlow({
  phases,
  progressMap,
  currentPhaseId,
  viewingPhaseId,
  onPhaseClick,
}: {
  phases: PhaseWithChecklist[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  progressMap: Map<string, any>;
  currentPhaseId?: string;
  viewingPhaseId?: string;
  onPhaseClick: (phaseId: string) => void;
}) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {phases.map((phase, idx) => {
        const progress = progressMap.get(phase.id);
        const status = progress?.status as string | undefined;
        const isCurrent = phase.id === currentPhaseId;
        const isViewing = phase.id === viewingPhaseId;
        const isCompleted = status === "completed";
        const isBlocked = status === "blocked";
        const isInProgress = status === "in_progress" || isCurrent;

        return (
          <button
            key={phase.id}
            type="button"
            onClick={() => onPhaseClick(phase.id)}
            className={cn(
              "group relative flex-1 min-w-[140px] rounded-lg border px-3 py-2.5 text-left transition-all",
              isViewing
                ? "ring-2 ring-foreground/20 border-foreground"
                : "hover:border-foreground/40",
              isCompleted &&
                "bg-success/5 border-success/40 text-success-foreground",
              isBlocked && "bg-destructive/5 border-destructive/40",
              isInProgress &&
                !isCompleted &&
                !isBlocked &&
                "bg-info/5 border-info/40",
              !isCompleted &&
                !isBlocked &&
                !isInProgress &&
                "bg-muted/40 border-border",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono tabular-nums font-semibold ring-1",
                  isCompleted &&
                    "bg-success text-success-foreground ring-success",
                  isBlocked &&
                    "bg-destructive text-destructive-foreground ring-destructive",
                  isInProgress &&
                    !isCompleted &&
                    !isBlocked &&
                    "bg-info text-info-foreground ring-info",
                  !isCompleted &&
                    !isBlocked &&
                    !isInProgress &&
                    "bg-muted text-muted-foreground ring-border",
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : isBlocked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  idx + 1
                )}
              </span>
              {isCurrent && !isCompleted && !isBlocked && (
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase tracking-[0.16em] font-bold px-1.5 py-0 h-4 bg-info/10 text-info border-info/40"
                >
                  Now
                </Badge>
              )}
            </div>
            <div className="mt-2 text-[12px] font-semibold tracking-tight text-foreground line-clamp-2">
              {phase.phase_name}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-[0.14em] font-semibold">
              {isCompleted
                ? "Done"
                : isBlocked
                  ? "Blocked"
                  : isInProgress
                    ? "In progress"
                    : "Pending"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-card border border-border overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-background border border-border flex items-center justify-center text-foreground">
            {icon}
          </div>
          <div>
            <h2 className="text-[12px] font-semibold tracking-tight text-foreground leading-none">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function EmptySectionState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="py-10 text-center">
      <div className="text-muted-foreground mx-auto mb-2 inline-flex">
        {icon}
      </div>
      <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
        {message}
      </p>
    </div>
  );
}

function NpnInline({
  currentNpn,
  onSave,
  saving,
}: {
  currentNpn: string | null;
  onSave: (npn: string) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentNpn ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="font-mono tabular-nums text-[12px] text-foreground hover:underline disabled:text-muted-foreground"
      >
        {currentNpn || "+ add NPN"}
      </button>
    );
  }

  return (
    <form
      className="inline-flex items-center gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(value.trim());
        setEditing(false);
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setEditing(false)}
        className="h-6 w-28 px-1.5 text-[11px] font-mono tabular-nums bg-background border border-border rounded"
        placeholder="NPN"
      />
      <button
        type="submit"
        disabled={saving}
        className="text-success hover:opacity-80 disabled:opacity-40"
        onMouseDown={(e) => e.preventDefault()}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export default RecruitDetailPage;
