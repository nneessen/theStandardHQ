// src/features/recruiting/components/RecruitBottomPanel.tsx
// Lightweight bottom-drawer panel for basic-tier uplines to manage recruit pipeline progress.
// Shows: recruit info, pipeline enrollment, current phase, advance/revert controls.

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  X,
  ListChecks,
  LogOut,
  FileText,
  Send,
  Hash,
} from "lucide-react";
import {
  useTemplates,
  usePhases,
  useChecklistItems,
} from "../hooks/usePipeline";
import {
  useRecruitPhaseProgress,
  useInitializeRecruitProgress,
  useAdvancePhase,
  useRevertPhase,
  useChecklistProgress,
  useUnenrollFromPipeline,
} from "../hooks/useRecruitProgress";
import { useRecruitDocuments } from "../hooks/useRecruitDocuments";
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
import { useCurrentUserProfile } from "@/hooks/admin";
import { cn } from "@/lib/utils";
import { TERMINAL_STATUS_COLORS } from "@/types/recruiting.types";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { UserProfile } from "@/types/hierarchy.types";

interface RecruitBottomPanelProps {
  recruit: UserProfile;
  onClose: () => void;
}

const CHECKLIST_STATUS_COLORS: Record<string, string> = {
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  not_started: "bg-v2-ring text-v2-ink-muted  -subtle",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

type ChecklistProgressRecord = { checklist_item_id: string; status: string };

/** Renders checklist items for a phase. Fetches item definitions directly
 *  from phase_checklist_items (any-auth policy — always accessible).
 *  Only active items are shown (is_active filter applied client-side). */
function PhaseChecklist({
  userId,
  phaseId,
}: {
  userId: string;
  phaseId: string;
}) {
  const {
    data: allItems = [],
    isLoading,
    isError,
  } = useChecklistItems(phaseId);
  const { data: rawProgress = [] } = useChecklistProgress(userId, phaseId);

  // Only render active items in the upline view
  const items = allItems.filter((i) => i.is_active !== false);

  const progressMap = new Map(
    (rawProgress as unknown as ChecklistProgressRecord[]).map((p) => [
      p.checklist_item_id,
      p.status,
    ]),
  );

  if (isLoading) {
    return <p className="text-[10px] text-v2-ink-subtle py-1">Loading…</p>;
  }

  if (isError) {
    return (
      <p className="text-[10px] text-red-400 dark:text-red-500 py-1">
        Failed to load checklist items.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-[10px] text-v2-ink-subtle py-1">
        No checklist items for this phase.
      </p>
    );
  }

  const sorted = [...items].sort((a, b) => a.item_order - b.item_order);

  return (
    <div className="flex flex-col gap-1 mt-1">
      {sorted.map((item) => {
        const status = progressMap.get(item.id) ?? "not_started";
        const label = status.replace(/_/g, " ");
        return (
          <div
            key={item.id}
            className="flex items-center justify-between px-2 py-1 rounded bg-v2-canvas/60"
          >
            <span className="text-[10px] text-v2-ink-muted flex-1 truncate">
              {item.item_name}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                "text-[9px] h-4 ml-2 shrink-0",
                CHECKLIST_STATUS_COLORS[status] ??
                  CHECKLIST_STATUS_COLORS.not_started,
              )}
            >
              {label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export function RecruitBottomPanel({
  recruit,
  onClose,
}: RecruitBottomPanelProps) {
  const queryClient = useQueryClient();

  const [enrollingTemplateId, setEnrollingTemplateId] = useState<string | null>(
    null,
  );
  // Track the enrolled template locally so UI updates immediately after enrollment
  const [enrolledTemplateId, setEnrolledTemplateId] = useState<string | null>(
    null,
  );
  // Phase bar click expansion — auto-tracks current in-progress phase.
  // A ref (not state) tracks the previously-seen phase ID so the effect
  // fires correctly on first load AND after advance/revert/re-enroll.
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const prevAutoPhaseIdRef = useRef<string | null>(null);
  // Unenroll confirmation dialog
  const [confirmUnenroll, setConfirmUnenroll] = useState(false);

  const { data: templates = [] } = useTemplates();
  const { data: phaseProgress = [], isLoading: phaseProgressLoading } =
    useRecruitPhaseProgress(recruit.id);

  // Derive template from profile, local enrollment state, or phase progress records.
  // Priority: local enrollment state > live DB progress records > stale recruit prop.
  // recruit.pipeline_template_id is last because the prop can be stale while the
  // recruits query re-fetches after an enroll/unenroll action.
  const progressTemplateId = phaseProgress[0]?.template_id ?? null;
  const effectiveTemplateId =
    enrolledTemplateId || progressTemplateId || recruit.pipeline_template_id;

  // Fetch phases directly — avoids the nested template query and its RLS restrictions.
  // pipeline_phases_upline_select policy allows uplines to read phases for their recruits.
  const { data: phases = [] } = usePhases(effectiveTemplateId ?? undefined);

  // Fetch documents for display
  const { data: documents = [] } = useRecruitDocuments(recruit.id);

  const initializeProgress = useInitializeRecruitProgress();
  const advancePhase = useAdvancePhase();
  const revertPhase = useRevertPhase();
  const unenrollFromPipeline = useUnenrollFromPipeline();

  // ─── Slack notifications (recruit channel posts) ──────────────────
  const { data: currentUserProfile } = useCurrentUserProfile();
  const { data: slackIntegrations = [] } = useSlackIntegrations();
  const recruitIntegration = findRecruitIntegration(slackIntegrations);
  const { data: slackChannels = [] } = useSlackChannelsById(
    recruitIntegration?.id,
  );
  const recruitChannel = findRecruitChannel(recruitIntegration, slackChannels);
  const { data: notificationStatus } = useRecruitNotificationStatus(recruit.id);
  const sendSlackNotification = useSendRecruitSlackNotification();

  // See policy comment in recruit-action-policy.ts: visibility no longer
  // requires the channel to be resolved upfront — click handler shows a
  // toast pointing to Settings if it can't find one.
  const slackVisible =
    !!recruitIntegration &&
    !!currentUserProfile?.imo_id &&
    !recruit.id.startsWith("invitation-");
  const showNewRecruitSlack =
    slackVisible && recruit.agent_status === "unlicensed";
  const showNpnSlack = slackVisible;
  const newRecruitSlackDisabled =
    !!notificationStatus?.newRecruitSent || sendSlackNotification.isPending;
  const npnSlackDisabled =
    !!notificationStatus?.npnReceivedSent || sendSlackNotification.isPending;

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

  const activeTemplates = templates.filter((t) => t.is_active);
  // hasPipeline is true when:
  //  - We just enrolled this session (enrolledTemplateId set locally), OR
  //  - DB phase progress records exist (progressTemplateId), OR
  //  - recruit.pipeline_template_id is set AND the progress query is still loading
  //    (prevents flashing enrollment UI while data arrives, but won't false-positive
  //    once loading completes with no progress records for an unenrolled recruit).
  const hasPipeline =
    !!enrolledTemplateId ||
    !!progressTemplateId ||
    (!!recruit.pipeline_template_id && phaseProgressLoading);

  // Find the current in-progress phase
  const currentProgress = phaseProgress.find((p) => p.status === "in_progress");
  const currentPhase = currentProgress
    ? phases.find((p) => p.id === currentProgress.phase_id)
    : null;

  // Sorted phases for progress display
  const sortedPhases = [...phases].sort(
    (a, b) => a.phase_order - b.phase_order,
  );
  const currentPhaseIndex = currentPhase
    ? sortedPhases.findIndex((p) => p.id === currentPhase.id)
    : -1;
  const totalPhases = sortedPhases.length;

  // Pipeline template name
  const pipelineTemplate = templates.find((t) => t.id === effectiveTemplateId);

  // Auto-select the current in-progress phase so checklist items are visible immediately on
  // open, AND update when the phase changes (advance/revert). Uses a ref to track the
  // previously-seen phase ID — fires on first load (ref=null→new) and on every phase
  // change (old phase id → new phase id), without triggering on unrelated re-renders.
  useEffect(() => {
    const incomingPhaseId = currentProgress?.phase_id ?? null;
    if (incomingPhaseId !== prevAutoPhaseIdRef.current) {
      prevAutoPhaseIdRef.current = incomingPhaseId;
      setSelectedPhaseId(incomingPhaseId);
    }
  }, [currentProgress?.phase_id]);

  // Days since pipeline started
  const pipelineStarted =
    phaseProgress.length > 0
      ? phaseProgress.reduce(
          (earliest, p) => {
            if (!p.started_at) return earliest;
            return !earliest || new Date(p.started_at) < new Date(earliest)
              ? p.started_at
              : earliest;
          },
          null as string | null,
        )
      : null;

  const handleEnroll = async (templateId: string) => {
    setEnrollingTemplateId(templateId);
    try {
      await initializeProgress.mutateAsync({ userId: recruit.id, templateId });
      toast.success("Recruit enrolled in pipeline");
      setEnrolledTemplateId(templateId);
      setEnrollingTemplateId(null);
      // Invalidate recruits so the parent refetches with updated pipeline_template_id
      queryClient.invalidateQueries({ queryKey: ["recruits"] });
    } catch {
      toast.error("Failed to enroll recruit in pipeline");
      setEnrollingTemplateId(null);
    }
  };

  const handleAdvance = async () => {
    if (!currentProgress) return;
    try {
      await advancePhase.mutateAsync({
        userId: recruit.id,
        currentPhaseId: currentProgress.phase_id,
      });
      toast.success("Phase advanced");
    } catch {
      toast.error("Failed to advance phase");
    }
  };

  // FIX: pass the PREVIOUS completed phase ID, not the current in_progress phase
  const handleRevert = async () => {
    if (currentPhaseIndex <= 0) return;
    const previousPhase = sortedPhases[currentPhaseIndex - 1];
    if (!previousPhase) return;
    try {
      await revertPhase.mutateAsync({
        userId: recruit.id,
        phaseId: previousPhase.id,
      });
      toast.success("Phase reverted");
    } catch {
      toast.error("Failed to revert phase");
    }
  };

  const handleUnenroll = async () => {
    try {
      await unenrollFromPipeline.mutateAsync({ userId: recruit.id });
      // Immediately zero-out the phase progress cache so hasPipeline resolves
      // to false right away — prevents the stale TQ cache (staleTime: 5min) from
      // briefly re-showing the old enrolled panel while the background refetch runs.
      queryClient.setQueryData(["recruit-phase-progress", recruit.id], []);
      toast.success("Recruit unenrolled from pipeline");
      setEnrolledTemplateId(null);
      setConfirmUnenroll(false);
      setSelectedPhaseId(null);
      // Reset ref so the next enrollment's in-progress phase auto-selects correctly
      prevAutoPhaseIdRef.current = null;
    } catch {
      toast.error("Failed to unenroll from pipeline");
      // Keep dialog open so user can retry — do NOT call setConfirmUnenroll(false)
    }
  };

  const handlePhaseBarClick = (phaseId: string) => {
    setSelectedPhaseId((prev) => (prev === phaseId ? null : phaseId));
  };

  const isAllCompleted =
    phaseProgress.length > 0 &&
    phaseProgress.every((p) => p.status === "completed");

  const displayName =
    `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim() ||
    "Unknown";
  const initials = `${(recruit.first_name?.[0] || "").toUpperCase()}${(recruit.last_name?.[0] || "").toUpperCase()}`;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-v2-ring shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={recruit.profile_photo_url || undefined} />
            <AvatarFallback className="text-[10px] bg-v2-ring text-v2-ink-muted -subtle">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-[12px] font-semibold text-v2-ink">
              {displayName}
            </h3>
            <div className="flex items-center gap-3 mt-0.5">
              {recruit.email && (
                <span className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
                  <Mail className="h-3 w-3" />
                  {recruit.email}
                </span>
              )}
              {recruit.phone && (
                <span className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
                  <Phone className="h-3 w-3" />
                  {recruit.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              recruit.approval_status === "declined" &&
              !recruit.pipeline_template_id
                ? "destructive"
                : "secondary"
            }
            className={cn(
              "text-[9px] h-4",
              recruit.pipeline_template_id
                ? ["completed", "dropped", "withdrawn"].includes(
                    recruit.onboarding_status || "",
                  )
                  ? TERMINAL_STATUS_COLORS[recruit.onboarding_status!]
                  : "bg-blue-100 text-blue-800"
                : recruit.approval_status === "active" ||
                    recruit.approval_status === "approved"
                  ? "bg-green-100 text-green-800"
                  : "",
            )}
          >
            {recruit.pipeline_template_id
              ? ["completed", "dropped", "withdrawn"].includes(
                  recruit.onboarding_status || "",
                )
                ? recruit.onboarding_status!.replace(/_/g, " ")
                : recruit.current_onboarding_phase || "In Pipeline"
              : recruit.approval_status || "Pending"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-v2-ink-subtle hover:text-v2-ink-muted dark:hover:text-v2-ink-subtle"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Slack notification quick actions */}
      {(showNewRecruitSlack || showNpnSlack) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-v2-ring bg-v2-canvas/40 shrink-0">
          <Hash className="h-3 w-3 text-v2-ink-subtle shrink-0" />
          <span className="text-[10px] text-v2-ink-muted shrink-0">
            {recruitChannel?.name ? `#${recruitChannel.name}` : "Slack"}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {showNewRecruitSlack && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1"
                disabled={newRecruitSlackDisabled}
                onClick={() => {
                  handleSendSlackNotification("new_recruit").catch(() => {
                    // hook fires error toast
                  });
                }}
                title={
                  notificationStatus?.newRecruitSent
                    ? "New recruit notification already sent"
                    : "Post new recruit notification to Slack"
                }
              >
                {sendSlackNotification.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                {notificationStatus?.newRecruitSent
                  ? "New recruit sent"
                  : "Post new recruit"}
              </Button>
            )}
            {showNpnSlack && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1"
                disabled={npnSlackDisabled}
                onClick={() => {
                  handleSendSlackNotification("npn_received").catch(() => {
                    // hook fires error toast
                  });
                }}
                title={
                  notificationStatus?.npnReceivedSent
                    ? "NPN received notification already sent"
                    : "Post NPN received notification to Slack"
                }
              >
                {sendSlackNotification.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                {notificationStatus?.npnReceivedSent
                  ? "NPN sent"
                  : "Post NPN received"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!hasPipeline ? (
          /* --- Not enrolled --- */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-v2-ink-muted">
              <ListChecks className="h-4 w-4" />
              <span>Not enrolled in a pipeline</span>
            </div>

            {activeTemplates.length > 0 ? (
              <div className="flex flex-col gap-2">
                {activeTemplates.map((t) => (
                  <button
                    key={t.id}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-lg border text-left transition-colors",
                      "border-v2-ring hover:border-v2-ring-strong ",
                      "hover:bg-v2-canvas",
                      enrollingTemplateId === t.id &&
                        "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30",
                    )}
                    disabled={initializeProgress.isPending}
                    onClick={() => handleEnroll(t.id)}
                  >
                    <div>
                      <p className="text-[11px] font-medium text-v2-ink">
                        {t.name}
                      </p>
                      {t.description && (
                        <p className="text-[10px] text-v2-ink-muted mt-0.5">
                          {t.description}
                        </p>
                      )}
                    </div>
                    {enrollingTemplateId === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0 ml-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-v2-ink-subtle shrink-0 ml-2" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-v2-ink-subtle">
                No active pipeline templates available. Contact your admin to
                set up a pipeline.
              </p>
            )}
          </div>
        ) : (
          /* --- Enrolled in pipeline --- */
          <div className="space-y-4">
            {/* Pipeline info card */}
            <div className="rounded-lg border border-v2-ring p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-v2-ink-muted uppercase tracking-[0.18em]">
                    Pipeline
                  </p>
                  <p className="text-[12px] font-medium text-v2-ink mt-0.5">
                    {pipelineTemplate?.name || "Unknown Pipeline"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pipelineStarted && (
                    <div className="text-right">
                      <p className="text-[10px] text-v2-ink-muted uppercase tracking-[0.18em]">
                        Started
                      </p>
                      <p className="text-[11px] text-v2-ink-muted mt-0.5">
                        {formatDistanceToNow(new Date(pipelineStarted), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] text-v2-ink-subtle hover:text-red-600 dark:hover:text-red-400 gap-1"
                    onClick={() => setConfirmUnenroll(true)}
                    disabled={unenrollFromPipeline.isPending}
                    title="Unenroll from pipeline"
                  >
                    <LogOut className="h-3 w-3" />
                    Unenroll
                  </Button>
                </div>
              </div>

              {/* Phase progress bar — each segment is clickable */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-v2-ink-muted">
                    {isAllCompleted
                      ? "All phases completed"
                      : currentPhase
                        ? `Phase ${currentPhaseIndex + 1} of ${totalPhases}: ${currentPhase.phase_name}`
                        : "Waiting to start"}
                  </p>
                  <span className="text-[10px] text-v2-ink-subtle">
                    {isAllCompleted ? totalPhases : currentPhaseIndex + 1}/
                    {totalPhases}
                  </span>
                </div>
                <div className="flex gap-1">
                  {sortedPhases.map((phase) => {
                    const progress = phaseProgress.find(
                      (p) => p.phase_id === phase.id,
                    );
                    const status = progress?.status || "not_started";
                    const isSelected = selectedPhaseId === phase.id;
                    return (
                      <button
                        key={phase.id}
                        className={cn(
                          "h-3 flex-1 rounded-full transition-all focus:outline-none",
                          "hover:opacity-80 hover:scale-y-125",
                          isSelected &&
                            "ring-2 ring-offset-1 ring-v2-ring-strong ",
                          status === "completed"
                            ? "bg-emerald-500"
                            : status === "in_progress"
                              ? "bg-blue-500"
                              : status === "blocked"
                                ? "bg-red-400"
                                : "bg-v2-ring",
                        )}
                        title={`${phase.phase_name} — ${status.replace(/_/g, " ")} (click to view)`}
                        onClick={() => handlePhaseBarClick(phase.id)}
                      />
                    );
                  })}
                </div>

                {/* Expanded checklist for selected phase */}
                {selectedPhaseId &&
                  (() => {
                    const selPhase = sortedPhases.find(
                      (p) => p.id === selectedPhaseId,
                    );
                    return (
                      <div className="mt-2 px-1">
                        <div className="flex items-center gap-1 mb-1">
                          <ChevronDown className="h-3 w-3 text-v2-ink-subtle" />
                          <p className="text-[10px] font-medium text-v2-ink-muted -subtle">
                            {selPhase?.phase_name}
                          </p>
                        </div>
                        <PhaseChecklist
                          userId={recruit.id}
                          phaseId={selectedPhaseId}
                        />
                      </div>
                    );
                  })()}

                {/* Documents Section */}
                <div className="border-t border-v2-ring/60 pt-2 mt-2">
                  <h4 className="text-[10px] font-medium text-v2-ink-muted -subtle mb-1 px-1">
                    Documents
                  </h4>
                  {documents && documents.length > 0 ? (
                    <div className="space-y-0.5">
                      {documents.slice(0, 3).map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded hover:bg-v2-canvas"
                        >
                          <FileText className="h-3 w-3 text-v2-ink-subtle flex-shrink-0" />
                          <span className="flex-1 truncate text-v2-ink-muted">
                            {doc.document_name}
                          </span>
                          <Badge
                            className={`px-1 py-0 text-[9px] h-4 ${
                              String(doc.status) === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {String(doc.status)}
                          </Badge>
                        </div>
                      ))}
                      {documents.length > 3 && (
                        <div className="text-[10px] text-blue-600 cursor-pointer hover:underline px-1">
                          +{documents.length - 3} more documents
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-v2-ink-subtle px-1">
                      No documents uploaded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Current phase details */}
              {currentPhase && currentProgress && (
                <div className="flex items-center gap-3 pt-1 border-t border-v2-ring/60">
                  <div className="flex-1">
                    <p className="text-[10px] text-v2-ink-muted">
                      Current Phase
                    </p>
                    <p className="text-[11px] font-medium text-v2-ink -subtle">
                      {currentPhase.phase_name}
                    </p>
                    {currentPhase.phase_description && (
                      <p className="text-[10px] text-v2-ink-subtle mt-0.5">
                        {currentPhase.phase_description}
                      </p>
                    )}
                  </div>
                  {currentProgress.started_at && (
                    <div className="text-right">
                      <p className="text-[10px] text-v2-ink-muted">
                        Days in phase
                      </p>
                      <p className="text-[11px] font-medium text-v2-ink-muted">
                        {Math.ceil(
                          (Date.now() -
                            new Date(currentProgress.started_at).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Phase controls */}
            {!isAllCompleted && currentProgress && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[10px] gap-1"
                  disabled={currentPhaseIndex <= 0 || revertPhase.isPending}
                  onClick={handleRevert}
                >
                  {revertPhase.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ChevronLeft className="h-3 w-3" />
                  )}
                  Revert Phase
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-[10px] gap-1"
                  disabled={advancePhase.isPending}
                  onClick={handleAdvance}
                >
                  Advance Phase
                  {advancePhase.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}

            {isAllCompleted && (
              <div className="flex items-center justify-center py-2">
                <Badge
                  variant="default"
                  className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  Pipeline Complete
                </Badge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unenroll confirmation — rendered inline inside the panel (avoids z-index portal issues) */}
      {confirmUnenroll && (
        <div className="absolute inset-0 rounded-t-xl bg-black/50 flex items-center justify-center px-4 z-10">
          <div className="w-full max-w-sm bg-v2-card rounded-lg border border-v2-ring shadow-xl p-4">
            <p className="text-[12px] font-semibold text-v2-ink">
              Unenroll from Pipeline?
            </p>
            <p className="text-[11px] text-v2-ink-muted mt-1.5">
              This will remove all phase and checklist progress for{" "}
              <span className="font-medium text-v2-ink">{displayName}</span>.
              They can then be enrolled in a different pipeline.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-[10px]"
                onClick={() => setConfirmUnenroll(false)}
                disabled={unenrollFromPipeline.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-[10px] bg-red-600 hover:bg-red-700 text-white"
                onClick={handleUnenroll}
                disabled={unenrollFromPipeline.isPending}
              >
                {unenrollFromPipeline.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Unenroll
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
