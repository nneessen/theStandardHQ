// src/features/close-kpi/types/close-kpi.types.ts
// Type definitions for the Close CRM KPI Dashboard

// ─── Widget Types ──────────────────────────────────────────────────

export type WidgetType =
  | "stat_card"
  | "status_distribution"
  | "smart_view_monitor"
  | "lifecycle_tracker"
  | "activity_timeline"
  | "cross_reference"
  | "opportunity_summary"
  | "call_analytics"
  | "custom_field_breakdown"
  | "vm_rate_smart_view";

export type WidgetSize = "small" | "medium" | "large";

export type DateRangePreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_quarter"
  | "this_year"
  | "custom";

export type ComparisonPeriod = "none" | "previous_period" | "custom";

export type TimeBucket = "day" | "week" | "month" | "quarter";

export type ActivityType = "call" | "email" | "sms" | "meeting" | "note";

export type OpportunityStatusType = "active" | "won" | "lost";

// ─── Metric Definitions ────────────────────────────────────────────
// These are the actual measurable things a user can pick from.

export type LeadMetric =
  | "lead_count" // Total leads matching filters
  | "leads_created" // Leads created in date range
  | "leads_by_status" // Lead count per status
  | "leads_by_source" // Lead count per source
  | "leads_by_smart_view" // Lead count per smart view
  | "leads_untouched" // Leads with no activities
  | "leads_by_custom_field"; // Lead count grouped by a custom field

export type CallMetric =
  | "calls_total" // Total calls
  | "calls_inbound" // Incoming calls
  | "calls_outbound" // Outgoing calls
  | "calls_answered" // Calls with answered disposition
  | "calls_voicemail" // VM left + VM answer
  | "calls_missed" // No-answer + busy
  | "call_duration_total" // Total call minutes
  | "call_duration_avg" // Average call duration
  | "call_connect_rate" // Answered / total calls
  | "calls_by_disposition" // Count per disposition (answered, vm-left, etc.)
  | "calls_by_direction" // Inbound vs outbound
  | "calls_over_time"; // Call count by time bucket

export type EmailMetric =
  | "emails_sent"
  | "emails_received"
  | "emails_total"
  | "emails_over_time";

export type SmsMetric =
  | "sms_sent"
  | "sms_received"
  | "sms_total"
  | "sms_over_time";

export type OpportunityMetric =
  | "pipeline_value" // Total $ in active pipeline
  | "pipeline_count" // Number of active opportunities
  | "win_rate" // Won / (won + lost)
  | "avg_deal_size" // Average opportunity value
  | "sales_velocity" // (# opps × avg deal × win rate) / avg time to win
  | "avg_time_to_close" // Days from opp created to won
  | "deals_won" // Count of won deals in range
  | "deals_lost" // Count of lost deals in range
  | "deals_won_value" // Total $ won in range
  | "opps_by_status" // Count per pipeline status
  | "opps_by_value_bucket" // Bucketed by deal size
  | "opps_stalled"; // Needing attention

export type LifecycleMetric =
  | "time_to_first_contact" // New → any Contacted status
  | "time_to_quote" // Created → Quoted
  | "time_to_sold" // Created → Sold
  | "time_to_negative" // Created → negative outcome
  | "status_conversion_rate" // % that move from status A → B
  | "custom_status_path"; // User-defined from → to

export type InsuranceMetric =
  | "leads_by_carrier" // Custom field: Carriers
  | "leads_by_app_status" // Custom field: Application Status
  | "leads_by_policy_status" // Custom field: Policy Status
  | "premium_pipeline" // Sum of Annual/Monthly Premium
  | "face_amount_distribution" // Coverage amounts
  | "leads_by_agent" // Custom field: Agent
  | "leads_by_campaign"; // Custom field: Campaign Name

export type Metric =
  | LeadMetric
  | CallMetric
  | EmailMetric
  | SmsMetric
  | OpportunityMetric
  | LifecycleMetric
  | InsuranceMetric;

export type MetricCategory =
  | "leads"
  | "calls"
  | "email_sms"
  | "opportunities"
  | "lifecycle"
  | "insurance";

// ─── Metric Registry Entry ─────────────────────────────────────────

export interface MetricDefinition {
  key: Metric;
  label: string;
  description: string;
  category: MetricCategory;
  aggregationType:
    | "count"
    | "sum"
    | "average"
    | "median"
    | "min"
    | "max"
    | "cardinality"
    | "percent"
    | "computed";
  objectType: string; // Close API object type: lead, call, email, opportunity, etc.
  field?: string; // Close API field for aggregation
  groupByField?: string; // Default group_by field
  unit?:
    | "number"
    | "currency"
    | "percent"
    | "duration_seconds"
    | "duration_days"
    | "minutes";
}

// ─── Widget Config (discriminated union by widget_type) ────────────

export interface BaseWidgetConfig {
  dateRange: DateRangePreset;
  customFrom?: string;
  customTo?: string;
  comparison: ComparisonPeriod;
  comparisonFrom?: string;
  comparisonTo?: string;
  smartViewId?: string | null;
}

export interface StatCardConfig extends BaseWidgetConfig {
  metric: Metric;
  leadStatusId?: string | null;
  leadSourceId?: string | null;
  customFieldKey?: string | null;
  customFieldValue?: string | null;
}

export interface StatusDistributionConfig extends BaseWidgetConfig {
  groupBy: "status" | "source" | "custom_field";
  customFieldKey?: string | null;
  hiddenIds?: string[];
  sortOrder?: "count_desc" | "count_asc" | "alpha";
}

export interface SmartViewMonitorConfig extends BaseWidgetConfig {
  smartViewIds: string[];
  statusIds: string[];
}

export interface LifecycleTrackerConfig extends BaseWidgetConfig {
  metric: LifecycleMetric;
  fromStatus: string;
  toStatus: string | null;
  statusPath?: string[];
}

export interface ActivityTimelineConfig extends BaseWidgetConfig {
  activityTypes: ActivityType[];
  timeBucket: TimeBucket;
  direction?: "incoming" | "outgoing" | "all";
}

export interface CrossReferenceConfig extends BaseWidgetConfig {
  smartViewIds: string[];
  statusIds: string[];
}

export interface OpportunitySummaryConfig extends BaseWidgetConfig {
  metric: OpportunityMetric;
  statusType: OpportunityStatusType;
  pipelineId?: string | null;
}

export interface CallAnalyticsConfig extends BaseWidgetConfig {
  metric: CallMetric;
  direction?: "incoming" | "outgoing" | "all";
  timeBucket?: TimeBucket;
  minDurationSeconds?: number;
}

export interface CustomFieldBreakdownConfig extends BaseWidgetConfig {
  customFieldKey: string;
  customFieldLabel?: string;
  aggregation: "count" | "sum" | "average";
  valueField?: string; // For sum/average — which numeric field to aggregate
  sortOrder?: "count_desc" | "count_asc" | "alpha";
}

export interface VmRateSmartViewConfig extends BaseWidgetConfig {
  smartViewIds: string[];
  /** VM rate threshold (0-100) — rows above this show warning */
  vmThreshold: number;
  /** Only count outbound first-call attempts (default true) */
  firstCallOnly: boolean;
}

export type WidgetConfig =
  | StatCardConfig
  | StatusDistributionConfig
  | SmartViewMonitorConfig
  | LifecycleTrackerConfig
  | ActivityTimelineConfig
  | CrossReferenceConfig
  | OpportunitySummaryConfig
  | CallAnalyticsConfig
  | CustomFieldBreakdownConfig
  | VmRateSmartViewConfig;

// ─── Database Row Types ────────────────────────────────────────────

export interface CloseKpiDashboard {
  id: string;
  user_id: string;
  name: string;
  global_config: GlobalDashboardConfig;
  created_at: string;
  updated_at: string;
}

export interface GlobalDashboardConfig {
  dateRange?: DateRangePreset;
  customFrom?: string;
  customTo?: string;
  refreshIntervalMs?: number;
}

export interface CloseKpiWidget {
  id: string;
  dashboard_id: string;
  user_id: string;
  widget_type: WidgetType;
  title: string;
  size: WidgetSize;
  config: WidgetConfig;
  position_order: number;
  created_at: string;
  updated_at: string;
}

export interface CloseKpiCacheEntry {
  id: string;
  user_id: string;
  widget_id: string;
  cache_key: string;
  result: WidgetResult;
  fetched_at: string;
  expires_at: string;
}

export interface CloseKpiWidgetTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  widget_type: WidgetType;
  default_config: WidgetConfig;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

// ─── Widget Result Types ───────────────────────────────────────────

export interface StatCardResult {
  value: number;
  previousValue?: number;
  changePercent?: number;
  label: string;
  unit?: string;
}

export interface StatusDistributionResult {
  items: { id: string; label: string; count: number }[];
  total: number;
}

export interface SmartViewMonitorResult {
  rows: {
    smartViewId: string;
    smartViewName: string;
    total: number;
    byStatus: Record<string, number>;
  }[];
}

export interface LifecycleTrackerResult {
  transitions: {
    from: string;
    to: string;
    avgDays: number;
    medianDays: number;
    minDays: number;
    maxDays: number;
    sampleSize: number;
  }[];
}

export interface ActivityTimelineResult {
  series: {
    type: string;
    data: { date: string; count: number }[];
  }[];
}

export interface CrossReferenceResult {
  rows: {
    smartViewId: string;
    smartViewName: string;
    cells: Record<string, number>;
    total: number;
  }[];
  statusLabels: { id: string; label: string }[];
  totals: Record<string, number>;
  grandTotal: number;
}

export interface OpportunitySummaryResult {
  totalValue: number;
  dealCount: number;
  winRate: number;
  avgDealSize: number;
  salesVelocity?: number;
  avgTimeToClose?: number;
  stalledCount: number;
  byStatus?: { id: string; label: string; count: number; value: number }[];
  previousTotalValue?: number;
  previousDealCount?: number;
}

export interface CallAnalyticsResult {
  total: number;
  answered: number;
  voicemail: number;
  missed: number;
  connectRate: number;
  totalDurationMin: number;
  avgDurationMin: number;
  byDisposition?: { disposition: string; count: number }[];
  byDirection?: { direction: string; count: number }[];
  overTime?: { date: string; count: number; durationMin: number }[];
}

export interface CustomFieldBreakdownResult {
  items: { value: string; count: number; aggregateValue?: number }[];
  total: number;
  fieldLabel: string;
}

export interface VmRateSmartViewResult {
  rows: {
    smartViewId: string;
    smartViewName: string;
    totalFirstCalls: number;
    vmCount: number;
    answeredCount: number;
    otherCount: number;
    vmRate: number; // 0-100
  }[];
  overall: {
    totalFirstCalls: number;
    vmCount: number;
    vmRate: number;
  };
}

export type WidgetResult =
  | StatCardResult
  | StatusDistributionResult
  | SmartViewMonitorResult
  | LifecycleTrackerResult
  | ActivityTimelineResult
  | CrossReferenceResult
  | OpportunitySummaryResult
  | CallAnalyticsResult
  | CustomFieldBreakdownResult
  | VmRateSmartViewResult;

// ─── Close API Data Types ──────────────────────────────────────────

export interface CloseLeadStatus {
  id: string;
  label: string;
}

export interface CloseLeadSource {
  id: string;
  label: string;
}

export interface CloseSmartView {
  id: string;
  name: string;
}

export interface CloseCustomField {
  key: string;
  name: string;
  type: string;
  choices?: string[];
}

export interface ClosePipeline {
  id: string;
  name: string;
  statuses: { id: string; label: string; type: "active" | "won" | "lost" }[];
}

export interface CloseAggregationRequest {
  includeTypes: string[];
  aggregations?: {
    aggregation_type: string;
    field?: string;
  }[];
  groupBy?: string[];
  timeBuckets?: {
    field: string;
    interval?: TimeBucket;
  };
}

export interface CloseAggregationResponse {
  data: Record<string, unknown>[];
  total?: number;
}

export interface CloseLeadSearchRequest {
  smartViewId?: string;
  leadStatusId?: string;
  query?: string;
  limit?: number;
  skip?: number;
}

export interface CloseLeadSearchResponse {
  totalResults: number;
  data: {
    id: string;
    display_name: string;
    status_id: string;
    created: string;
  }[];
}

export interface CloseActivitySearchRequest {
  activityTypes?: string[];
  leadIds?: string[];
  smartViewIds?: string[];
  dateStart?: string;
  dateEnd?: string;
  cursor?: string;
}

export interface CloseActivitySearchResponse {
  data: {
    id: string;
    type: string;
    lead_id: string;
    date_created: string;
    old_status_id?: string;
    new_status_id?: string;
    old_status_label?: string;
    new_status_label?: string;
    duration?: number;
    direction?: string;
    disposition?: string;
  }[];
  hasMore: boolean;
  cursor?: string;
}

// ─── Dashboard State ───────────────────────────────────────────────

export interface DashboardWithWidgets {
  dashboard: CloseKpiDashboard;
  widgets: CloseKpiWidget[];
}

export interface WidgetDataState {
  data: WidgetResult | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  fetchedAt: string | null;
}
