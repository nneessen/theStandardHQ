// src/features/recruiting/components/PhaseChecklist.tsx
// Checklist component with modern zinc palette styling

import React, { useState } from "react";
import {
  RecruitChecklistProgress,
  PhaseChecklistItem,
  CHECKLIST_STATUS_COLORS,
  UserDocument,
} from "@/types/recruiting.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ExternalLink,
  Upload,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
  AlertCircle,
  Loader2,
  EyeOff,
  Clock,
  Calendar,
  CalendarDays,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useUpdateChecklistItemStatus } from "../hooks/useRecruitProgress";
import {
  isRecruitViewer as checkIsRecruitViewer,
  isHiddenFromRecruit,
  filterItemsForViewer,
} from "@/lib/recruiting/visibility";
import type {
  SchedulingChecklistMetadata,
  SchedulingIntegrationType,
} from "@/types/integration.types";
import type {
  VideoEmbedMetadata,
  BooleanQuestionMetadata,
  AcknowledgmentMetadata,
  TextResponseMetadata,
  MultipleChoiceMetadata,
  FileDownloadMetadata,
  ExternalLinkMetadata,
  QuizMetadata,
  CarrierContractingMetadata,
  VideoEmbedResponse,
  BooleanQuestionResponse,
  AcknowledgmentResponse,
  TextResponseData,
  MultipleChoiceResponse,
  FileDownloadResponse,
  ExternalLinkResponse,
  QuizResponse,
  SignatureResponse,
  CarrierContractingResponse,
} from "@/types/recruiting.types";
import type { SignatureRequiredMetadata } from "@/types/signature.types";
import {
  BooleanQuestionItem,
  AcknowledgmentItem,
  TextResponseItem,
  MultipleChoiceItem,
  FileDownloadItem,
  ExternalLinkItem,
  QuizItem,
  VideoEmbedItem,
  SignatureRequiredItem,
  CarrierContractingItem,
} from "./interactive";
import {
  useActiveSchedulingIntegrations,
  useRecruiterSchedulingIntegrations,
} from "@/hooks/integrations";
import { SchedulingBookingModal } from "./SchedulingBookingModal";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { DocumentViewerDialog } from "./DocumentViewerDialog";

interface PhaseChecklistProps {
  userId: string;
  checklistItems: PhaseChecklistItem[];
  checklistProgress: RecruitChecklistProgress[];
  isUpline?: boolean;
  currentUserId?: string;
  currentPhaseId?: string;
  viewedPhaseId?: string;
  isAdmin?: boolean;
  onPhaseComplete?: () => void;
  // Recruit info for signature items
  recruitEmail?: string;
  recruitName?: string;
  // Documents for upline view (to allow viewing uploaded files)
  documents?: UserDocument[];
}

// Interactive item types that render special UI components
const INTERACTIVE_ITEM_TYPES = new Set([
  "video_embed",
  "boolean_question",
  "acknowledgment",
  "text_response",
  "multiple_choice",
  "file_download",
  "external_link",
  "quiz",
  "signature_required",
  "carrier_contracting",
]);

export function PhaseChecklist({
  userId,
  checklistItems,
  checklistProgress,
  isUpline = false,
  currentUserId,
  currentPhaseId,
  viewedPhaseId,
  isAdmin = false,
  onPhaseComplete: _onPhaseComplete,
  recruitEmail,
  recruitName,
  documents,
}: PhaseChecklistProps) {
  const updateItemStatus = useUpdateChecklistItemStatus();
  const [loadingItemIds, setLoadingItemIds] = useState<Set<string>>(new Set());
  const [uploadDialogItemId, setUploadDialogItemId] = useState<string | null>(
    null,
  );
  const [viewerDoc, setViewerDoc] = useState<UserDocument | null>(null);

  // Scheduling modal state
  const [schedulingModalData, setSchedulingModalData] = useState<{
    open: boolean;
    itemId: string;
    itemName: string;
    integrationType: SchedulingIntegrationType;
    bookingUrl: string;
    instructions?: string;
    meetingId?: string;
    passcode?: string;
  } | null>(null);

  // Fetch scheduling integrations for building booking URLs
  // For the current user (admin), use their own integrations
  const { data: ownIntegrations } = useActiveSchedulingIntegrations();
  // For the recruit (userId), fetch their recruiter's integrations
  const { data: recruiterIntegrations } =
    useRecruiterSchedulingIntegrations(userId);

  // Use recruiter's integrations for recruits, own integrations as fallback for admins
  const schedulingIntegrations = recruiterIntegrations?.length
    ? recruiterIntegrations
    : ownIntegrations;

  const progressMap = new Map(
    checklistProgress.map((p) => [p.checklist_item_id, p]),
  );

  // Helper to get the icon for a scheduling type
  const getSchedulingIcon = (type: SchedulingIntegrationType) => {
    switch (type) {
      case "calendly":
        return Calendar;
      case "google_calendar":
        return CalendarDays;
      case "zoom":
        return Video;
      default:
        return Calendar;
    }
  };

  // Helper to get the booking URL for a scheduling item
  // Priority: 1) custom_booking_url, 2) booking_url from metadata, 3) integration lookup (legacy fallback)
  const getBookingUrl = (
    metadata: SchedulingChecklistMetadata,
  ): string | null => {
    // 1. Custom URL takes highest priority
    if (metadata.custom_booking_url) {
      return metadata.custom_booking_url;
    }
    // 2. Use booking_url captured in metadata (the correct approach)
    if (metadata.booking_url) {
      return metadata.booking_url;
    }
    // 3. Legacy fallback: look up integration (only works for admin, not recruits)
    const integration = schedulingIntegrations?.find(
      (i) => i.integration_type === metadata.scheduling_type,
    );
    return integration?.booking_url || null;
  };

  // Determine if viewer is a recruit (not admin and not upline)
  const isRecruitViewer = checkIsRecruitViewer(isAdmin, isUpline);

  // Filter items based on visibility for recruits
  const visibleItems = filterItemsForViewer(checklistItems, isAdmin, isUpline);

  const sortedItems = [...visibleItems].sort(
    (a, b) => a.item_order - b.item_order,
  );

  // Check if there are hidden required items blocking progress
  const hasHiddenBlockingItems = checklistItems.some((item) => {
    if (!isHiddenFromRecruit(item)) return false;
    if (!item.is_required) return false;
    const progress = progressMap.get(item.id);
    const status = progress?.status || "not_started";
    return status !== "completed" && status !== "approved";
  });

  const getCheckboxState = (
    item: PhaseChecklistItem,
    itemStatus: string,
    allItems: PhaseChecklistItem[],
  ): { isEnabled: boolean; disabledReason?: string } => {
    if (!currentUserId) {
      return { isEnabled: false, disabledReason: "Not logged in" };
    }

    const isViewingFuturePhase =
      currentPhaseId && viewedPhaseId && currentPhaseId !== viewedPhaseId;

    if (isViewingFuturePhase) {
      return {
        isEnabled: false,
        disabledReason: "Complete current phase first",
      };
    }

    const isSystemOnlyItem = item.can_be_completed_by === "system";

    if (isSystemOnlyItem && !isAdmin) {
      return { isEnabled: false, disabledReason: "Admin approval required" };
    }

    if (itemStatus === "rejected" || itemStatus === "needs_resubmission") {
      return { isEnabled: true };
    }

    if (itemStatus === "completed" || itemStatus === "approved") {
      return { isEnabled: true };
    }

    const isItemDoneForOrdering = (s: string) =>
      s === "completed" || s === "approved" || s === "in_progress";

    const incompleteRequiredOrders = allItems
      .filter((i) => {
        if (!i.is_required) return false;
        const progress = progressMap.get(i.id);
        const status = progress?.status || "not_started";
        return !isItemDoneForOrdering(status);
      })
      .map((i) => i.item_order);

    const firstIncompleteOrder =
      incompleteRequiredOrders.length > 0
        ? Math.min(...incompleteRequiredOrders)
        : Math.min(
            ...allItems
              .filter((i) => {
                const progress = progressMap.get(i.id);
                const status = progress?.status || "not_started";
                return !isItemDoneForOrdering(status);
              })
              .map((i) => i.item_order)
              .concat([Infinity]),
          );

    if (item.item_order === firstIncompleteOrder) {
      return { isEnabled: true };
    }

    if (item.item_order > firstIncompleteOrder) {
      return {
        isEnabled: false,
        disabledReason: "Complete previous items first",
      };
    }

    return { isEnabled: true };
  };

  const handleToggleComplete = async (
    itemId: string,
    currentStatus: string,
  ) => {
    if (!currentUserId) return;

    const newStatus =
      currentStatus === "completed" ? "not_started" : "completed";

    // Show loading state immediately
    setLoadingItemIds((prev) => new Set(prev).add(itemId));
    const startTime = Date.now();

    try {
      await updateItemStatus.mutateAsync({
        userId,
        itemId,
        statusData: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- checklist status type
          status: newStatus as any,
          completed_by: newStatus === "completed" ? currentUserId : undefined,
        },
      });
      toast.success(
        newStatus === "completed" ? "Task marked as complete" : "Task unmarked",
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
    } catch (error: any) {
      console.error("Failed to update checklist item:", error);
      toast.error(error?.message || "Failed to update task. Please try again.");
    } finally {
      // Ensure spinner shows for at least 400ms for visual feedback
      const elapsed = Date.now() - startTime;
      const minDisplayTime = 400;
      if (elapsed < minDisplayTime) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDisplayTime - elapsed),
        );
      }
      setLoadingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleMarkInProgress = async (itemId: string, documentId?: string) => {
    if (!currentUserId) return;
    try {
      await updateItemStatus.mutateAsync({
        userId,
        itemId,
        statusData: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- checklist status type
          status: "in_progress" as any,
          completed_by: currentUserId,
          document_id: documentId,
        },
      });
    } catch (error) {
      console.error("[PhaseChecklist] Failed to mark item in_progress:", error);
      // Non-blocking: upload/signature was still initiated
    }
  };

  const handleApprove = async (itemId: string) => {
    if (!currentUserId || !isUpline) return;

    try {
      await updateItemStatus.mutateAsync({
        userId,
        itemId,
        statusData: {
          status: "approved",
          verified_by: currentUserId,
        },
      });
      toast.success("Item approved successfully");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
    } catch (error: any) {
      console.error("Failed to approve item:", error);
      toast.error(
        error?.message || "Failed to approve item. Please try again.",
      );
    }
  };

  const handleReject = async (itemId: string, reason: string) => {
    if (!currentUserId || !isUpline) return;

    try {
      await updateItemStatus.mutateAsync({
        userId,
        itemId,
        statusData: {
          status: "rejected",
          verified_by: currentUserId,
          rejection_reason: reason,
        },
      });
      toast.success("Item rejected");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
    } catch (error: any) {
      console.error("Failed to reject item:", error);
      toast.error(error?.message || "Failed to reject item. Please try again.");
    }
  };

  const getActionButton = (
    item: PhaseChecklistItem,
    progress: RecruitChecklistProgress | undefined,
  ) => {
    const status = progress?.status || "not_started";

    if (item.item_type === "document_upload") {
      if (isUpline) {
        if (status === "completed" || status === "in_progress") {
          const docId = progress?.document_id;
          const linkedDoc = docId
            ? documents?.find((d) => d.id === docId)
            : undefined;
          return (
            <div className="flex items-center gap-1">
              {/* View document icon */}
              {linkedDoc && (
                <button
                  onClick={() => setViewerDoc(linkedDoc)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-info/10 dark:hover:bg-info/10 text-info transition-colors"
                  title="View Document"
                >
                  <FileText className="h-4 w-4" />
                </button>
              )}
              {/* Approve icon */}
              <button
                onClick={() => handleApprove(item.id)}
                className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-success/10 dark:hover:bg-success/10 text-success transition-colors"
                title="Approve"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
              {/* Reject icon */}
              <button
                onClick={() => {
                  const reason = prompt("Reason for rejection:");
                  if (reason) handleReject(item.id, reason);
                }}
                className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-destructive/10 dark:hover:bg-destructive/10 text-destructive transition-colors"
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          );
        }
        if (status === "approved") {
          return (
            <Badge
              variant="outline"
              className="text-sm text-success bg-success/10 border-success/30 dark:text-success dark:bg-success/15 dark:border-success"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Approved
            </Badge>
          );
        }
      } else {
        if (status === "not_started" || status === "needs_resubmission") {
          return (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setUploadDialogItemId(item.id)}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Upload
            </Button>
          );
        }
        if (status === "completed" || status === "in_progress") {
          return (
            <Badge
              variant="secondary"
              className="text-sm text-warning bg-warning/10 border-warning/30 dark:text-warning dark:bg-warning/15 dark:border-warning"
            >
              Pending Approval
            </Badge>
          );
        }
      }
    }

    if (item.item_type === "manual_approval") {
      if (isUpline && status === "not_started") {
        return (
          <button
            onClick={() => handleApprove(item.id)}
            className="inline-flex items-center gap-1 text-success hover:text-success dark:hover:text-success font-medium transition-colors text-sm"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>
        );
      }
    }

    if (item.item_type === "training_module") {
      if (
        item.external_link &&
        status !== "completed" &&
        status !== "approved"
      ) {
        return (
          <Button size="sm" variant="outline" asChild className="h-8">
            <a
              href={item.external_link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              View Training
            </a>
          </Button>
        );
      }
    }

    // Handle scheduling_booking items
    if (item.item_type === "scheduling_booking") {
      const metadata = item.metadata as SchedulingChecklistMetadata | null;

      if (!metadata) {
        return (
          <Badge
            variant="outline"
            className="text-sm text-warning bg-warning/10 dark:text-warning dark:bg-warning/15"
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            Not Configured
          </Badge>
        );
      }

      const bookingUrl = getBookingUrl(metadata);
      const SchedulingIcon = getSchedulingIcon(metadata.scheduling_type);

      // If already completed or approved, show completed badge
      if (status === "completed" || status === "approved") {
        return (
          <Badge
            variant="outline"
            className="text-sm text-success bg-success/10 dark:text-success dark:bg-success/15"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Booked
          </Badge>
        );
      }

      // If no booking URL available
      if (!bookingUrl) {
        return (
          <Badge
            variant="outline"
            className="text-sm text-warning bg-warning/10 dark:text-warning dark:bg-warning/15"
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            No Link Available
          </Badge>
        );
      }

      // Show Book Now button that opens modal
      // All data comes from metadata (captured at config time), not from integration lookup
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() =>
            setSchedulingModalData({
              open: true,
              itemId: item.id,
              itemName: item.item_name,
              integrationType: metadata.scheduling_type,
              bookingUrl,
              instructions: metadata.instructions,
              meetingId: metadata.meeting_id,
              passcode: metadata.passcode,
            })
          }
        >
          <SchedulingIcon className="h-4 w-4 mr-1.5" />
          Book Now
        </Button>
      );
    }

    return null;
  };

  // Render interactive component based on item type
  const renderInteractiveComponent = (
    item: PhaseChecklistItem,
    progress: RecruitChecklistProgress | undefined,
    isDisabled: boolean,
  ) => {
    if (!INTERACTIVE_ITEM_TYPES.has(item.item_type)) return null;
    if (!progress?.id) return null;

    const responseData = progress?.response_data;
    const onComplete = () => {
      // The mutation will invalidate the query and trigger a refetch
      // No additional action needed here
    };

    switch (item.item_type) {
      case "video_embed":
        return (
          <VideoEmbedItem
            progressId={progress.id}
            metadata={item.metadata as VideoEmbedMetadata}
            existingResponse={responseData as VideoEmbedResponse | null}
            isDisabled={isDisabled}
            onComplete={onComplete}
          />
        );
      case "boolean_question":
        return (
          <BooleanQuestionItem
            progressId={progress.id}
            metadata={item.metadata as BooleanQuestionMetadata}
            existingResponse={responseData as BooleanQuestionResponse | null}
            onComplete={onComplete}
          />
        );
      case "acknowledgment":
        return (
          <AcknowledgmentItem
            progressId={progress.id}
            metadata={item.metadata as AcknowledgmentMetadata}
            existingResponse={responseData as AcknowledgmentResponse | null}
            onComplete={onComplete}
          />
        );
      case "text_response":
        return (
          <TextResponseItem
            progressId={progress.id}
            metadata={item.metadata as TextResponseMetadata}
            existingResponse={responseData as TextResponseData | null}
            onComplete={onComplete}
          />
        );
      case "multiple_choice":
        return (
          <MultipleChoiceItem
            progressId={progress.id}
            metadata={item.metadata as MultipleChoiceMetadata}
            existingResponse={responseData as MultipleChoiceResponse | null}
            onComplete={onComplete}
          />
        );
      case "file_download":
        return (
          <FileDownloadItem
            progressId={progress.id}
            metadata={item.metadata as FileDownloadMetadata}
            existingResponse={responseData as FileDownloadResponse | null}
            onComplete={onComplete}
          />
        );
      case "external_link":
        return (
          <ExternalLinkItem
            progressId={progress.id}
            metadata={item.metadata as ExternalLinkMetadata}
            existingResponse={responseData as ExternalLinkResponse | null}
            onComplete={onComplete}
          />
        );
      case "quiz":
        return (
          <QuizItem
            progressId={progress.id}
            metadata={item.metadata as QuizMetadata}
            existingResponse={responseData as QuizResponse | null}
            onComplete={onComplete}
          />
        );
      case "signature_required": {
        const signatureMetadata =
          item.metadata as SignatureRequiredMetadata | null;
        // Guard against null/incomplete metadata
        if (
          !signatureMetadata ||
          !signatureMetadata.template_id ||
          !signatureMetadata.required_signer_roles
        ) {
          return (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <div className="flex items-center gap-2 text-warning">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Signature item not configured
                </span>
              </div>
              <p className="text-xs text-warning mt-1">
                This item requires admin configuration before it can be used.
              </p>
            </div>
          );
        }
        return (
          <SignatureRequiredItem
            progressId={progress.id}
            metadata={signatureMetadata}
            existingResponse={responseData as SignatureResponse | null}
            recruitId={userId}
            recruitEmail={recruitEmail || ""}
            recruitName={recruitName || ""}
            onComplete={() => handleMarkInProgress(item.id)}
          />
        );
      }
      case "carrier_contracting": {
        const contractingMetadata =
          item.metadata as CarrierContractingMetadata | null;
        if (!contractingMetadata) {
          return (
            <div className="flex items-center gap-2 text-xs text-warning">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Carrier contracting item not configured</span>
            </div>
          );
        }
        return (
          <CarrierContractingItem
            progressId={progress.id}
            metadata={contractingMetadata}
            existingResponse={responseData as CarrierContractingResponse | null}
            recruitId={userId}
            isUpline={isUpline}
            onComplete={onComplete}
          />
        );
      }
      default:
        return null;
    }
  };

  if (sortedItems.length === 0) {
    // If recruit has no visible items but there are hidden blocking items
    if (isRecruitViewer && hasHiddenBlockingItems) {
      return (
        <div className="py-8 text-center">
          <Clock className="h-10 w-10 text-warning dark:text-warning mx-auto mb-3" />
          <p className="text-sm font-medium text-v2-ink-muted mb-1">
            Waiting for Admin Action
          </p>
          <p className="text-xs text-v2-ink-muted">
            Some required items must be completed by your recruiter or admin.
          </p>
        </div>
      );
    }
    return (
      <div className="py-8 text-center">
        <FileText className="h-10 w-10 text-v2-ink-subtle mx-auto mb-3" />
        <p className="text-sm text-v2-ink-muted">
          No checklist items for this phase
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Show waiting message for recruits when hidden items block progress */}
      {isRecruitViewer && hasHiddenBlockingItems && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning flex-shrink-0" />
          <p className="text-sm text-warning">
            Some required items are pending admin action. Continue with
            available tasks.
          </p>
        </div>
      )}
      {sortedItems.map((item) => {
        const progress = progressMap.get(item.id);
        const status = progress?.status || "not_started";
        const isCompleted = status === "completed" || status === "approved";
        const isRejected = status === "rejected";
        const checkboxState = getCheckboxState(item, status, sortedItems);

        return (
          <div
            key={item.id}
            className={`py-1 px-2 border-l-2 transition-colors ${
              isCompleted
                ? "border-l-emerald-500 bg-success/10/30 dark:bg-success/10/10"
                : isRejected
                  ? "border-l-red-500 bg-destructive/10/30 dark:bg-destructive/10/10"
                  : checkboxState.isEnabled
                    ? "border-l-blue-500 hover:bg-v2-canvas"
                    : "border-l-v2-ring bg-v2-canvas/50 opacity-60 /30"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                {item.item_type === "document_upload" ? (
                  status === "approved" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : status === "in_progress" ? (
                    <Clock className="h-4 w-4 text-warning" />
                  ) : status === "rejected" ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Upload className="h-4 w-4 text-v2-ink-subtle" />
                  )
                ) : loadingItemIds.has(item.id) ? (
                  <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
                ) : (
                  <Checkbox
                    checked={isCompleted}
                    disabled={!checkboxState.isEnabled}
                    onCheckedChange={() => {
                      if (checkboxState.isEnabled) {
                        handleToggleComplete(item.id, status);
                      }
                    }}
                    className="h-4 w-4"
                  />
                )}
                {item.item_type !== "document_upload" &&
                  !checkboxState.isEnabled &&
                  !loadingItemIds.has(item.id) && (
                    <div className="absolute -top-0.5 -right-0.5">
                      <Lock className="h-2.5 w-2.5 text-v2-ink-subtle" />
                    </div>
                  )}
              </div>

              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium ${isCompleted ? "line-through text-v2-ink-muted" : "text-v2-ink"}`}
                >
                  {item.item_name}
                </span>
                {item.is_required && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5 border-v2-ring text-v2-ink-muted flex-shrink-0"
                  >
                    Req
                  </Badge>
                )}
                {!isRecruitViewer && isHiddenFromRecruit(item) && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5 border-warning/40 text-warning flex-shrink-0"
                  >
                    <EyeOff className="h-2.5 w-2.5 mr-0.5" />
                    Hidden
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 ${CHECKLIST_STATUS_COLORS[status]}`}
                >
                  {status.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="flex-shrink-0">
                {getActionButton(item, progress)}
              </div>
            </div>

            {/* All additional content outside main row */}
            {item.item_description && (
              <p className="text-xs text-v2-ink-muted mt-1 ml-6">
                {item.item_description}
              </p>
            )}

            {/* Scheduling instructions */}
            {item.item_type === "scheduling_booking" &&
              (item.metadata as SchedulingChecklistMetadata | null)
                ?.instructions && (
                <p className="text-xs text-info ml-6 mt-1">
                  {(item.metadata as SchedulingChecklistMetadata).instructions}
                </p>
              )}

            {/* Interactive component - compact */}
            {INTERACTIVE_ITEM_TYPES.has(item.item_type) && (
              <div className="mt-1 ml-6">
                {renderInteractiveComponent(
                  item,
                  progress,
                  !checkboxState.isEnabled,
                )}
              </div>
            )}

            {/* Disabled reason - inline */}
            {!checkboxState.isEnabled &&
              checkboxState.disabledReason &&
              checkboxState.disabledReason !== "Use upload button" && (
                <p className="text-[10px] text-v2-ink-muted ml-6 mt-0.5">
                  <AlertCircle className="h-2.5 w-2.5 inline mr-0.5" />
                  {checkboxState.disabledReason}
                </p>
              )}

            {/* Rejection reason - compact */}
            {progress?.rejection_reason && (
              <p className="text-[10px] text-destructive ml-6 mt-0.5">
                <strong>Rejected:</strong> {progress.rejection_reason}
              </p>
            )}

            {/* Notes - compact */}
            {progress?.notes && !progress.rejection_reason && (
              <p className="text-[10px] text-v2-ink-muted italic ml-6 mt-0.5">
                {progress.notes}
              </p>
            )}

            {/* Completed timestamp - inline with icon */}
            {progress?.completed_at && (
              <span className="text-[10px] text-v2-ink-subtle ml-6 block">
                {new Date(progress.completed_at).toLocaleDateString("en-US", {
                  month: "numeric",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        );
      })}

      {/* Document Viewer Dialog (upline view) */}
      {viewerDoc && (
        <DocumentViewerDialog
          open={!!viewerDoc}
          onOpenChange={(open) => !open && setViewerDoc(null)}
          document={viewerDoc}
        />
      )}

      {/* Document Upload Dialog */}
      {uploadDialogItemId && currentUserId && (
        <UploadDocumentDialog
          open={!!uploadDialogItemId}
          onOpenChange={(open) => !open && setUploadDialogItemId(null)}
          userId={userId}
          uploadedBy={currentUserId}
          onSuccess={(documentId) =>
            handleMarkInProgress(uploadDialogItemId, documentId)
          }
        />
      )}

      {/* Scheduling Booking Modal */}
      {schedulingModalData && (
        <SchedulingBookingModal
          open={schedulingModalData.open}
          onClose={() => setSchedulingModalData(null)}
          integrationType={schedulingModalData.integrationType}
          bookingUrl={schedulingModalData.bookingUrl}
          itemName={schedulingModalData.itemName}
          instructions={schedulingModalData.instructions}
          meetingId={schedulingModalData.meetingId}
          passcode={schedulingModalData.passcode}
          onBookingComplete={() => {
            // Optionally mark the item as complete
            // For now, just close the modal - user can manually mark complete
          }}
        />
      )}
    </div>
  );
}
