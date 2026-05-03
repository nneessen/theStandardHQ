// src/features/training-modules/components/presentations/PresentationStatusBadge.tsx
import type { PresentationStatus } from "../../types/training-module.types";

const STATUS_CONFIG: Record<
  PresentationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending Review",
    className:
      "bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning",
  },
  approved: {
    label: "Approved",
    className:
      "bg-success/20 text-success dark:bg-success/30 dark:text-success",
  },
  needs_improvement: {
    label: "Needs Improvement",
    className:
      "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
  },
};

interface PresentationStatusBadgeProps {
  status: PresentationStatus;
}

export function PresentationStatusBadge({
  status,
}: PresentationStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
