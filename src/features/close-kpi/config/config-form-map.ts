// src/features/close-kpi/config/config-form-map.ts
// Maps widget types to their configuration form components.

import type React from "react";
import type { WidgetType, WidgetConfig } from "../types/close-kpi.types";

import { StatCardConfig } from "../components/config-forms/StatCardConfig";
import { StatusDistributionConfig } from "../components/config-forms/StatusDistributionConfig";
import { CallAnalyticsConfig } from "../components/config-forms/CallAnalyticsConfig";
import { OpportunitySummaryConfig } from "../components/config-forms/OpportunitySummaryConfig";
import { LifecycleTrackerConfig } from "../components/config-forms/LifecycleTrackerConfig";
import { VmRateSmartViewConfig } from "../components/config-forms/VmRateSmartViewConfig";
import { CrossReferenceConfig } from "../components/config-forms/CrossReferenceConfig";
import { DateRangeOnlyConfig } from "../components/config-forms/DateRangeOnlyConfig";

// ─── Shared config form prop shape ────────────────────────────────

export interface ConfigFormProps<T extends WidgetConfig = WidgetConfig> {
  config: T;
  onChange: (config: T) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConfigFormComponent = React.FC<{
  config: any;
  onChange: (config: any) => void;
}>;

// ─── Widget Type -> Config Form mapping ───────────────────────────

export const CONFIG_FORM_MAP: Partial<Record<WidgetType, ConfigFormComponent>> =
  {
    stat_card: StatCardConfig,
    status_distribution: StatusDistributionConfig,
    call_analytics: CallAnalyticsConfig,
    opportunity_summary: OpportunitySummaryConfig,
    lifecycle_tracker: LifecycleTrackerConfig,
    vm_rate_smart_view: VmRateSmartViewConfig,
    cross_reference: CrossReferenceConfig,
    // These widget types only need date range + optional smart view
    best_call_times: DateRangeOnlyConfig,
    speed_to_lead: DateRangeOnlyConfig,
    contact_cadence: DateRangeOnlyConfig,
    dial_attempts: DateRangeOnlyConfig,
    lead_heat_summary: DateRangeOnlyConfig,
    lead_heat_list: DateRangeOnlyConfig,
    lead_heat_ai_insights: DateRangeOnlyConfig,
  };

/**
 * Get the config form component for a widget type.
 * Returns null if no form exists (widget type has no configurable options).
 */
export function getConfigForm(
  widgetType: WidgetType,
): ConfigFormComponent | null {
  return CONFIG_FORM_MAP[widgetType] ?? null;
}
