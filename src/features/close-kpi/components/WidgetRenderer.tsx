// src/features/close-kpi/components/WidgetRenderer.tsx
// Dispatches widget data to the correct display component based on type.

import React from "react";
import { StatCardWidget } from "./widgets/StatCardWidget";
import { StatusDistributionWidget } from "./widgets/StatusDistributionWidget";
import { CallAnalyticsWidget } from "./widgets/CallAnalyticsWidget";
import { OpportunitySummaryWidget } from "./widgets/OpportunitySummaryWidget";
import { VmRateSmartViewWidget } from "./widgets/VmRateSmartViewWidget";
import { BestCallTimesWidget } from "./widgets/BestCallTimesWidget";
import { CrossReferenceWidget } from "./widgets/CrossReferenceWidget";
import { SpeedToLeadWidget } from "./widgets/SpeedToLeadWidget";
import { ContactCadenceWidget } from "./widgets/ContactCadenceWidget";
import { DialAttemptsWidget } from "./widgets/DialAttemptsWidget";
import { LeadHeatSummaryWidget } from "./widgets/LeadHeatSummaryWidget";
import { LeadHeatListWidget } from "./widgets/LeadHeatListWidget";
import { LeadHeatAiInsightsWidget } from "./widgets/LeadHeatAiInsightsWidget";
import type {
  StatCardResult,
  StatusDistributionResult,
  CallAnalyticsResult,
  OpportunitySummaryResult,
  LifecycleTrackerResult,
  VmRateSmartViewResult,
  BestCallTimesResult,
  CrossReferenceResult,
  SpeedToLeadResult,
  ContactCadenceResult,
  DialAttemptsResult,
  LeadHeatSummaryResult,
  LeadHeatListResult,
  LeadHeatAiInsightsResult,
} from "../types/close-kpi.types";

interface WidgetRendererProps {
  type: string;
  data: unknown;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  type,
  data,
}) => {
  if (!data) return null;

  switch (type) {
    case "stat_card":
      return <StatCardWidget data={data as StatCardResult} />;

    case "status_distribution":
      return (
        <StatusDistributionWidget
          data={data as StatusDistributionResult}
          label="Status Distribution"
        />
      );

    case "call_analytics":
      return <CallAnalyticsWidget data={data as CallAnalyticsResult} />;

    case "opportunity_summary":
      return (
        <OpportunitySummaryWidget data={data as OpportunitySummaryResult} />
      );

    case "lifecycle_tracker": {
      const lcData = data as LifecycleTrackerResult;
      const t = lcData.transitions?.[0];
      if (!t || t.sampleSize === 0) {
        return (
          <div className="flex h-full flex-col justify-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              New → Next Status
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              No leads transitioned between these statuses. Try a wider date
              range.
            </p>
          </div>
        );
      }
      return (
        <div className="flex h-full flex-col justify-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t.from} → {t.to}
          </p>
          <span className="font-mono text-2xl font-bold text-foreground">
            {t.avgDays} days
          </span>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">
              Median: {t.medianDays}d · Range: {t.minDays}d – {t.maxDays}d
            </p>
            <p className="text-[10px] text-muted-foreground">
              Sample: {t.sampleSize} leads
            </p>
          </div>
        </div>
      );
    }

    case "vm_rate_smart_view": {
      const vmData = data as VmRateSmartViewResult;
      return <VmRateSmartViewWidget data={vmData} vmThreshold={40} />;
    }

    case "best_call_times":
      return <BestCallTimesWidget data={data as BestCallTimesResult} />;

    case "cross_reference":
      return <CrossReferenceWidget data={data as CrossReferenceResult} />;

    case "speed_to_lead":
      return <SpeedToLeadWidget data={data as SpeedToLeadResult} />;

    case "contact_cadence":
      return <ContactCadenceWidget data={data as ContactCadenceResult} />;

    case "dial_attempts":
      return <DialAttemptsWidget data={data as DialAttemptsResult} />;

    case "lead_heat_summary":
      return <LeadHeatSummaryWidget data={data as LeadHeatSummaryResult} />;

    case "lead_heat_list":
      return <LeadHeatListWidget data={data as LeadHeatListResult} />;

    case "lead_heat_ai_insights":
      return (
        <LeadHeatAiInsightsWidget data={data as LeadHeatAiInsightsResult} />
      );

    default:
      return null;
  }
};
