// src/features/training-modules/components/presentations/PresentationReviewPanel.tsx
import { useState } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviewPresentation } from "../../hooks/usePresentationSubmissions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PresentationSubmission } from "../../types/training-module.types";

interface PresentationReviewPanelProps {
  submission: PresentationSubmission;
  onReviewed?: () => void;
}

export function PresentationReviewPanel({
  submission,
  onReviewed,
}: PresentationReviewPanelProps) {
  const { user } = useAuth();
  const reviewMutation = useReviewPresentation();
  const [notes, setNotes] = useState("");

  const handleReview = (status: "approved" | "needs_improvement") => {
    if (!user?.id) return;
    reviewMutation.mutate(
      { id: submission.id, status, reviewerNotes: notes || undefined },
      {
        onSuccess: () => {
          toast.success(
            status === "approved" ? "Presentation approved" : "Feedback sent",
          );
          onReviewed?.();
        },
        onError: (err) => {
          toast.error(`Review failed: ${err.message}`);
        },
      },
    );
  };

  // Already reviewed — show review info
  if (submission.status !== "pending") {
    return (
      <div className="rounded-lg border border-v2-ring dark:border-v2-ring-strong p-3 space-y-2">
        <h3 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink-muted uppercase">
          Review
        </h3>
        <div className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle">
          <span className="font-medium">
            {submission.status === "approved"
              ? "Approved"
              : "Needs Improvement"}
          </span>
          {submission.reviewer && (
            <span>
              {" "}
              by {submission.reviewer.first_name}{" "}
              {submission.reviewer.last_name}
            </span>
          )}
          {submission.reviewed_at && (
            <span className="text-v2-ink-subtle">
              {" "}
              &middot; {new Date(submission.reviewed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {submission.reviewer_notes && (
          <p className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle italic">
            {submission.reviewer_notes}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-v2-ring dark:border-v2-ring-strong p-3 space-y-2">
      <h3 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink-muted uppercase">
        Review This Presentation
      </h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Add feedback notes (optional)..."
        className="w-full text-xs rounded-md border border-v2-ring dark:border-v2-ring-strong bg-v2-card p-2 resize-none"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-[11px] bg-success hover:bg-success"
          onClick={() => handleReview("approved")}
          disabled={reviewMutation.isPending}
        >
          {reviewMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <CheckCircle className="h-3 w-3 mr-1" />
          )}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] border-warning/40 text-warning hover:bg-warning/10 dark:border-warning dark:text-warning"
          onClick={() => handleReview("needs_improvement")}
          disabled={reviewMutation.isPending}
        >
          {reviewMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <AlertCircle className="h-3 w-3 mr-1" />
          )}
          Needs Improvement
        </Button>
      </div>
    </div>
  );
}
