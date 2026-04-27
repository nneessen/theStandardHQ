// src/features/underwriting/components/CriteriaReview/ApprovalDialog.tsx

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  User,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge as _Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateCriteriaReview } from "../../hooks/criteria/useExtractCriteria";
import { ReviewStatusBadge } from "./ReviewStatusBadge";
import type {
  CriteriaWithRelations,
  ReviewStatus,
} from "../../types/underwriting.types";

interface ApprovalDialogProps {
  criteria: CriteriaWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ReviewAction = "approve" | "reject" | "revision";

const actionConfig: Record<
  ReviewAction,
  {
    status: ReviewStatus;
    title: string;
    description: string;
    buttonText: string;
    buttonClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  approve: {
    status: "approved",
    title: "Approve Criteria",
    description:
      "This will activate the criteria and make it available for underwriting decisions.",
    buttonText: "Approve & Activate",
    buttonClass: "bg-green-600 hover:bg-green-700 text-white",
    icon: CheckCircle2,
  },
  reject: {
    status: "rejected",
    title: "Reject Criteria",
    description:
      "This will mark the criteria as rejected. You can re-extract from the guide if needed.",
    buttonText: "Reject",
    buttonClass: "bg-red-600 hover:bg-red-700 text-white",
    icon: XCircle,
  },
  revision: {
    status: "needs_revision",
    title: "Request Revision",
    description:
      "This will mark the criteria as needing revision. Add notes to describe what needs to be changed.",
    buttonText: "Request Revision",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
    icon: AlertTriangle,
  },
};

export function ApprovalDialog({
  criteria,
  open,
  onOpenChange,
  onSuccess,
}: ApprovalDialogProps) {
  const { user } = useAuth();
  const updateMutation = useUpdateCriteriaReview();

  const [selectedAction, setSelectedAction] = useState<ReviewAction | null>(
    null,
  );
  const [notes, setNotes] = useState("");

  const handleClose = () => {
    setSelectedAction(null);
    setNotes("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!criteria || !selectedAction) return;

    const config = actionConfig[selectedAction];

    try {
      await updateMutation.mutateAsync({
        criteriaId: criteria.id,
        reviewStatus: config.status,
        reviewNotes: notes || undefined,
        reviewerId: user?.id,
      });
      handleClose();
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  if (!criteria) return null;

  const config = selectedAction ? actionConfig[selectedAction] : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Review Criteria</DialogTitle>
          <DialogDescription className="text-[11px]">
            {criteria.carrier?.name} - {criteria.guide?.name}
          </DialogDescription>
        </DialogHeader>

        {/* Review Info */}
        {criteria.reviewed_at && (
          <div className="bg-v2-canvas dark:bg-v2-card-tinted/50 rounded-md p-2.5 text-[10px] space-y-1">
            <div className="flex items-center gap-1.5 text-v2-ink-muted dark:text-v2-ink-subtle">
              <User className="h-3 w-3" />
              <span>
                Last reviewed by:{" "}
                <span className="font-medium text-v2-ink dark:text-v2-ink">
                  {criteria.reviewer?.full_name || "Unknown"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-v2-ink-muted dark:text-v2-ink-subtle">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(criteria.reviewed_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {criteria.review_notes && (
              <div className="mt-2 pt-2 border-t border-v2-ring dark:border-v2-ring-strong">
                <p className="text-v2-ink-muted dark:text-v2-ink-muted italic">
                  "{criteria.review_notes}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Current Status */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-v2-ink-muted">Current status:</span>
          <ReviewStatusBadge status={criteria.review_status as ReviewStatus} />
        </div>

        {/* Action Selection */}
        {!selectedAction ? (
          <div className="space-y-2">
            <Label className="text-[10px] text-v2-ink-muted">
              Choose action:
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                onClick={() => setSelectedAction("approve")}
              >
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-[10px] font-medium">Approve</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                onClick={() => setSelectedAction("revision")}
              >
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-[10px] font-medium">Revision</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => setSelectedAction("reject")}
              >
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-[10px] font-medium">Reject</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Selected Action */}
            <div className="flex items-center gap-2 p-2 bg-v2-canvas dark:bg-v2-card-tinted/50 rounded-md">
              {config && <config.icon className="h-4 w-4" />}
              <div>
                <p className="text-[11px] font-medium">{config?.title}</p>
                <p className="text-[10px] text-v2-ink-muted">
                  {config?.description}
                </p>
              </div>
            </div>

            {/* Notes Input */}
            <div className="space-y-1.5">
              <Label htmlFor="review-notes" className="text-[10px]">
                Review Notes{" "}
                {selectedAction === "revision" && (
                  <span className="text-red-500">*</span>
                )}
              </Label>
              <Textarea
                id="review-notes"
                placeholder={
                  selectedAction === "revision"
                    ? "Describe what needs to be changed..."
                    : "Optional notes about this decision..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px] text-[11px] resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {selectedAction ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setSelectedAction(null)}
              >
                Back
              </Button>
              <Button
                size="sm"
                className={`h-7 text-[11px] ${config?.buttonClass}`}
                onClick={handleSubmit}
                disabled={
                  updateMutation.isPending ||
                  (selectedAction === "revision" && !notes.trim())
                }
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  config?.buttonText
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleClose}
            >
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
