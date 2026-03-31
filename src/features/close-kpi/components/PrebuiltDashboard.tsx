// src/features/close-kpi/components/PrebuiltDashboard.tsx
// Pre-built dashboard: AI hero at top, then Close metric sections below.
// AI section is a purpose-built command center, not generic cards.

import React, { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { AiHeroSection } from "./AiHeroSection";
import { DashboardSection } from "./DashboardSection";
import { PrebuiltWidget } from "./PrebuiltWidget";
import { WidgetRenderer } from "./WidgetRenderer";
import { usePrebuiltDashboardData } from "../hooks/usePrebuiltWidgetData";
import {
  useLeadHeatDashboardStatus,
  useLeadHeatRescore,
} from "../hooks/useCloseKpiDashboard";
import { DASHBOARD_SECTIONS } from "../config/prebuilt-layout";
import type {
  DateRangePreset,
  LeadHeatSummaryResult,
  LeadHeatListResult,
  LeadHeatAiInsightsResult,
} from "../types/close-kpi.types";

interface PrebuiltDashboardProps {
  dateRange: DateRangePreset;
}

export const PrebuiltDashboard: React.FC<PrebuiltDashboardProps> = ({
  dateRange,
}) => {
  const { widgetDataMap, isCloseApiLoading } =
    usePrebuiltDashboardData(dateRange);
  const { data: leadHeatStatus } = useLeadHeatDashboardStatus();
  const {
    mutateAsync: triggerLeadHeatRescore,
    isPending: isLeadHeatRescorePending,
  } = useLeadHeatRescore();
  const autoRefreshTriggered = useRef(false);

  const heatSummary = widgetDataMap.get("heat_summary");
  const heatData = heatSummary?.data as LeadHeatSummaryResult | null;
  const hasCachedLeadHeatScores = (heatData?.totalScored ?? 0) > 0;
  const shouldRefreshStaleLeadHeat =
    leadHeatStatus?.state === "stale" && hasCachedLeadHeatScores;
  const isLeadHeatRunning =
    leadHeatStatus?.state === "running" || isLeadHeatRescorePending;

  useEffect(() => {
    if (
      shouldRefreshStaleLeadHeat &&
      !isLeadHeatRescorePending &&
      !autoRefreshTriggered.current
    ) {
      autoRefreshTriggered.current = true;
      void triggerLeadHeatRescore().catch(() => {});
    }
  }, [
    isLeadHeatRescorePending,
    shouldRefreshStaleLeadHeat,
    triggerLeadHeatRescore,
  ]);

  // Extract AI widget data for the hero section
  const aiSummaryData =
    (widgetDataMap.get("heat_summary")?.data as LeadHeatSummaryResult) ?? null;
  const aiListData =
    (widgetDataMap.get("heat_list")?.data as LeadHeatListResult) ?? null;
  const aiInsightsData =
    (widgetDataMap.get("ai_insights")?.data as LeadHeatAiInsightsResult) ??
    null;
  const isAiLoading = heatSummary?.isLoading ?? false;

  // Non-AI sections only (skip ai_lead_scoring — it's rendered by AiHeroSection)
  const metricSections = DASHBOARD_SECTIONS.filter(
    (s) => s.id !== "ai_lead_scoring",
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Rescore banner */}
      {isLeadHeatRunning && (
        <div className="flex items-center gap-2 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
          <p className="text-[11px] text-foreground">
            {hasCachedLeadHeatScores
              ? "Refreshing lead heat in the background. Cached scores remain visible."
              : "Scoring your leads for the first time — this takes 30-60 seconds..."}
          </p>
        </div>
      )}

      {/* AI Hero Section — always first, always prominent */}
      <AiHeroSection
        summaryData={aiSummaryData}
        listData={aiListData}
        insightsData={aiInsightsData}
        isLoading={isAiLoading}
        isRescoring={isLeadHeatRescorePending}
        onRescore={() => void triggerLeadHeatRescore().catch(() => {})}
      />

      {/* Close Metric Sections */}
      {metricSections.map((section) => (
        <DashboardSection
          key={section.id}
          id={section.id}
          title={section.title}
          description={section.description}
          icon={section.icon}
          tooltipKey={section.tooltipKey}
          gridClass={section.gridClass}
        >
          {section.widgets.map((widgetDef) => {
            const state = widgetDataMap.get(widgetDef.id);
            const data = state?.data ?? null;
            const widgetLoading =
              state?.isLoading ??
              (isCloseApiLoading && !widgetDef.type.startsWith("lead_heat_"));
            const error = state?.error ?? null;

            return (
              <PrebuiltWidget
                key={widgetDef.id}
                title={widgetDef.title}
                tooltipKey={widgetDef.tooltipKey}
                size={widgetDef.size}
                colSpan={widgetDef.colSpan}
                data={data}
                isLoading={widgetLoading}
                error={error}
                onRetry={() => state?.refetch()}
              >
                <WidgetRenderer type={widgetDef.type} data={data} />
              </PrebuiltWidget>
            );
          })}
        </DashboardSection>
      ))}
    </div>
  );
};
