// src/features/close-kpi/components/AiHeroSection.tsx
// Full-width AI command center — the hero section of the Close KPI page.
// Shows avg score, heat distribution, hot leads, and top AI recommendation
// all visible on initial render without scrolling.

import React from "react";
import {
  Brain,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { LeadHeatBadge } from "./LeadHeatBadge";
import { SECTION_TOOLTIPS } from "../config/prebuilt-layout";
import type {
  LeadHeatSummaryResult,
  LeadHeatListResult,
  LeadHeatAiInsightsResult,
  LeadHeatLevel,
} from "../types/close-kpi.types";

interface AiHeroSectionProps {
  summaryData: LeadHeatSummaryResult | null;
  listData: LeadHeatListResult | null;
  insightsData: LeadHeatAiInsightsResult | null;
  isLoading: boolean;
  isRescoring: boolean;
  isTruncated?: boolean;
  onRescore: () => void;
}

const LEVEL_COLORS: Record<
  LeadHeatLevel,
  { bg: string; text: string; label: string }
> = {
  hot: {
    bg: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    label: "Hot",
  },
  warming: {
    bg: "bg-orange-400",
    text: "text-orange-600 dark:text-orange-400",
    label: "Warming",
  },
  neutral: { bg: "bg-zinc-400", text: "text-zinc-500", label: "Neutral" },
  cooling: {
    bg: "bg-blue-400",
    text: "text-blue-600 dark:text-blue-400",
    label: "Cooling",
  },
  cold: {
    bg: "bg-blue-600",
    text: "text-blue-700 dark:text-blue-300",
    label: "Cold",
  },
};

export const AiHeroSection: React.FC<AiHeroSectionProps> = ({
  summaryData,
  listData,
  insightsData,
  isLoading,
  isRescoring,
  isTruncated,
  onRescore,
}) => {
  const [leadPage, setLeadPage] = React.useState(0);
  const [showAllHeatLevels, setShowAllHeatLevels] = React.useState(false);
  const tooltip = SECTION_TOOLTIPS.ai_lead_scoring;

  const hotLeads =
    listData?.leads.filter(
      (l) => l.heatLevel === "hot" || l.heatLevel === "warming",
    ) ?? [];
  const topRecommendation = insightsData?.recommendations?.[0];
  const topAnomaly = insightsData?.anomalies?.[0];
  const totalScored = summaryData?.totalScored ?? 0;
  const avgScore = summaryData?.avgScore ?? 0;
  const distribution = summaryData?.distribution ?? [];

  // Hot + warming count
  const hotCount = distribution.find((d) => d.level === "hot")?.count ?? 0;
  const warmingCount =
    distribution.find((d) => d.level === "warming")?.count ?? 0;
  const actionableCount = hotCount + warmingCount;

  const LEADS_PER_PAGE = 5;
  const sourceLeads = showAllHeatLevels ? (listData?.leads ?? []) : hotLeads;
  const totalPages = Math.max(
    1,
    Math.ceil(sourceLeads.length / LEADS_PER_PAGE),
  );
  const visibleLeads = sourceLeads.slice(
    leadPage * LEADS_PER_PAGE,
    (leadPage + 1) * LEADS_PER_PAGE,
  );

  return (
    <div className="rounded-xl border border-violet-200/80 dark:border-violet-500/20 bg-gradient-to-br from-violet-50/60 via-white to-indigo-50/40 dark:from-violet-950/30 dark:via-zinc-900 dark:to-indigo-950/20 shadow-sm shadow-violet-200/30 dark:shadow-violet-900/20 overflow-hidden ring-1 ring-violet-100/50 dark:ring-violet-800/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-200/40 dark:border-violet-800/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm shadow-violet-400/30">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-foreground">
                AI Lead Scoring
              </h2>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                <Sparkles className="h-2 w-2" />
                AI-Powered
              </span>
              {tooltip && (
                <MetricTooltip
                  title={tooltip.title}
                  description={tooltip.description}
                  note={tooltip.note}
                />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {totalScored > 0
                ? `${totalScored} leads scored — ${actionableCount} need attention`
                : "Score your leads to see AI insights"}
              {isTruncated && totalScored > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Partial data — large portfolio exceeded scoring limits
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] gap-1"
          onClick={onRescore}
          disabled={isRescoring}
        >
          {isRescoring ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {isRescoring ? "Scoring..." : "Rescore"}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && !summaryData && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-[11px] text-muted-foreground">
            Loading AI data...
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && totalScored === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Flame className="h-6 w-6 text-muted-foreground/40 mb-2" />
          <p className="text-xs font-medium text-muted-foreground">
            No leads scored yet
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 max-w-xs">
            Run your first scoring analysis to see AI-ranked leads and
            recommendations
          </p>
          <Button
            size="sm"
            className="h-7 text-[10px] gap-1 mt-3"
            onClick={onRescore}
            disabled={isRescoring}
          >
            {isRescoring ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Flame className="h-3 w-3" />
            )}
            {isRescoring ? "Scoring..." : "Score My Leads"}
          </Button>
        </div>
      )}

      {/* Main content — 3 column layout */}
      {totalScored > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
          {/* Column 1: Score Overview */}
          <div className="lg:col-span-3 p-4 flex flex-col items-center justify-center gap-3">
            {/* Big score */}
            <div className="text-center">
              <div className="font-mono text-4xl font-black text-foreground leading-none">
                {avgScore}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                avg score
              </div>
            </div>

            {/* Heat distribution bar */}
            <div className="w-full max-w-[180px]">
              <div className="flex h-2.5 rounded-full overflow-hidden">
                {distribution
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <div
                      key={d.level}
                      className={`${LEVEL_COLORS[d.level].bg} transition-all`}
                      style={{ width: `${d.pct}%` }}
                      title={`${LEVEL_COLORS[d.level].label}: ${d.count} (${d.pct}%)`}
                    />
                  ))}
              </div>
              <div className="flex justify-between mt-1">
                {distribution
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <span
                      key={d.level}
                      className={`text-[9px] ${LEVEL_COLORS[d.level].text}`}
                    >
                      {d.count}
                    </span>
                  ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5">
              {distribution
                .filter((d) => d.count > 0)
                .map((d) => (
                  <span
                    key={d.level}
                    className="flex items-center gap-0.5 text-[9px] text-muted-foreground"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${LEVEL_COLORS[d.level].bg}`}
                    />
                    {LEVEL_COLORS[d.level].label}
                  </span>
                ))}
            </div>

            {/* AI scoring badge */}
            <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[9px] font-medium text-violet-700 dark:text-violet-300">
              AI-assisted scoring
            </span>
          </div>

          {/* Column 2: Hot Leads (immediate action) */}
          <div className="lg:col-span-5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-red-500" />
                <span className="text-[11px] font-bold text-foreground">
                  {actionableCount > 0
                    ? `${actionableCount} Leads Need Action`
                    : "Lead Rankings"}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowAllHeatLevels((p) => !p);
                  setLeadPage(0);
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllHeatLevels ? "Hot only" : "All leads"}
              </button>
            </div>

            {visibleLeads.length > 0 ? (
              <div className="space-y-0.5">
                {visibleLeads.map((lead, i) => (
                  <div
                    key={lead.closeLeadId}
                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground/50 w-4 shrink-0 text-right font-mono">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {lead.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-muted-foreground">
                          {lead.currentStatus}
                        </span>
                        {lead.topSignal && (
                          <span className="text-[9px] text-muted-foreground/60">
                            {lead.topSignal}
                          </span>
                        )}
                      </div>
                    </div>
                    <LeadHeatBadge
                      score={lead.score}
                      heatLevel={lead.heatLevel}
                      trend={lead.trend}
                      previousScore={lead.previousScore}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground/60 py-4 text-center">
                No hot leads right now. Run a rescore to update.
              </p>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30">
                <span className="text-[9px] text-muted-foreground">
                  {leadPage * LEADS_PER_PAGE + 1}–
                  {Math.min(
                    (leadPage + 1) * LEADS_PER_PAGE,
                    sourceLeads.length,
                  )}{" "}
                  of {sourceLeads.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLeadPage((p) => Math.max(0, p - 1))}
                    disabled={leadPage === 0}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setLeadPage(i)}
                      className={`w-5 h-5 rounded text-[10px] font-mono transition-colors ${
                        i === leadPage
                          ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setLeadPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={leadPage === totalPages - 1}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: AI Insights */}
          <div className="lg:col-span-4 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-[11px] font-bold text-foreground">
                AI Insights
              </span>
            </div>

            {/* Overall assessment */}
            {insightsData?.overallAssessment && (
              <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 mb-2">
                <p className="text-[11px] text-foreground leading-relaxed">
                  {insightsData.overallAssessment}
                </p>
              </div>
            )}

            {/* Top recommendation */}
            {topRecommendation && (
              <div className="flex items-start gap-2 rounded-md border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-950/10 px-3 py-2 mb-2">
                <Target className="h-3 w-3 mt-0.5 flex-shrink-0 text-violet-600 dark:text-violet-400" />
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Top Recommendation
                  </span>
                  <p className="text-[11px] text-foreground mt-0.5">
                    {topRecommendation.text}
                  </p>
                </div>
              </div>
            )}

            {/* Top anomaly */}
            {topAnomaly && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10 px-3 py-2 mb-2">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Attention
                  </span>
                  <p className="text-[11px] text-foreground mt-0.5">
                    <span className="font-medium">
                      {topAnomaly.displayName}
                    </span>{" "}
                    — {topAnomaly.message}
                  </p>
                </div>
              </div>
            )}

            {/* Additional recommendations */}
            {insightsData && insightsData.recommendations.length > 1 && (
              <div className="space-y-1">
                {insightsData.recommendations.slice(1, 4).map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <TrendingUp className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" />
                    <span>{rec.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* No insights state */}
            {!insightsData?.overallAssessment && !topRecommendation && (
              <p className="text-[10px] text-muted-foreground/60 py-2">
                AI insights will appear after scoring completes.
              </p>
            )}

            {/* Model info */}
            {insightsData?.modelVersion && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                <span className="text-[9px] text-muted-foreground/50">
                  Model v{insightsData.modelVersion}
                </span>
                {insightsData.analyzedAt && (
                  <span className="text-[9px] text-muted-foreground/50">
                    {formatTimeAgo(insightsData.analyzedAt)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function formatTimeAgo(ts: string): string {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
