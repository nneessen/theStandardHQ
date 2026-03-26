// src/features/close-kpi/components/skeletons/WidgetSkeleton.tsx

import React from "react";
import type { WidgetSize } from "../../types/close-kpi.types";

interface WidgetSkeletonProps {
  size?: WidgetSize;
}

export const WidgetSkeleton: React.FC<WidgetSkeletonProps> = ({
  size = "medium",
}) => {
  const heightClass =
    size === "small" ? "h-24" : size === "medium" ? "h-48" : "h-64";

  return (
    <div
      className={`animate-pulse rounded-lg border border-border bg-card p-2 ${heightClass}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-3 w-8 rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-muted/60" />
        <div className="h-2 w-3/4 rounded bg-muted/60" />
        <div className="h-2 w-1/2 rounded bg-muted/60" />
      </div>
    </div>
  );
};
