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
import { LifecycleVelocityWidget } from "./widgets/LifecycleVelocityWidget";
import { FollowUpGapsWidget } from "./widgets/FollowUpGapsWidget";
import type {
  StatCardResult,
  StatusDistributionResult,
  CallAnalyticsResult,
  OpportunitySummaryResult,
  LifecycleTrackerResult,
  VmRateSmartViewResult,
  FollowUpGapsResult,
  BestCallTimesResult,
  CrossReferenceResult,
  SpeedToLeadResult,
  ContactCadenceResult,
  DialAttemptsResult,
  LeadHeatSummaryResult,
  LeadHeatListResult,
  LeadHeatAiInsightsResult,
  WidgetConfig,
} from "../types/close-kpi.types";

interface WidgetRendererProps {
  type: string;
  data: unknown;
  config?: WidgetConfig;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  type,
  data,
  config,
}) => {
  if (!data) return null;

  const accentColor = config?.accentColor;

  switch (type) {
    case "stat_card":
      return (
        <StatCardWidget
          data={data as StatCardResult}
          accentColor={accentColor}
        />
      );

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

    case "lifecycle_tracker":
      return <LifecycleVelocityWidget data={data as LifecycleTrackerResult} />;

    case "vm_rate_smart_view": {
      const vmData = data as VmRateSmartViewResult;
      return <VmRateSmartViewWidget data={vmData} vmThreshold={40} />;
    }

    case "follow_up_gaps":
      return <FollowUpGapsWidget data={data as FollowUpGapsResult} />;

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
