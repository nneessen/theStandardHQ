// src/features/underwriting/components/CriteriaReview/ReviewStatusBadge.tsx
// Shared component for displaying review status badges

import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReviewStatus } from "../../types/underwriting.types";

interface ReviewStatusBadgeProps {
  status: ReviewStatus | string | null;
  isActive?: boolean | null;
  /** Show icons in badge (default: true for list view, false for detail view) */
  showIcon?: boolean;
}

/**
 * Displays a color-coded badge for review status.
 * Used in both list views (with icons) and detail views (without icons).
 */
export function ReviewStatusBadge({
  status,
  isActive,
  showIcon = true,
}: ReviewStatusBadgeProps) {
  // Active criteria takes precedence
  if (isActive) {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] px-1.5 py-0">
        {showIcon && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
        Active
      </Badge>
    );
  }

  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[9px] px-1.5 py-0">
          {showIcon && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[9px] px-1.5 py-0">
          {showIcon && <XCircle className="h-2.5 w-2.5 mr-1" />}
          Rejected
        </Badge>
      );
    case "needs_revision":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] px-1.5 py-0">
          {showIcon && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
          {showIcon ? "Revision" : "Needs Revision"}
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge className="bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle text-[9px] px-1.5 py-0">
          {showIcon && <Clock className="h-2.5 w-2.5 mr-1" />}
          {showIcon ? "Pending" : "Pending Review"}
        </Badge>
      );
  }
}
