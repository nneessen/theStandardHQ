// src/features/close-kpi/config/widget-registry.ts
// Widget type metadata, default configs, and the full metric catalog

import type {
  WidgetType,
  WidgetSize,
  WidgetConfig,
  MetricDefinition,
  MetricCategory,
  Metric,
  StatCardConfig,
  StatusDistributionConfig,
  LifecycleTrackerConfig,
  OpportunitySummaryConfig,
  CallAnalyticsConfig,
  VmRateSmartViewConfig,
  BestCallTimesConfig,
  CrossReferenceConfig,
  SpeedToLeadConfig,
  ContactCadenceConfig,
  DialAttemptsConfig,
} from "../types/close-kpi.types";

// ─── Widget Registry ───────────────────────────────────────────────

export interface WidgetRegistryEntry {
  type: WidgetType;
  label: string;
  description: string;
  category: MetricCategory;
  icon: string;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  colSpan: Record<WidgetSize, number>;
  defaultConfig: WidgetConfig;
  /** If true, widget is not yet implemented and should be hidden from the picker */
  comingSoon?: boolean;
}

const DEFAULT_BASE = {
  dateRange: "this_month" as const,
  comparison: "none" as const,
};

export const WIDGET_REGISTRY: Record<WidgetType, WidgetRegistryEntry> = {
  stat_card: {
    type: "stat_card",
    label: "Stat Card",
    description: "Single KPI metric with trend comparison",
    category: "leads",
    icon: "Hash",
    defaultSize: "small",
    allowedSizes: ["small", "medium"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      metric: "lead_count",
      comparison: "previous_period",
    } satisfies StatCardConfig,
  },
  status_distribution: {
    type: "status_distribution",
    label: "Status Distribution",
    description: "Lead counts by status, source, or custom field",
    category: "leads",
    icon: "BarChart3",
    defaultSize: "medium",
    allowedSizes: ["medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      groupBy: "status",
      sortOrder: "count_desc",
    } satisfies StatusDistributionConfig,
  },
  call_analytics: {
    type: "call_analytics",
    label: "Call Analytics",
    description:
      "Call volume, duration, connect rate, and disposition breakdown",
    category: "calls",
    icon: "Phone",
    defaultSize: "medium",
    allowedSizes: ["small", "medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      metric: "calls_total",
      direction: "all",
      dateRange: "this_week",
    } satisfies CallAnalyticsConfig,
  },
  opportunity_summary: {
    type: "opportunity_summary",
    label: "Opportunity Funnel",
    description: "Pipeline value, win rate, sales velocity, and deal metrics",
    category: "opportunities",
    icon: "TrendingUp",
    defaultSize: "medium",
    allowedSizes: ["small", "medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      metric: "pipeline_value" as const,
      statusType: "active",
    } satisfies OpportunitySummaryConfig,
  },
  lifecycle_tracker: {
    type: "lifecycle_tracker",
    label: "Lifecycle Velocity",
    description: "Time between status transitions — find bottlenecks",
    category: "leads",
    icon: "Timer",
    defaultSize: "medium",
    allowedSizes: ["medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      metric: "time_to_first_contact" as const,
      fromStatus: "New",
      toStatus: null,
    } satisfies LifecycleTrackerConfig,
  },
  vm_rate_smart_view: {
    type: "vm_rate_smart_view",
    label: "VM Rate by Smart View",
    description:
      "First-call voicemail rate per smart view — detect bad lead batches early",
    category: "calls",
    icon: "PhoneOff",
    defaultSize: "medium",
    allowedSizes: ["medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      smartViewIds: [],
      vmThreshold: 40,
      firstCallOnly: true,
      dateRange: "this_week",
    } satisfies VmRateSmartViewConfig,
  },
  best_call_times: {
    type: "best_call_times",
    label: "Best Time to Call",
    description:
      "Connect rates by hour and day — find when prospects actually pick up",
    category: "calls",
    icon: "Clock",
    defaultSize: "medium",
    allowedSizes: ["medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      dateRange: "last_30_days",
    } satisfies BestCallTimesConfig,
  },
  cross_reference: {
    type: "cross_reference",
    label: "Smart View × Status",
    description:
      "How many leads in each smart view have each status — find spam lists fast",
    category: "leads",
    icon: "Grid3X3",
    defaultSize: "large",
    allowedSizes: ["large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      smartViewIds: [],
      statusIds: [],
    } satisfies CrossReferenceConfig,
  },
  speed_to_lead: {
    type: "speed_to_lead",
    label: "Speed to Lead",
    description:
      "How fast agents make first contact after lead creation — strike while hot",
    category: "leads",
    icon: "Zap",
    defaultSize: "medium",
    allowedSizes: ["small", "medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      dateRange: "last_30_days",
    } satisfies SpeedToLeadConfig,
  },
  contact_cadence: {
    type: "contact_cadence",
    label: "Contact Cadence",
    description:
      "Time gaps between touches — are agents following up fast enough?",
    category: "leads",
    icon: "Repeat",
    defaultSize: "medium",
    allowedSizes: ["medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      dateRange: "last_30_days",
    } satisfies ContactCadenceConfig,
  },
  dial_attempts: {
    type: "dial_attempts",
    label: "Dial Attempt Tracker",
    description: "How many calls before connection — know when to stop trying",
    category: "calls",
    icon: "PhoneCall",
    defaultSize: "medium",
    allowedSizes: ["medium", "large"],
    colSpan: { small: 1, medium: 1, large: 2 },
    defaultConfig: {
      ...DEFAULT_BASE,
      dateRange: "last_30_days",
    } satisfies DialAttemptsConfig,
  },
};

// ─── Metric Catalog ────────────────────────────────────────────────
// The full list of measurable things from Close CRM

export const METRIC_CATALOG: MetricDefinition[] = [
  // ── Lead Metrics (implemented) ──
  {
    key: "lead_count",
    label: "Total Leads",
    description: "Count of all leads matching filters",
    category: "leads",
    aggregationType: "count",
    objectType: "lead",
    unit: "number",
  },
  {
    key: "leads_created",
    label: "Leads Created",
    description: "New leads created in the date range",
    category: "leads",
    aggregationType: "count",
    objectType: "lead",
    field: "date_created",
    unit: "number",
  },

  // ── Call Metrics (implemented) ──
  {
    key: "calls_total",
    label: "Total Calls",
    description: "All calls in the date range",
    category: "calls",
    aggregationType: "count",
    objectType: "call",
    unit: "number",
  },
  {
    key: "calls_inbound",
    label: "Inbound Calls",
    description: "Incoming calls only",
    category: "calls",
    aggregationType: "count",
    objectType: "call",
    field: "direction",
    unit: "number",
  },
  {
    key: "calls_outbound",
    label: "Outbound Calls",
    description: "Outgoing calls only",
    category: "calls",
    aggregationType: "count",
    objectType: "call",
    field: "direction",
    unit: "number",
  },
  {
    key: "calls_answered",
    label: "Answered Calls",
    description: "Calls with answered disposition",
    category: "calls",
    aggregationType: "count",
    objectType: "call",
    field: "disposition",
    unit: "number",
  },
  {
    key: "calls_voicemail",
    label: "Voicemail Calls",
    description: "VM left + VM answered",
    category: "calls",
    aggregationType: "count",
    objectType: "call",
    field: "disposition",
    unit: "number",
  },
  {
    key: "calls_missed",
    label: "Missed Calls",
    description: "No-answer + busy + blocked",
    category: "calls",
    aggregationType: "count",
    objectType: "call",
    field: "disposition",
    unit: "number",
  },
  {
    key: "call_duration_total",
    label: "Total Call Minutes",
    description: "Sum of all call durations",
    category: "calls",
    aggregationType: "sum",
    objectType: "call",
    field: "duration",
    unit: "minutes",
  },
  {
    key: "call_duration_avg",
    label: "Avg Call Duration",
    description: "Average call length",
    category: "calls",
    aggregationType: "average",
    objectType: "call",
    field: "duration",
    unit: "minutes",
  },
  {
    key: "call_connect_rate",
    label: "Connect Rate",
    description: "Answered calls / total calls",
    category: "calls",
    aggregationType: "computed",
    objectType: "call",
    unit: "percent",
  },

  // ── Email & SMS (implemented with direction) ──
  {
    key: "emails_sent",
    label: "Emails Sent",
    description: "Outgoing emails in range",
    category: "email_sms",
    aggregationType: "count",
    objectType: "email",
    field: "direction",
    unit: "number",
  },
  {
    key: "emails_received",
    label: "Emails Received",
    description: "Incoming emails in range",
    category: "email_sms",
    aggregationType: "count",
    objectType: "email",
    field: "direction",
    unit: "number",
  },
  {
    key: "emails_total",
    label: "Total Emails",
    description: "All emails in range",
    category: "email_sms",
    aggregationType: "count",
    objectType: "email",
    unit: "number",
  },
  {
    key: "sms_sent",
    label: "SMS Sent",
    description: "Outgoing SMS in range",
    category: "email_sms",
    aggregationType: "count",
    objectType: "sms",
    field: "direction",
    unit: "number",
  },
  {
    key: "sms_received",
    label: "SMS Received",
    description: "Incoming SMS in range",
    category: "email_sms",
    aggregationType: "count",
    objectType: "sms",
    field: "direction",
    unit: "number",
  },
  {
    key: "sms_total",
    label: "Total SMS",
    description: "All SMS in range",
    category: "email_sms",
    aggregationType: "count",
    objectType: "sms",
    unit: "number",
  },

  // ── Opportunity Metrics (implemented with pagination) ──
  {
    key: "pipeline_value",
    label: "Pipeline Value",
    description: "Total $ value of active opportunities",
    category: "opportunities",
    aggregationType: "sum",
    objectType: "opportunity",
    field: "value",
    unit: "currency",
  },
  {
    key: "pipeline_count",
    label: "Active Opportunities",
    description: "Count of active opportunities",
    category: "opportunities",
    aggregationType: "count",
    objectType: "opportunity",
    unit: "number",
  },
  {
    key: "win_rate",
    label: "Win Rate",
    description: "Won / (won + lost) as percentage",
    category: "opportunities",
    aggregationType: "computed",
    objectType: "opportunity",
    unit: "percent",
  },
  {
    key: "avg_deal_size",
    label: "Avg Deal Size",
    description: "Average opportunity value",
    category: "opportunities",
    aggregationType: "average",
    objectType: "opportunity",
    field: "value",
    unit: "currency",
  },
  {
    key: "sales_velocity",
    label: "Sales Velocity",
    description: "(# opps x avg deal x win rate) / avg time to win",
    category: "opportunities",
    aggregationType: "computed",
    objectType: "opportunity",
    unit: "currency",
  },
  {
    key: "avg_time_to_close",
    label: "Avg Time to Close",
    description: "Days from opportunity created to won",
    category: "opportunities",
    aggregationType: "average",
    objectType: "opportunity",
    unit: "duration_days",
  },
  {
    key: "deals_won",
    label: "Deals Won",
    description: "Number of won deals in range",
    category: "opportunities",
    aggregationType: "count",
    objectType: "opportunity",
    unit: "number",
  },
  {
    key: "deals_lost",
    label: "Deals Lost",
    description: "Number of lost deals in range",
    category: "opportunities",
    aggregationType: "count",
    objectType: "opportunity",
    unit: "number",
  },
  {
    key: "deals_won_value",
    label: "Revenue Won",
    description: "Total $ from won deals",
    category: "opportunities",
    aggregationType: "sum",
    objectType: "opportunity",
    field: "value",
    unit: "currency",
  },
];

// ─── Category Definitions ──────────────────────────────────────────

export const WIDGET_CATEGORIES = [
  { id: "leads" as const, label: "Leads" },
  { id: "calls" as const, label: "Calls" },
  { id: "email_sms" as const, label: "Email & SMS" },
  { id: "opportunities" as const, label: "Opportunities" },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────

export function getWidgetColSpan(type: WidgetType, size: WidgetSize): number {
  return WIDGET_REGISTRY[type].colSpan[size];
}

export function getMetricsForCategory(
  category: MetricCategory,
): MetricDefinition[] {
  return METRIC_CATALOG.filter((m) => m.category === category);
}

export function getMetricDefinition(key: Metric): MetricDefinition | undefined {
  return METRIC_CATALOG.find((m) => m.key === key);
}

/** Get metrics that can be used in a stat card — all catalog metrics are implemented */
export function getStatCardMetrics(): MetricDefinition[] {
  return METRIC_CATALOG;
}
