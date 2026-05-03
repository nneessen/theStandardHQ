// src/features/hierarchy/components/analytics/TeamAgentSegments.tsx

import React from "react";
import { cn } from "@/lib/utils";
import type { AgentSegmentationSummary } from "@/types/team-analytics.types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, TrendingUp, AlertTriangle } from "lucide-react";

interface TeamAgentSegmentsProps {
  data: AgentSegmentationSummary | null;
  isLoading?: boolean;
}

/**
 * TeamAgentSegments - Agent performance segmentation
 *
 * Replaces ClientSegmentation for team context.
 * Segments agents into top performers, solid performers, and needs attention.
 */
export function TeamAgentSegments({ data, isLoading }: TeamAgentSegmentsProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
          Agent Segments
        </div>
        <div className="p-3 text-center text-[11px] text-v2-ink-muted">
          {isLoading ? "Loading..." : "No data available"}
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Segment cards configuration
  const segments = [
    {
      label: "Top Performers",
      description: "Top 20% by AP",
      data: data.topPerformers,
      icon: Trophy,
      color: "emerald",
    },
    {
      label: "Solid Performers",
      description: "Middle 30%",
      data: data.solidPerformers,
      icon: TrendingUp,
      color: "blue",
    },
    {
      label: "Needs Attention",
      description: "Bottom 50%",
      data: data.needsAttention,
      icon: AlertTriangle,
      color: "amber",
    },
  ];

  const getColorClass = (color: string, type: "text" | "bg" | "border") => {
    const colors: Record<string, Record<string, string>> = {
      emerald: {
        text: "text-success",
        bg: "bg-success/10",
        border: "border-success/20",
      },
      blue: {
        text: "text-info",
        bg: "bg-info/10",
        border: "border-info/20",
      },
      amber: {
        text: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/20",
      },
    };
    return colors[color]?.[type] || "";
  };

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
            Agent Segments
          </div>
          <div className="text-[10px] text-v2-ink-subtle">
            {data.totalAgents} agents • {formatCurrency(data.totalTeamAP)} total
            AP
          </div>
        </div>
        <div className="text-[10px] text-v2-ink-subtle">
          Avg: {formatCurrency(data.avgAgentAP)}
        </div>
      </div>

      {/* Segment Cards */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {segments.map((segment) => {
          const Icon = segment.icon;
          const percentOfTeam =
            data.totalAgents > 0
              ? ((segment.data.agentCount / data.totalAgents) * 100).toFixed(0)
              : "0";
          const percentOfAP =
            data.totalTeamAP > 0
              ? ((segment.data.totalAP / data.totalTeamAP) * 100).toFixed(0)
              : "0";

          return (
            <div
              key={segment.label}
              className={cn(
                "p-2 rounded border",
                getColorClass(segment.color, "bg"),
                getColorClass(segment.color, "border"),
              )}
            >
              <div className="flex items-center gap-1 mb-1">
                <Icon
                  className={cn(
                    "h-3 w-3",
                    getColorClass(segment.color, "text"),
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    getColorClass(segment.color, "text"),
                  )}
                >
                  {segment.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-mono font-bold text-sm",
                    getColorClass(segment.color, "text"),
                  )}
                >
                  {segment.data.agentCount}
                </span>
                <span className="text-[9px] text-v2-ink-subtle">
                  agents ({percentOfTeam}%)
                </span>
              </div>
              <div className="text-[9px] text-v2-ink-muted mt-0.5">
                {formatCurrency(segment.data.totalAP)} ({percentOfAP}% of team
                AP)
              </div>
            </div>
          );
        })}
      </div>

      {/* Top 5 Agents Table - Combined from all segments, sorted by AP */}
      {(() => {
        // Combine all agents from all segments and sort by AP
        const allAgents = [
          ...data.topPerformers.agents,
          ...data.solidPerformers.agents,
          ...data.needsAttention.agents,
        ].sort((a, b) => b.totalAP - a.totalAP);

        if (allAgents.length === 0) return null;

        return (
          <>
            <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em] mb-1">
              Top 5 Agents
            </div>
            <Table className="text-[11px]">
              <TableHeader>
                <TableRow className="h-7 border-b border-v2-ring">
                  <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas">
                    Agent
                  </TableHead>
                  <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                    Policies
                  </TableHead>
                  <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                    AP
                  </TableHead>
                  <TableHead className="p-1.5 text-[10px] font-semibold text-v2-ink-muted bg-v2-canvas text-right">
                    Persist
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAgents.slice(0, 5).map((agent, idx) => (
                  <TableRow
                    key={agent.agentId}
                    className="border-b border-v2-ring/60 hover:bg-v2-canvas"
                  >
                    <TableCell className="p-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-v2-ink-subtle">
                          #{idx + 1}
                        </span>
                        <span className="font-medium text-v2-ink truncate max-w-[120px]">
                          {agent.agentName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-1.5 text-right font-mono text-v2-ink-muted">
                      {agent.policyCount}
                    </TableCell>
                    <TableCell className="p-1.5 text-right font-mono font-semibold text-success">
                      {formatCurrency(agent.totalAP)}
                    </TableCell>
                    <TableCell className="p-1.5 text-right">
                      <span
                        className={cn(
                          "font-mono",
                          agent.persistencyRate >= 80
                            ? "text-success"
                            : agent.persistencyRate >= 60
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {agent.persistencyRate.toFixed(0)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        );
      })()}
    </div>
  );
}
