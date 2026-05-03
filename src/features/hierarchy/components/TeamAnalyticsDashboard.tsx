// src/features/hierarchy/components/TeamAnalyticsDashboard.tsx

import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamAnalyticsData } from "@/hooks/analytics";
import {
  TeamCarriersProductsBreakdown,
  TeamProductMatrix,
  TeamPolicyStatusBreakdown,
  TeamGeographicAnalysis,
  TeamAgentSegments,
} from "./analytics";

interface TeamAnalyticsDashboardProps {
  /** Start date for analytics data (ISO string) */
  startDate: string;
  /** End date for analytics data (ISO string) */
  endDate: string;
  /**
   * Optional array of team user IDs to use for analytics.
   * If provided, ensures consistency with AgentTable.
   * Should include owner + all downlines.
   */
  teamUserIds?: string[];
}

/**
 * TeamAnalyticsDashboard - Container for team analytics sections
 *
 * Embeds below the AgentTable on the Team Hierarchy page.
 * Uses server-side aggregation via useTeamAnalyticsData hook.
 *
 * Sections:
 * 1. Pace Metrics - Written AP, projections, pacing
 * 2. Carriers & Products - Distribution by carrier
 * 3. Product Matrix - Product mix breakdown
 * 4. Policy Status - Active/pending/lapsed/cancelled with persistency
 * 5. Geographic - Premium by agent state
 * 6. Agent Segments - Top/solid/needs attention breakdown
 */
export function TeamAnalyticsDashboard({
  startDate,
  endDate,
  teamUserIds: providedTeamUserIds,
}: TeamAnalyticsDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch team analytics data (use provided teamUserIds if available for consistency with AgentTable)
  const {
    isLoading,
    isError,
    agentSegmentation,
    policyStatus,
    geographicBreakdown,
    carrierBreakdown,
    teamUserIds,
  } = useTeamAnalyticsData({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    enabled: true,
    teamUserIds: providedTeamUserIds,
  });

  // Don't render if no team (just the current user)
  if (teamUserIds.length <= 1 && !isLoading) {
    return null;
  }

  if (isError) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-3">
        <div className="text-center text-[11px] text-destructive">
          Failed to load team analytics. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring">
      {/* Collapsible Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-v2-ring cursor-pointer hover:bg-v2-canvas"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-v2-ink" />
          <div>
            <h2 className="text-sm font-semibold text-v2-ink">
              Team Analytics
            </h2>
            <p className="text-[10px] text-v2-ink-muted">
              {teamUserIds.length} team members • Performance metrics
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-v2-ink-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-v2-ink-muted" />
          )}
        </Button>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-3">
          {isLoading ? (
            <div className="p-4 text-center text-[11px] text-v2-ink-muted">
              Loading team analytics...
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-2">
              {/* 1. Carriers & Products Breakdown */}
              <TeamCarriersProductsBreakdown
                data={carrierBreakdown}
                isLoading={isLoading}
              />

              {/* 3. Product Mix */}
              <TeamProductMatrix
                data={carrierBreakdown}
                isLoading={isLoading}
              />

              {/* 4. Policy Status Breakdown */}
              <TeamPolicyStatusBreakdown
                data={policyStatus}
                isLoading={isLoading}
              />

              {/* 5. Premium by State */}
              <TeamGeographicAnalysis
                data={geographicBreakdown}
                isLoading={isLoading}
              />

              {/* 6. Agent Segments */}
              <TeamAgentSegments
                data={agentSegmentation}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-3 px-2 py-1 text-[10px] text-v2-ink-subtle text-center">
            Team data aggregated from {teamUserIds.length} agents
          </div>
        </div>
      )}
    </div>
  );
}
