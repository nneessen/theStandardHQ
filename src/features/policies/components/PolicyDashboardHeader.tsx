// src/features/policies/components/PolicyDashboardHeader.tsx

import React from "react";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PolicyDashboardHeaderProps {
  summary: {
    totalPolicies: number;
    activePolicies: number;
    pendingPolicies: number;
    totalAnnualPremium: number;
    totalPaidCommission: number;
    totalPendingCommission: number;
    dateRangeLabel?: string;
  };
  onNewPolicy: () => void;
}

/**
 * Header component for PolicyDashboard with summary statistics
 * Displays inline metrics in compact zinc-styled layout
 */
export const PolicyDashboardHeader: React.FC<PolicyDashboardHeaderProps> = ({
  summary,
  onNewPolicy,
}) => {
  return (
    <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring dark:border-v2-ring">
      {/* Title */}
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-v2-ink dark:text-v2-ink" />
        <h1 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
          Policy Management
        </h1>
      </div>

      {/* Inline Stats with Dividers */}
      <div className="flex items-center gap-3 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {summary.totalPolicies}
          </span>
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            total
          </span>
        </div>
        <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {summary.activePolicies}
          </span>
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            active
          </span>
        </div>
        <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-warning" />
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {summary.pendingPolicies}
          </span>
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            pending
          </span>
        </div>
        <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
        <div className="flex items-center gap-1">
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            ${(summary.totalAnnualPremium / 1000).toFixed(1)}K
          </span>
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            premium
          </span>
        </div>
        <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
        <div className="flex items-center gap-1">
          <span className="font-medium text-success">
            ${(summary.totalPaidCommission / 1000).toFixed(1)}K
          </span>
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            paid
          </span>
        </div>
        <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
        <div className="flex items-center gap-1">
          <span className="font-medium text-info">
            ${(summary.totalPendingCommission / 1000).toFixed(1)}K
          </span>
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            pending comm
          </span>
        </div>
        {summary.dateRangeLabel && (
          <>
            <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
            <span className="text-[9px] px-1.5 py-0.5 bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink-muted dark:text-v2-ink-subtle rounded">
              {summary.dateRangeLabel}
            </span>
          </>
        )}
      </div>

      {/* New Policy Button */}
      <Button onClick={onNewPolicy} size="sm" className="h-6 text-[10px] px-2">
        <Plus className="h-3 w-3 mr-1" />
        New Policy
      </Button>
    </div>
  );
};
