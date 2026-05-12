// src/features/recruiting/components/RecruitDetailPanel.tsx
// Orchestrator — delegates to focused subcomponents

import { useState } from "react";
import type { UserProfile } from "@/types/hierarchy.types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Activity,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Circle,
  FolderOpen,
  ListChecks,
  Loader2,
  Mail,
  RotateCcw,
} from "lucide-react";
import { DeleteRecruitDialogOptimized } from "./DeleteRecruitDialog.optimized";
import { InitializePipelineDialog } from "./InitializePipelineDialog";
import { PhaseChecklist } from "./PhaseChecklist";
import { DocumentManager } from "./DocumentManager";
import { EmailManager } from "./EmailManager";
import { RecruitDetailHeader } from "./RecruitDetailHeader";
import { RecruitActionBar } from "./RecruitActionBar";
import { PhaseStepper } from "./PhaseStepper";
import { ContractingTab } from "./ContractingTab";
import { ActivityTab } from "./ActivityTab";
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
import { useRecruitCarrierContracts } from "../hooks/useRecruitCarrierContracts";
import type {
  InvitationStatus,
  PipelinePhase,
  PhaseChecklistItem,
} from "@/types/recruiting.types";

type PhaseWithChecklist = PipelinePhase & {
  checklist_items: PhaseChecklistItem[];
};
import { useCancelInvitation } from "../hooks/useRecruitInvitations";
import { useUpdateRecruit } from "../hooks/useRecruitMutations";
import { useResendInvite } from "../hooks/useAuthUser";
import { toast } from "sonner";
import { STAFF_ONLY_ROLES } from "@/constants/roles";
import {
  useSlackIntegrations,
  useSlackChannelsById,
  useRecruitNotificationStatus,
  useSendRecruitSlackNotification,
} from "@/hooks/slack";
import {
  findRecruitIntegration,
  findRecruitChannel,
  buildNewRecruitMessage,
  buildNpnReceivedMessage,
} from "@/hooks/slack";
import type {
  RecruitEntity,
  RecruitPermissions,
} from "../types/recruit-detail.types";

interface RecruitDetailPanelProps {
  recruit: UserProfile;
  currentUserId?: string;
  isUpline?: boolean;
  onRecruitDeleted?: () => void;
}

export function RecruitDetailPanel({
  recruit,
  currentUserId,
  isUpline = false,
  onRecruitDeleted,
}: RecruitDetailPanelProps) {
  const [activeTab, setActiveTab] = useState("checklist");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [initializeDialogOpen, setInitializeDialogOpen] = useState(false);
  const [unenrollDialogOpen, setUnenrollDialogOpen] = useState(false);

  // ─── Entity derivation (discriminated union) ──────────────────────
  const isInvitation = recruit?.id?.startsWith("invitation-");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Virtual recruit type includes invitation fields
  const recruitAny = recruit as any;
  const rawInvitationId: string | undefined = recruitAny?.invitation_id;
  const entity: RecruitEntity = isInvitation
    ? {
        kind: "invitation",
        recruit,
        invitationId: rawInvitationId ?? "",
        invitationStatus:
          (recruitAny.invitation_status as InvitationStatus) ?? "pending",
      }
    : { kind: "registered", recruit, recruitId: recruit.id };

  // ─── Permissions (computed once) ──────────────────────────────────
  const { data: currentUserProfile } = useCurrentUserProfile();
  const hasStaffRole =
    currentUserProfile?.roles?.some((role) =>
      STAFF_ONLY_ROLES.includes(role as (typeof STAFF_ONLY_ROLES)[number]),
    ) || false;
  const isStaff = currentUserProfile?.is_admin || hasStaffRole || false;

  const permissions: RecruitPermissions = {
    canManage: isUpline || isStaff,
    canInitialize: isUpline || isStaff,
    canDelete: (isUpline || isStaff) && currentUserId !== recruit.id,
    isStaff,
  };

  // ─── Query ID (undefined for invitations → disables DB queries) ───
  const recruitIdForQueries = isInvitation ? undefined : recruit.id;

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

  // Template resolution: recruit's own template → default for new recruits
  const recruitTemplateId = isInvitation
    ? null
    : phaseProgress?.[0]?.template_id || recruit.pipeline_template_id || null;
  const { data: recruitTemplate, isLoading: recruitTemplateLoading } =
    useTemplate(recruitTemplateId ?? undefined);
  const { data: defaultTemplate, isLoading: defaultTemplateLoading } =
    useActiveTemplate();
  const template = recruitTemplateId ? recruitTemplate : defaultTemplate;
  const templateLoading = recruitTemplateId
    ? recruitTemplateLoading
    : defaultTemplateLoading;

  // ─── Tab data hooks (only fetch for active tab) ───────────────────
  const { data: checklistProgress } = useChecklistProgress(
    recruitIdForQueries,
    selectedPhaseId || currentPhase?.phase_id,
  );
  const { data: documents } = useRecruitDocuments(
    activeTab === "documents" || activeTab === "checklist"
      ? recruitIdForQueries
      : undefined,
  );
  const { data: emails } = useRecruitEmails(
    activeTab === "emails" ? recruitIdForQueries : undefined,
  );
  const {
    data: activityLog,
    isLoading: activityLoading,
    error: activityError,
  } = useRecruitActivityLog(
    activeTab === "activity" ? recruitIdForQueries : undefined,
  );
  // Contract count for tab badge (always fetch for badge visibility)
  const { data: contractRequests } =
    useRecruitCarrierContracts(recruitIdForQueries);

  // ─── Mutations ────────────────────────────────────────────────────
  const advancePhase = useAdvancePhase();
  const blockPhase = useBlockPhase();
  const revertPhase = useRevertPhase();
  const updatePhaseStatus = useUpdatePhaseStatus();
  const initializeProgress = useInitializeRecruitProgress();
  const unenrollPipeline = useUnenrollFromPipeline();
  const cancelInvitation = useCancelInvitation();
  const resendInvite = useResendInvite();
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

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleAdvancePhase = async (): Promise<void> => {
    if (!currentPhase) return;
    await advancePhase.mutateAsync({
      userId: recruit.id,
      currentPhaseId: currentPhase.phase_id,
    });
  };

  const handleBlockPhase = async (reason: string): Promise<void> => {
    if (!currentPhase) return;
    await blockPhase.mutateAsync({
      userId: recruit.id,
      phaseId: currentPhase.phase_id,
      reason,
    });
  };

  const handleUnblockPhase = async (): Promise<void> => {
    if (!currentPhase) return;
    await updatePhaseStatus.mutateAsync({
      userId: recruit.id,
      phaseId: currentPhase.phase_id,
      status: "in_progress",
      notes: "Unblocked",
    });
  };

  const handlePhaseClick = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
    setActiveTab("checklist");
  };

  const handleRevertPhase = async (): Promise<void> => {
    const phaseToRevert = viewingPhaseId
      ? progressMap?.get(viewingPhaseId)
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
      const progress = progressMap?.get(phase.id);
      if (progress?.status === "completed") {
        await revertPhase.mutateAsync({
          userId: recruit.id,
          phaseId: phase.id,
        });
        return;
      }
    }
  };

  const handleResendInvite = async (): Promise<void> => {
    if (!recruit.email) return;
    await resendInvite.mutateAsync({
      email: recruit.email,
      fullName: `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim(),
      roles: (recruit.roles as string[]) || ["recruit"],
      existingProfileId: recruit.id,
    });
  };

  const handleCancelInvitation = async (): Promise<void> => {
    if (entity.kind !== "invitation" || !entity.invitationId) return;
    await cancelInvitation.mutateAsync(entity.invitationId);
    onRecruitDeleted?.();
  };

  const handleConfirmInitialize = async (templateId: string): Promise<void> => {
    try {
      await initializeProgress.mutateAsync({ userId: recruit.id, templateId });
    } catch {
      // hook's onError fires toast
    } finally {
      // Always close: multi-template users re-open to retry; single-template
      // users re-click "Initialize" which resets autoConfirmedRef via open→false→true.
      setInitializeDialogOpen(false);
    }
  };

  const handleUnenroll = async () => {
    try {
      await unenrollPipeline.mutateAsync({ userId: recruit.id });
      toast.success("Recruit unenrolled from pipeline");
      setUnenrollDialogOpen(false);
      setSelectedPhaseId(null);
    } catch (error) {
      toast.error("Failed to unenroll recruit");
      console.error("[RecruitDetailPanel] Unenroll failed:", error);
    }
  };

  const handleSendSlackNotification = async (
    notificationType: "new_recruit" | "npn_received",
  ): Promise<void> => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- upline joined by RecruitRepository
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
    // mutateAsync rejects on error; hook's onError fires the toast
    await sendSlackNotification.mutateAsync({
      integrationId: recruitIntegration.id,
      channelId: recruitChannel.id,
      text: msg.text,
      blocks: msg.blocks,
      notificationType,
      recruitId: recruit.id,
      imoId: currentUserProfile.imo_id!,
    });
  };

  // ─── Loading state ────────────────────────────────────────────────
  if (progressLoading || currentPhaseLoading || templateLoading) {
    return (
      <div className="p-3 space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────
  if (progressError || currentPhaseError) {
    return (
      <div className="p-6 text-center">
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

  // ─── Derived state ────────────────────────────────────────────────
  const hasPipelineProgress = phaseProgress && phaseProgress.length > 0;
  const displayName =
    recruit.first_name && recruit.last_name
      ? `${recruit.first_name} ${recruit.last_name}`
      : recruit.email;
  const initials =
    recruit.first_name && recruit.last_name
      ? `${recruit.first_name[0]}${recruit.last_name[0]}`.toUpperCase()
      : recruit.email?.substring(0, 2).toUpperCase() || "??";

  const phases: PhaseWithChecklist[] = (template?.phases ||
    []) as PhaseWithChecklist[];
  const sortedPhases = [...phases].sort(
    (a, b) => a.phase_order - b.phase_order,
  );
  const progressMap = new Map(phaseProgress?.map((p) => [p.phase_id, p]) || []);
  const completedCount =
    phaseProgress?.filter((p) => p.status === "completed").length || 0;

  const viewingPhaseId = selectedPhaseId || currentPhase?.phase_id;
  const viewingPhase = sortedPhases.find((p) => p.id === viewingPhaseId);
  const viewingChecklistItems = viewingPhase?.checklist_items || [];

  // Revert eligibility
  const viewingPhaseProgress = viewingPhaseId
    ? progressMap.get(viewingPhaseId)
    : null;
  const canRevertViewingPhase = viewingPhaseProgress?.status === "completed";
  const hasCompletedPhaseBefore = (() => {
    const currentIndex = sortedPhases.findIndex(
      (p) => p.id === currentPhase?.phase_id,
    );
    if (currentIndex <= 0) return false;
    for (let i = currentIndex - 1; i >= 0; i--) {
      const progress = progressMap.get(sortedPhases[i].id);
      if (progress?.status === "completed") return true;
    }
    return false;
  })();
  const canRevert = canRevertViewingPhase || hasCompletedPhaseBefore;

  return (
    <div className="h-full flex flex-col bg-background ">
      {/* Header */}
      <div className="px-3 py-2.5 bg-card border-b border-border">
        <RecruitDetailHeader
          recruit={recruit}
          displayName={displayName || ""}
          initials={initials}
          onUpdateNpn={
            !isInvitation
              ? async (npn) => {
                  await updateRecruit.mutateAsync({
                    id: recruit.id,
                    updates: { npn: npn || null },
                  });
                }
              : undefined
          }
          isUpdatingNpn={updateRecruit.isPending}
        />
        <RecruitActionBar
          entity={entity}
          permissions={permissions}
          recruit={recruit}
          hasPipelineProgress={!!hasPipelineProgress}
          currentPhase={currentPhase}
          canRevert={canRevert}
          slack={{
            recruitIntegration,
            recruitChannel,
            imoId: currentUserProfile?.imo_id ?? null,
            notificationStatus,
          }}
          actions={{
            onAdvancePhase: handleAdvancePhase,
            onBlockPhase: handleBlockPhase,
            onUnblockPhase: handleUnblockPhase,
            onRevertPhase: handleRevertPhase,
            onInitialize: () => setInitializeDialogOpen(true),
            onUnenroll: () => setUnenrollDialogOpen(true),
            onResendInvite: handleResendInvite,
            onCancelInvitation: handleCancelInvitation,
            onDeleteOpen: () => setDeleteDialogOpen(true),
            onSendSlackNotification: handleSendSlackNotification,
          }}
          loading={{
            isAdvancing: advancePhase.isPending,
            isReverting: revertPhase.isPending,
            isInitializing: initializeProgress.isPending,
            isUnenrolling: unenrollPipeline.isPending,
            isResendingInvite: resendInvite.isPending,
            isCancellingInvitation: cancelInvitation.isPending,
            isSendingSlack: sendSlackNotification.isPending,
          }}
        />
      </div>

      {/* Phase Stepper */}
      {!isInvitation && hasPipelineProgress && sortedPhases.length > 0 && (
        <PhaseStepper
          sortedPhases={sortedPhases}
          progressMap={progressMap}
          completedCount={completedCount}
          currentPhaseId={currentPhase?.phase_id}
          viewingPhaseId={viewingPhaseId}
          onPhaseClick={handlePhaseClick}
        />
      )}

      {/* No Pipeline State */}
      {!isInvitation && !hasPipelineProgress && (
        <div className="px-3 py-4 bg-card border-b border-border text-center">
          <Circle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground mb-2">
            Pipeline not initialized
          </p>
          {permissions.canInitialize && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInitializeDialogOpen(true)}
              disabled={initializeProgress.isPending}
              className="h-7 text-xs"
            >
              {initializeProgress.isPending
                ? "Initializing..."
                : "Initialize Pipeline"}
            </Button>
          )}
        </div>
      )}

      {/* Invitation Pending State */}
      {isInvitation && (
        <div className="px-3 py-4 bg-card border-b border-border text-center">
          <Mail className="h-8 w-8 text-warning mx-auto mb-2" />
          <p className="text-xs text-muted-foreground font-medium mb-1">
            Awaiting Registration
          </p>
          <p className="text-[11px] text-muted-foreground">
            This person has been invited but hasn&apos;t completed their
            registration form yet.
          </p>
        </div>
      )}

      {/* Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="mx-4 mt-3 mb-1 flex h-auto items-center gap-4 sm:gap-5 bg-transparent p-0 rounded-none border-b border-border justify-start overflow-x-auto">
          <TabsTrigger
            value="checklist"
            className="text-[11px] uppercase tracking-[0.18em] font-semibold py-2 px-0 rounded-none bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:underline data-[state=active]:underline-offset-[10px] data-[state=active]:decoration-2 transition-colors"
          >
            <ListChecks className="h-3 w-3 mr-1.5" />
            Tasks
          </TabsTrigger>
          <TabsTrigger
            value="contracting"
            className="text-[11px] uppercase tracking-[0.18em] font-semibold py-2 px-0 rounded-none bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:underline data-[state=active]:underline-offset-[10px] data-[state=active]:decoration-2 transition-colors"
          >
            <Briefcase className="h-3 w-3 mr-1.5" />
            Contracts
            {contractRequests && contractRequests.length > 0 && (
              <span className="ml-1.5 font-mono tabular-nums text-[10px] text-success">
                {contractRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="text-[11px] uppercase tracking-[0.18em] font-semibold py-2 px-0 rounded-none bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:underline data-[state=active]:underline-offset-[10px] data-[state=active]:decoration-2 transition-colors"
          >
            <FolderOpen className="h-3 w-3 mr-1.5" />
            Docs
          </TabsTrigger>
          <TabsTrigger
            value="emails"
            className="text-[11px] uppercase tracking-[0.18em] font-semibold py-2 px-0 rounded-none bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:underline data-[state=active]:underline-offset-[10px] data-[state=active]:decoration-2 transition-colors"
          >
            <Mail className="h-3 w-3 mr-1.5" />
            Email
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="text-[11px] uppercase tracking-[0.18em] font-semibold py-2 px-0 rounded-none bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:underline data-[state=active]:underline-offset-[10px] data-[state=active]:decoration-2 transition-colors"
          >
            <Activity className="h-3 w-3 mr-1.5" />
            Log
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-3">
          <TabsContent value="checklist" className="mt-0 h-full">
            {hasPipelineProgress && viewingChecklistItems.length > 0 ? (
              <PhaseChecklist
                userId={recruit.id}
                checklistItems={viewingChecklistItems}
                checklistProgress={checklistProgress || []}
                isUpline={isUpline}
                currentUserId={currentUserId}
                currentPhaseId={currentPhase?.phase_id}
                viewedPhaseId={viewingPhaseId}
                isAdmin={isStaff}
                onPhaseComplete={() => {}}
                recruitEmail={recruit.email || ""}
                recruitName={displayName}
                documents={documents || []}
              />
            ) : (
              <div className="py-8 text-center">
                <ListChecks className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  {hasPipelineProgress
                    ? "No tasks for this phase"
                    : "Initialize pipeline to view tasks"}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="contracting" className="mt-0">
            <ContractingTab entity={entity} permissions={permissions} />
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            {isInvitation ? (
              <div className="py-8 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Available after registration
                </p>
              </div>
            ) : (
              <DocumentManager
                userId={recruit.id}
                documents={documents}
                isUpline={isUpline}
                currentUserId={currentUserId}
              />
            )}
          </TabsContent>

          <TabsContent value="emails" className="mt-0">
            {isInvitation ? (
              <div className="py-8 text-center">
                <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Available after registration
                </p>
              </div>
            ) : (
              <EmailManager
                recruitId={recruit.id}
                recruitEmail={recruit.email}
                recruitName={displayName}
                emails={emails}
                isUpline={isUpline}
                currentUserId={currentUserId}
              />
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <ActivityTab
              activityLog={activityLog}
              isLoading={activityLoading}
              error={activityError}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Dialogs */}
      <DeleteRecruitDialogOptimized
        recruit={recruit}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => onRecruitDeleted?.()}
      />

      <InitializePipelineDialog
        open={initializeDialogOpen}
        onOpenChange={setInitializeDialogOpen}
        onConfirm={handleConfirmInitialize}
        isLoading={initializeProgress.isPending}
      />

      {/* Unenroll Confirmation Dialog */}
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
                  Unenrolling...
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
    </div>
  );
}
