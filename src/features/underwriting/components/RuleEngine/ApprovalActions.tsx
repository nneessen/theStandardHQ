// src/features/underwriting/components/RuleEngine/ApprovalActions.tsx
// Status-based approval workflow buttons

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Send,
  Edit3,
  Loader2,
  AlertCircle,
} from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type { RuleReviewStatus } from "@/services/underwriting/repositories/ruleService";

// ============================================================================
// Types
// ============================================================================

interface ApprovalActionsProps {
  status: RuleReviewStatus;
  createdBy?: string;
  currentUserId?: string;
  isSuperAdmin?: boolean;
  onSubmitForReview: () => Promise<void>;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (notes: string) => Promise<void>;
  onRevertToDraft: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

// ============================================================================
// Status Badge Component
// ============================================================================

const STATUS_CONFIG: Record<
  RuleReviewStatus,
  {
    label: string;
    variant: "default" | "secondary" | "success" | "warning" | "destructive";
  }
> = {
  draft: { label: "Draft", variant: "secondary" },
  pending_review: { label: "Pending Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function StatusBadge({ status }: { status: RuleReviewStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className="text-[10px] h-5">
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ApprovalActions({
  status,
  createdBy: _createdBy,
  currentUserId: _currentUserId,
  isSuperAdmin,
  onSubmitForReview,
  onApprove,
  onReject,
  onRevertToDraft,
  isLoading,
  disabled,
}: ApprovalActionsProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  // Self-approval check disabled - single user system, owner can approve everything
  const isSelfApproval = false;

  // Handle reject submission
  const handleReject = async () => {
    if (!rejectNotes.trim()) return;
    await onReject(rejectNotes);
    setShowRejectDialog(false);
    setRejectNotes("");
  };

  return (
    <div className="flex items-center gap-2">
      {/* Status Badge */}
      <StatusBadge status={status} />

      {/* Action Buttons Based on Status */}
      {status === "draft" && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSubmitForReview}
            disabled={isLoading || disabled}
            className="h-6 px-2 text-[10px]"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Send className="h-3 w-3 mr-1" />
            )}
            Submit for Review
          </Button>
          {/* Super-admins can approve directly from draft */}
          {isSuperAdmin && (
            <Button
              type="button"
              variant="success"
              size="sm"
              onClick={() => onApprove()}
              disabled={isLoading || disabled}
              className="h-6 px-2 text-[10px]"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              Quick Approve
            </Button>
          )}
        </div>
      )}

      {status === "pending_review" && (
        <>
          {isSelfApproval ? (
            <div className="flex items-center gap-1 text-[10px] text-warning">
              <AlertCircle className="h-3 w-3" />
              Cannot approve own rule set
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="success"
                size="sm"
                onClick={() => onApprove()}
                disabled={isLoading || disabled}
                className="h-6 px-2 text-[10px]"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                )}
                Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowRejectDialog(true)}
                disabled={isLoading || disabled}
                className="h-6 px-2 text-[10px]"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </>
          )}
        </>
      )}

      {status === "approved" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRevertToDraft}
          disabled={isLoading || disabled}
          className="h-6 px-2 text-[10px]"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Edit3 className="h-3 w-3 mr-1" />
          )}
          Edit as New Draft
        </Button>
      )}

      {status === "rejected" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRevertToDraft}
          disabled={isLoading || disabled}
          className="h-6 px-2 text-[10px]"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Edit3 className="h-3 w-3 mr-1" />
          )}
          Edit Draft
        </Button>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md p-3">
          <DialogHeader className="space-y-1 pb-2">
            <DialogTitle className="text-sm font-semibold">
              Reject Rule Set
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
              Rejection Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              className="h-24 text-[11px] resize-none"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Explain why this rule set is being rejected..."
            />
          </div>

          <DialogFooter className="pt-3 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRejectDialog(false)}
              className="h-6 text-[10px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={!rejectNotes.trim() || isLoading}
              className="h-6 text-[10px]"
            >
              {isLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
