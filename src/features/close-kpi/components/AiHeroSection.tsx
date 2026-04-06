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
import { ManageWeightsPanel } from "./ManageWeightsPanel";
import { SECTION_TOOLTIPS } from "../config/prebuilt-layout";
import { formatTimeAgo } from "../lib/format-time";
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
  { bg: string; text: string; label: string; fill: string }
> = {
  hot: {
    bg: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    label: "Hot",
    fill: "#ef4444",
  },
  warming: {
    bg: "bg-orange-400",
    text: "text-orange-600 dark:text-orange-400",
    label: "Warming",
    fill: "#f97316",
  },
  neutral: {
    bg: "bg-zinc-400",
    text: "text-zinc-500",
    label: "Neutral",
    fill: "#a1a1aa",
  },
  cooling: {
    bg: "bg-blue-400",
    text: "text-blue-600 dark:text-blue-400",
    label: "Cooling",
    fill: "#60a5fa",
  },
  cold: {
    bg: "bg-blue-600",
    text: "text-blue-700 dark:text-blue-300",
    label: "Cold",
    fill: "#2563eb",
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

  const LEADS_PER_PAGE = 10;
  const sourceLeads = showAllHeatLevels ? (listData?.leads ?? []) : hotLeads;
  const totalPages = Math.max(
    1,
    Math.ceil(sourceLeads.length / LEADS_PER_PAGE),
  );
  // Clamp page to valid range when data changes (e.g., rescore reduces lead count)
  const effectiveLeadPage = Math.min(leadPage, Math.max(0, totalPages - 1));
  const visibleLeads = sourceLeads.slice(
    effectiveLeadPage * LEADS_PER_PAGE,
    (effectiveLeadPage + 1) * LEADS_PER_PAGE,
  );

  // Score health
  const healthLabel =
    avgScore >= 60
      ? "Hot Pipeline"
      : avgScore >= 40
        ? "Warming Up"
        : avgScore >= 20
          ? "Needs Work"
          : "Cold Pipeline";
  const healthColor =
    avgScore >= 60
      ? "text-red-500"
      : avgScore >= 40
        ? "text-orange-500"
        : avgScore >= 20
          ? "text-zinc-500"
          : "text-blue-500";

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
                ? `${totalScored.toLocaleString()} leads scored — ${actionableCount} need attention`
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
          {/* Column 1: Score Overview — large donut + compact distribution */}
          <div className="lg:col-span-4 p-4 flex flex-col items-center gap-3">
            {/* Large SVG Donut with score + count in center */}
            {(() => {
              const size = 200;
              const strokeWidth = 28;
              const radius = (size - strokeWidth) / 2;
              const circumference = 2 * Math.PI * radius;
              const nonEmpty = distribution.filter((d) => d.count > 0);
              let cumulativeOffset = 0;
              const segments = nonEmpty.map((d) => {
                const segLen = (d.pct / 100) * circumference;
                const offset = cumulativeOffset;
                cumulativeOffset += segLen;
                return {
                  level: d.level,
                  length: segLen,
                  offset,
                  color: LEVEL_COLORS[d.level]?.fill ?? "#a1a1aa",
                };
              });

              return (
                <div className="relative">
                  <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                  >
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      className="text-muted/15"
                    />
                    {segments.map((seg) => (
                      <circle
                        key={seg.level}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${seg.length} ${circumference - seg.length}`}
                        strokeDashoffset={-seg.offset}
                        strokeLinecap="butt"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className={`font-mono text-5xl font-black leading-none ${healthColor}`}
                    >
                      {avgScore}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      avg score
                    </span>
                    <span
                      className={`text-[9px] font-semibold mt-0.5 ${healthColor}`}
                    >
                      {healthLabel}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60 mt-0.5">
                      {totalScored.toLocaleString()} scored
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Compact stacked horizontal bar */}
            <div className="w-full">
              <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted/20">
                {distribution
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <div
                      key={d.level}
                      className={`h-full ${LEVEL_COLORS[d.level].bg}`}
                      style={{
                        width: `${Math.max(d.pct, d.count > 0 ? 1 : 0)}%`,
                        opacity: 0.85,
                      }}
                      title={`${LEVEL_COLORS[d.level].label}: ${d.count.toLocaleString()} (${d.pct}%)`}
                    />
                  ))}
              </div>
              {/* Labels row */}
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 mt-2">
                {distribution.map((d) => (
                  <span
                    key={d.level}
                    className="inline-flex items-center gap-1 text-[9px] text-muted-foreground"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${LEVEL_COLORS[d.level].bg}`}
                    />
                    <span className="font-mono font-bold text-foreground">
                      {d.count.toLocaleString()}
                    </span>
                    {LEVEL_COLORS[d.level].label}
                  </span>
                ))}
              </div>
            </div>

            {/* Action callout — slim single-line */}
            {actionableCount > 0 ? (
              <div className="w-full flex items-center gap-2 rounded-lg bg-red-50/60 dark:bg-red-950/25 border border-red-200/50 dark:border-red-800/40 px-3 py-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15 shrink-0">
                  <Flame className="h-3.5 w-3.5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-red-700 dark:text-red-300">
                    {actionableCount} leads need action
                  </span>
                  <span className="text-[9px] text-red-600/70 dark:text-red-400/70 ml-1.5">
                    {hotCount} hot + {warmingCount} warming
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full rounded-lg bg-violet-50/60 dark:bg-violet-950/25 border border-violet-200/50 dark:border-violet-800/40 px-3 py-2 text-center">
                <span className="text-[10px] font-medium text-violet-700 dark:text-violet-300">
                  No urgent leads — pipeline is stable
                </span>
              </div>
            )}
          </div>

          {/* Column 2: Hot Leads (immediate action) */}
          <div className="lg:col-span-4 p-3">
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
                      {effectiveLeadPage * LEADS_PER_PAGE + i + 1}
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
                  {effectiveLeadPage * LEADS_PER_PAGE + 1}–
                  {Math.min(
                    (effectiveLeadPage + 1) * LEADS_PER_PAGE,
                    sourceLeads.length,
                  )}{" "}
                  of {sourceLeads.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLeadPage((p) => Math.max(0, p - 1))}
                    disabled={effectiveLeadPage === 0}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setLeadPage(i)}
                      className={`w-5 h-5 rounded text-[10px] font-mono transition-colors ${
                        i === effectiveLeadPage
                          ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  {totalPages > 7 && (
                    <span className="text-[10px] text-muted-foreground">
                      ...
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setLeadPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={effectiveLeadPage === totalPages - 1}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-default transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: AI Insights */}
          <div className="lg:col-span-4 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                <span className="text-[11px] font-bold text-foreground">
                  AI Insights
                </span>
              </div>
              {insightsData?.modelVersion && (
                <span className="text-[9px] text-muted-foreground/50">
                  weights v{insightsData.modelVersion}
                  {insightsData.analyzedAt &&
                    ` · ${formatTimeAgo(insightsData.analyzedAt)}`}
                </span>
              )}
            </div>

            {/* Overall assessment — prominent quote block */}
            {insightsData?.overallAssessment && (
              <div className="rounded-md border-l-2 border-violet-400 dark:border-violet-500 bg-violet-50/40 dark:bg-violet-950/15 pl-3 pr-2.5 py-2">
                <p className="text-[11px] text-foreground leading-relaxed italic">
                  {insightsData.overallAssessment}
                </p>
              </div>
            )}

            {/* Cards grid — recommendation + anomaly side by side if both exist */}
            <div
              className={`grid gap-2 ${topRecommendation && topAnomaly ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {/* Top recommendation */}
              {topRecommendation && (
                <div className="rounded-md border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-950/10 px-2.5 py-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                      Recommendation
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground leading-snug">
                    {topRecommendation.text}
                  </p>
                </div>
              )}

              {/* Top anomaly */}
              {topAnomaly && (
                <div className="rounded-md border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10 px-2.5 py-2">
                  <div className="flex items-center gap-1 mb-1">
                    <AlertTriangle className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Attention
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground leading-snug">
                    <span className="font-medium">
                      {topAnomaly.displayName}
                    </span>{" "}
                    — {topAnomaly.message}
                  </p>
                </div>
              )}
            </div>

            {/* Additional recommendations list */}
            {insightsData && insightsData.recommendations.length > 1 && (
              <div className="space-y-1">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  More Actions
                </span>
                {insightsData.recommendations.slice(1, 4).map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <TrendingUp className="h-2.5 w-2.5 mt-0.5 flex-shrink-0 text-violet-500/60" />
                    <span>{rec.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Manage Signal Weights — inline expandable panel.
                Lets the user adopt AI weight suggestions or manually tune
                multipliers without leaving the dashboard. Only renders when
                we actually have insights data — no point showing it on the
                empty state. */}
            {insightsData && (
              <div className="mt-auto">
                <ManageWeightsPanel data={insightsData} variant="hero" />
              </div>
            )}

            {/* No insights state */}
            {!insightsData?.overallAssessment && !topRecommendation && (
              <p className="text-[10px] text-muted-foreground/60 py-4 text-center">
                AI insights will appear after scoring completes.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
