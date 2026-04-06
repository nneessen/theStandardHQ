// src/features/close-kpi/types/close-kpi.types.ts
// Type definitions for the Close CRM KPI Dashboard

// ─── Widget Types ──────────────────────────────────────────────────

export type WidgetType =
  | "stat_card"
  | "status_distribution"
  | "lifecycle_tracker"
  | "opportunity_summary"
  | "call_analytics"
  | "vm_rate_smart_view"
  | "best_call_times"
  | "cross_reference"
  | "speed_to_lead"
  | "contact_cadence"
  | "dial_attempts"
  | "follow_up_gaps"
  | "lead_heat_summary"
  | "lead_heat_list"
  | "lead_heat_ai_insights";

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

export type LeadHeatLevel = "hot" | "warming" | "neutral" | "cooling" | "cold";
export type LeadTrendDirection =
  | "up"
  | "up-right"
  | "right"
  | "down-right"
  | "down";

// ─── Metric Definitions ────────────────────────────────────────────
// These are the actual measurable things a user can pick from.

export type LeadMetric = "lead_count" | "leads_created";

export type CallMetric =
  | "calls_total"
  | "calls_inbound"
  | "calls_outbound"
  | "calls_answered"
  | "calls_voicemail"
  | "calls_missed"
  | "call_duration_total"
  | "call_duration_avg"
  | "call_connect_rate";

export type EmailMetric = "emails_sent" | "emails_received" | "emails_total";

export type SmsMetric = "sms_sent" | "sms_received" | "sms_total";

export type OpportunityMetric =
  | "pipeline_value"
  | "pipeline_count"
  | "win_rate"
  | "avg_deal_size"
  | "sales_velocity"
  | "avg_time_to_close"
  | "deals_won"
  | "deals_lost"
  | "deals_won_value";

export type LifecycleMetric =
  | "time_to_first_contact"
  | "time_to_quote"
  | "time_to_sold"
  | "time_to_negative"
  | "custom_status_path";

export type Metric =
  | LeadMetric
  | CallMetric
  | EmailMetric
  | SmsMetric
  | OpportunityMetric
  | LifecycleMetric;

export type MetricCategory = "leads" | "calls" | "email_sms" | "opportunities";

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

// ─── Widget Accent Colors ──────────────────────────────────────────

export type WidgetAccentColor =
  | "zinc"
  | "violet"
  | "emerald"
  | "amber"
  | "blue"
  | "rose"
  | "cyan"
  | "orange";

// ─── Widget Config (discriminated union by widget_type) ────────────

export interface BaseWidgetConfig {
  dateRange: DateRangePreset;
  customFrom?: string;
  customTo?: string;
  comparison: ComparisonPeriod;
  comparisonFrom?: string;
  comparisonTo?: string;
  smartViewId?: string | null;
  accentColor?: WidgetAccentColor;
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BestCallTimesConfig extends BaseWidgetConfig {}

export interface CrossReferenceConfig extends BaseWidgetConfig {
  smartViewIds: string[];
  statusIds: string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SpeedToLeadConfig extends BaseWidgetConfig {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ContactCadenceConfig extends BaseWidgetConfig {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DialAttemptsConfig extends BaseWidgetConfig {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LeadHeatSummaryConfig extends BaseWidgetConfig {}

export interface LeadHeatListConfig extends BaseWidgetConfig {
  filterLevel?: LeadHeatLevel | "all";
  sortBy?: "score_desc" | "score_asc" | "recency" | "name";
  pageSize?: number;
}

export interface LeadHeatAiInsightsConfig extends BaseWidgetConfig {
  showAnomalies?: boolean;
  showRecommendations?: boolean;
  showPatterns?: boolean;
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
  | VmRateSmartViewConfig
  | BestCallTimesConfig
  | SpeedToLeadConfig
  | ContactCadenceConfig
  | DialAttemptsConfig
  | LeadHeatSummaryConfig
  | LeadHeatListConfig
  | LeadHeatAiInsightsConfig;

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
  widget_id: string | null;
  resource_scope: string;
  resource_key: string;
  cache_key: string;
  result: WidgetResult | PrebuiltDashboardRollupResponse;
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

export interface StatCardSubMetric {
  label: string;
  value: number | string;
  color?: "success" | "warning" | "destructive" | "muted";
}

export interface StatCardResult {
  value: number;
  previousValue?: number;
  changePercent?: number;
  label: string;
  unit?: string;
  subMetrics?: StatCardSubMetric[];
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

export interface LifecycleTransition {
  from: string;
  to: string;
  avgDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
  sampleSize: number;
  durationSampleSize: number;
}

export interface LifecycleTrackerResult {
  transitions: LifecycleTransition[];
  totalChanges?: number;
  isTruncated?: boolean;
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

export interface OpportunityStatusEntry {
  id: string;
  label: string;
  count: number;
  value: number;
  type: string;
  avgAgeDays: number;
  staleCount: number;
  daysSinceLastActivity: number | null;
  untouchedCount: number;
}

export interface PipelineHealth {
  revenueAtRisk: number;
  untouchedActive: { count: number; value: number };
  staleActive: { count: number; value: number };
  weightedForecast: number;
  avgActivePipelineAge: number;
}

export interface OpportunitySummaryResult {
  totalValue: number;
  dealCount: number;
  activeCount: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  winRate: number;
  avgDealSize: number;
  salesVelocity?: number;
  avgTimeToClose?: number;
  stalledCount: number;
  byStatus?: OpportunityStatusEntry[];
  pipelineName?: string | null;
  pipelineHealth?: PipelineHealth;
  previousTotalValue?: number;
  previousDealCount?: number;
}

export interface CallAnalyticsResult {
  total: number;
  answered: number;
  voicemail: number;
  missed: number;
  inbound: number;
  outbound: number;
  connectRate: number;
  outboundConnectRate?: number;
  totalDurationMin: number;
  avgDurationMin: number;
  isTruncated?: boolean;
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

export interface BestCallTimesResult {
  hourly: {
    hour: number;
    label: string;
    total: number;
    answered: number;
    vm: number;
    noAnswer: number;
    connectRate: number;
  }[];
  daily: {
    day: number;
    label: string;
    total: number;
    answered: number;
    connectRate: number;
  }[];
  bestHour: {
    hour: number;
    label: string;
    connectRate: number;
    total: number;
  } | null;
  bestDay: {
    day: number;
    label: string;
    connectRate: number;
    total: number;
  } | null;
  totalCalls: number;
  isTruncated: boolean;
}

export interface SpeedToLeadResult {
  avgMinutes: number;
  medianMinutes: number;
  distribution: { label: string; max: number; count: number }[];
  totalLeads: number;
  leadsWithActivity: number;
  pctContacted: number;
  firstContactChannel?: {
    channel: string;
    count: number;
    avgMinutes: number;
  }[];
  missedWindows?: {
    label: string;
    count: number;
    pctOfContacted: number;
  }[];
  untouchedAvgAgeDays?: number;
}

export interface ContactCadenceResult {
  avgGapHours: number;
  medianGapHours: number;
  totalLeads: number;
  leadsContacted: number;
  leadsMultiTouch: number;
  totalTouches: number;
  avgTouchesPerLead: number;
  touchDistribution: { touches: number; leads: number }[];
  channelMix?: { channel: string; count: number; pct: number }[];
}

export interface DialAttemptsResult {
  avgAttempts: number;
  medianAttempts: number;
  totalLeadsDialed: number;
  leadsConnected: number;
  neverConnected: number;
  connectPct: number;
  attemptRates: {
    attempt: number;
    total: number;
    answered: number;
    connectRate: number;
  }[];
  diminishingReturnsAttempt?: number | null;
}

export interface LeadHeatSummaryResult {
  distribution: { level: LeadHeatLevel; count: number; pct: number }[];
  totalScored: number;
  avgScore: number;
  avgScorePrevious: number | null;
  trend: LeadTrendDirection;
  lastScoredAt: string | null;
  isPersonalized: boolean;
  sampleSize: number;
}

export type LeadHeatDashboardState =
  | "never_scored"
  | "fresh"
  | "stale"
  | "running";

export interface LeadHeatDashboardStatus {
  state: LeadHeatDashboardState;
  hasCachedScores: boolean;
  lastScoredAt: string | null;
  lastRunStatus: "running" | "completed" | "failed" | null;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastRunErrorMessage: string | null;
  isTruncated: boolean;
  staleAfterMs: number;
}

export interface LeadHeatScoreRow {
  closeLeadId: string;
  displayName: string;
  score: number;
  heatLevel: LeadHeatLevel;
  trend: LeadTrendDirection;
  previousScore: number | null;
  lastTouchAt: string | null;
  currentStatus: string;
  topSignal: string;
  aiInsight: LeadHeatDeepDiveResult | null;
}

export interface LeadHeatListResult {
  leads: LeadHeatScoreRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadHeatAiInsightsResult {
  recommendations: { text: string; priority: "high" | "medium" | "low" }[];
  anomalies: {
    closeLeadId: string;
    displayName: string;
    type: string;
    message: string;
    urgency: string;
    score: number;
  }[];
  patterns: { title: string; description: string }[];
  weightAdjustments: {
    signalKey: string;
    recommendedMultiplier: number;
    reason: string;
  }[];
  // Current per-signal multipliers from `lead_heat_agent_weights.weights`.
  // Surfaced so the Manage Weights panel can show "current vs recommended"
  // for each signal without a separate query. Empty object means the user
  // has never edited weights — the panel falls back to 1.0 for every signal.
  currentWeights: Record<string, { multiplier: number }>;
  modelVersion: number;
  sampleSize: number;
  analyzedAt: string | null;
  overallAssessment: string;
}

export interface FollowUpGapStatus {
  statusId: string;
  label: string;
  totalLeads: number;
  untouchedCount: number;
  gapLeads: number;
  avgDaysSinceActivity: number | null;
}

export interface FollowUpGapsResult {
  items: FollowUpGapStatus[];
  totalLeads: number;
  totalNeedingAttention: number;
  totalUntouched: number;
  totalGap: number;
  gapThresholdDays: number;
}

export type PrebuiltCloseApiWidgetId =
  | "total_leads"
  | "new_leads"
  | "speed_to_lead"
  | "status_dist"
  | "lifecycle"
  | "call_analytics"
  | "best_call_times"
  | "follow_up_gaps"
  | "contact_cadence"
  | "dial_attempts"
  | "opp_funnel"
  | "cross_ref";

export interface PrebuiltCloseApiWidgetResults {
  total_leads: StatCardResult;
  new_leads: StatCardResult;
  speed_to_lead: SpeedToLeadResult;
  status_dist: StatusDistributionResult;
  lifecycle: LifecycleTrackerResult;
  call_analytics: CallAnalyticsResult;
  best_call_times: BestCallTimesResult;
  follow_up_gaps: FollowUpGapsResult;
  contact_cadence: ContactCadenceResult;
  dial_attempts: DialAttemptsResult;
  opp_funnel: OpportunitySummaryResult;
  cross_ref: CrossReferenceResult;
}

export interface PrebuiltDashboardRollupResponse {
  version: string;
  cacheHit: boolean;
  fetchedAt: string;
  expiresAt: string;
  widgets: PrebuiltCloseApiWidgetResults;
}

export interface LeadHeatDeepDiveResult {
  adjustedScore: number;
  confidence: number;
  heatLevel: LeadHeatLevel;
  narrative: string;
  keySignals: {
    signal: string;
    impact: "positive" | "negative" | "neutral";
    detail: string;
  }[];
  recommendedAction: { action: string; timing: string; reasoning: string };
  riskFactors: string[];
  conversionProbability: "high" | "medium" | "low" | "very_low";
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
  | VmRateSmartViewResult
  | BestCallTimesResult
  | SpeedToLeadResult
  | ContactCadenceResult
  | DialAttemptsResult
  | LeadHeatSummaryResult
  | LeadHeatListResult
  | LeadHeatAiInsightsResult;

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
