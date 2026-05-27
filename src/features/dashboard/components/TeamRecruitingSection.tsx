// src/features/dashboard/components/TeamRecruitingSection.tsx

import React from "react";
import { cn } from "@/lib/utils";
import { Lock, Users, UserPlus, Bell } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { HierarchyStats } from "@/types/hierarchy.types";
import type { RecruitingStats } from "@/hooks";
import { useActiveTemplate, usePhases } from "@/features/recruiting";
import { normalizePhaseNameToStatus } from "@/lib/pipeline";
import { NEW_SUBSCRIPTIONS_ENABLED } from "@/lib/subscription/subscription-availability";

interface TeamRecruitingSectionProps {
  hierarchyStats?: HierarchyStats | null;
  recruitingStats?: RecruitingStats | null;
  unreadNotifications: number;
  unreadMessages: number;
  hasAccess: boolean;
}

interface MetricItemProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

const MetricItem: React.FC<MetricItemProps> = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center text-[11px] py-0.5">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={cn(
        "font-mono font-semibold",
        highlight ? "text-[hsl(var(--success))]" : "text-foreground",
      )}
    >
      {value}
    </span>
  </div>
);

/**
 * Team Details Panel - Left column (smaller)
 */
const TeamDetailsPanel: React.FC<{
  hierarchyStats?: HierarchyStats | null;
}> = ({ hierarchyStats }) => (
  <div className="bg-card rounded-lg border border-border p-3 h-full">
    <div className="flex items-center gap-1.5 mb-2">
      <Users className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Team Details
      </span>
    </div>
    <div className="space-y-0.5">
      <MetricItem
        label="Direct Downlines"
        value={hierarchyStats?.direct_downlines ?? 0}
      />
      <MetricItem
        label="Total Team Size"
        value={hierarchyStats?.total_downlines ?? 0}
      />
      <MetricItem label="Team Depth" value={hierarchyStats?.max_depth ?? 0} />
      <div className="border-t border-border my-1.5" />
      <MetricItem
        label="Override MTD"
        value={formatCurrency(hierarchyStats?.total_override_income_mtd ?? 0)}
        highlight={(hierarchyStats?.total_override_income_mtd ?? 0) > 0}
      />
      <MetricItem
        label="Override YTD"
        value={formatCurrency(hierarchyStats?.total_override_income_ytd ?? 0)}
        highlight={(hierarchyStats?.total_override_income_ytd ?? 0) > 0}
      />
    </div>
  </div>
);

/**
 * Recruiting Pipeline Panel - Middle column (larger)
 */
const RecruitingPipelinePanel: React.FC<{
  recruitingStats?: RecruitingStats | null;
}> = ({ recruitingStats }) => {
  // Fetch phases from active pipeline template (dynamic, not hardcoded)
  const { data: activeTemplate } = useActiveTemplate();
  const { data: pipelinePhases = [] } = usePhases(activeTemplate?.id);

  // Build phases array from database
  const phases = pipelinePhases.map((phase) => ({
    key: normalizePhaseNameToStatus(phase.phase_name),
    label: phase.phase_name,
  }));

  return (
    <div className="bg-card rounded-lg border border-border p-3 h-full">
      <div className="flex items-center gap-1.5 mb-2">
        <UserPlus className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Recruiting Pipeline
        </span>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
        <div className="text-center">
          <div className="text-base sm:text-lg font-bold text-foreground">
            {recruitingStats?.total ?? 0}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Total
          </div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-bold text-[hsl(var(--info))]">
            {recruitingStats?.active ?? 0}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Active
          </div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-bold text-[hsl(var(--success))]">
            {recruitingStats?.completed ?? 0}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Completed
          </div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-bold text-muted-foreground">
            {recruitingStats?.dropped ?? 0}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">
            Dropped
          </div>
        </div>
      </div>

      {/* Phase Breakdown */}
      <div className="border-t border-border pt-2">
        <div className="text-[9px] text-muted-foreground/70 uppercase mb-1.5">
          By Phase
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-2 sm:gap-x-3 gap-y-0.5">
          {phases.map((phase) => (
            <div
              key={phase.key}
              className="flex justify-between items-center text-[10px]"
            >
              <span className="text-muted-foreground truncate">
                {phase.label}
              </span>
              <span className="font-mono font-medium text-foreground ml-1">
                {recruitingStats?.byPhase?.[phase.key] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Messages & Notifications Panel - Right column (smaller)
 */
const MessagesNotificationsPanel: React.FC<{
  unreadNotifications: number;
  unreadMessages: number;
}> = ({ unreadNotifications, unreadMessages }) => (
  <div className="bg-card rounded-lg border border-border p-3 h-full">
    <div className="flex items-center gap-1.5 mb-2">
      <Bell className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Communications
      </span>
    </div>
    <div className="space-y-2">
      {/* Unread Notifications */}
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
        <div>
          <div className="text-[10px] text-muted-foreground">Notifications</div>
          <div className="text-xs font-medium text-foreground">Unread</div>
        </div>
        <div
          className={cn(
            "text-xl font-bold",
            unreadNotifications > 0
              ? "text-[hsl(var(--warning))]"
              : "text-muted-foreground",
          )}
        >
          {unreadNotifications}
        </div>
      </div>

      {/* Unread Messages */}
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
        <div>
          <div className="text-[10px] text-muted-foreground">Messages</div>
          <div className="text-xs font-medium text-foreground">Unread</div>
        </div>
        <div
          className={cn(
            "text-xl font-bold",
            unreadMessages > 0
              ? "text-[hsl(var(--info))]"
              : "text-muted-foreground",
          )}
        >
          {unreadMessages}
        </div>
      </div>
    </div>
  </div>
);

/**
 * Team & Recruiting Section - Premium gated 3-column layout
 */
export const TeamRecruitingSection: React.FC<TeamRecruitingSectionProps> = ({
  hierarchyStats,
  recruitingStats,
  unreadNotifications,
  unreadMessages,
  hasAccess,
}) => {
  const content = (
    <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-[260px_1fr_280px]">
      <TeamDetailsPanel hierarchyStats={hierarchyStats} />
      <RecruitingPipelinePanel recruitingStats={recruitingStats} />
      <div className="md:col-span-2 lg:col-span-1">
        <MessagesNotificationsPanel
          unreadNotifications={unreadNotifications}
          unreadMessages={unreadMessages}
        />
      </div>
    </div>
  );

  if (!hasAccess) {
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none opacity-50">
          {content}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
          <div className="text-center p-4">
            <Lock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <div className="text-sm font-medium text-foreground">
              Team & Recruiting
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {NEW_SUBSCRIPTIONS_ENABLED
                ? "Upgrade to Team plan to access"
                : "Not included in your current plan."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return content;
};
