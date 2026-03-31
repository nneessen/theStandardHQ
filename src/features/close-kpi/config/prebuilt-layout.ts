// src/features/close-kpi/config/prebuilt-layout.ts
// Pre-built dashboard layout: sections, widget configs, and tooltip content.
// No manual widget adding — everything renders automatically.

import type {
  WidgetType,
  WidgetSize,
  WidgetConfig,
  DateRangePreset,
  StatCardConfig,
  StatusDistributionConfig,
  CallAnalyticsConfig,
  OpportunitySummaryConfig,
  LifecycleTrackerConfig,
  VmRateSmartViewConfig,
  BestCallTimesConfig,
  CrossReferenceConfig,
  SpeedToLeadConfig,
  ContactCadenceConfig,
  DialAttemptsConfig,
  LeadHeatSummaryConfig,
  LeadHeatListConfig,
  LeadHeatAiInsightsConfig,
} from "../types/close-kpi.types";

// ─── Tooltip Content ──────────────────────────────────────────────────

export interface TooltipDef {
  title: string;
  description: string;
  formula?: string;
  note?: string;
}

export const SECTION_TOOLTIPS: Record<string, TooltipDef> = {
  ai_lead_scoring: {
    title: "AI Lead Scoring",
    description:
      "AI analyzes your Close CRM activity to score each lead 0-100. Hot leads need immediate attention. AI-generated insights highlight portfolio patterns and recommended actions.",
    note: "Scores update automatically every 30 minutes",
  },
  lead_pipeline: {
    title: "Lead Pipeline",
    description:
      "Track how leads move through your pipeline — from creation to first contact to conversion. Identify bottlenecks where leads stall out and take action before they go cold.",
  },
  call_performance: {
    title: "Call Performance",
    description:
      "Understand your calling patterns — when leads actually answer, how many attempts it takes to connect, and which smart views have the worst voicemail rates. Use this to optimize when and how you dial.",
  },
  pipeline_revenue: {
    title: "Pipeline & Revenue",
    description:
      "Track deal values, win rates, and pipeline velocity across your opportunity stages. See exactly where revenue is coming from and where deals are getting stuck.",
  },
};

export const WIDGET_TOOLTIPS: Record<string, TooltipDef> = {
  // AI Lead Scoring
  lead_heat_summary: {
    title: "Lead Heat Distribution",
    description:
      "How your leads are spread across heat levels. A healthy pipeline has a steady flow from cold to hot. If most leads are cold, your follow-up cadence may need work.",
    note: "Scores update every 30 minutes via AI analysis",
  },
  lead_heat_ai_insights: {
    title: "AI Recommendations",
    description:
      "AI-generated insights based on your portfolio patterns. Includes recommended actions, anomaly detection (hot leads being ignored), and conversion pattern analysis.",
    note: "Insights are generated from your portfolio patterns and recent outcomes",
  },
  lead_heat_list: {
    title: "Lead Rankings",
    description:
      "Every lead ranked by heat score. Click any lead to get an AI-powered deep dive with recommended actions, timing suggestions, and conversion probability.",
  },

  // Lead Pipeline
  stat_card_total: {
    title: "Total Leads",
    description:
      "Count of all leads in your Close CRM matching the selected date range and filters.",
  },
  stat_card_new: {
    title: "New Leads Created",
    description:
      "Leads created within the selected date range. A declining number means your lead sources may need attention.",
  },
  speed_to_lead: {
    title: "Speed to Lead",
    description:
      "How fast you make first contact after a lead is created. Industry data shows contacting within 5 minutes is 21x more effective than waiting 30 minutes.",
    formula: "Time from lead creation → first outbound call, email, or SMS",
  },
  status_distribution: {
    title: "Status Distribution",
    description:
      "How many leads are in each status. Look for bottlenecks — if most leads are stuck in 'Contacted/No Answer', your connect strategy needs work.",
  },
  lifecycle_tracker: {
    title: "Lifecycle Velocity",
    description:
      "How long it takes leads to move between statuses. Slow transitions mean leads are cooling off. Fast transitions mean your process is working.",
    formula: "Average days from one status to the next",
  },

  // Call Performance
  call_analytics: {
    title: "Call Analytics",
    description:
      "Breakdown of your calling activity — total calls, connect rate, voicemail rate, and average duration. Higher connect rates mean more conversations and more sales.",
    formula: "Connect Rate = Answered Calls ÷ Total Outbound Calls",
  },
  best_call_times: {
    title: "Best Time to Call",
    description:
      "Shows which hours and days have the highest connect rate. Schedule your power-dial sessions when leads actually pick up.",
    note: "Needs at least 50 calls for reliable patterns",
  },
  vm_rate_smart_view: {
    title: "VM Rate by Smart View",
    description:
      "First-call voicemail rate for each smart view. High VM rates (40%+) often indicate bad lead batches or stale data. Compare across sources to find your best lists.",
    formula: "VM Rate = (VM Left + No Answer) ÷ First Outbound Calls per Lead",
  },
  contact_cadence: {
    title: "Contact Cadence",
    description:
      "Time gaps between touches on each lead. Consistent follow-up (every 2-3 days) converts better than sporadic calling.",
    formula: "Average hours between sequential touches per lead",
  },
  dial_attempts: {
    title: "Dial Attempts",
    description:
      "How many calls it takes before you connect with a lead. Most sales happen after 5+ attempts — track whether you're giving up too early.",
    formula: "Outbound call count per lead before first 'answered' disposition",
  },

  // Pipeline Revenue
  opportunity_summary: {
    title: "Opportunity Funnel",
    description:
      "Pipeline value, win rate, average deal size, and sales velocity across your opportunities. Track the health of your revenue pipeline.",
    formula:
      "Sales Velocity = (Deals × Avg Size × Win Rate) ÷ Avg Days to Close",
  },
  cross_reference: {
    title: "Smart View × Status Matrix",
    description:
      "Cross-reference your smart views against lead statuses. Quickly spot which lead lists have the most leads stuck in bad statuses (blocked, VM, no answer).",
  },
};

// ─── Section Definitions ──────────────────────────────────────────────

export interface PrebuiltWidgetDef {
  id: string;
  type: WidgetType;
  title: string;
  tooltipKey: string;
  size: WidgetSize | "full";
  colSpan?: string; // Tailwind col-span class override
  buildConfig: (dateRange: DateRangePreset) => WidgetConfig;
}

export interface SectionDef {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  tooltipKey: string;
  gridClass: string;
  variant?: "default" | "hero";
  widgets: PrebuiltWidgetDef[];
}

const BASE_CONFIG = (dateRange: DateRangePreset) => ({
  dateRange,
  comparison: "none" as const,
});

export const DASHBOARD_SECTIONS: SectionDef[] = [
  // ═══ Section 1: AI Lead Scoring (Hero) ═══
  {
    id: "ai_lead_scoring",
    title: "AI Lead Scoring",
    description:
      "AI-powered scoring ranks every lead in your pipeline by likelihood to convert",
    icon: "Flame",
    tooltipKey: "ai_lead_scoring",
    gridClass: "grid grid-cols-1 md:grid-cols-3 gap-3",
    widgets: [
      {
        id: "heat_summary",
        type: "lead_heat_summary",
        title: "Heat Distribution",
        tooltipKey: "lead_heat_summary",
        size: "medium",
        colSpan: "md:col-span-1",
        buildConfig: (dr) =>
          ({ ...BASE_CONFIG(dr) }) satisfies LeadHeatSummaryConfig,
      },
      {
        id: "ai_insights",
        type: "lead_heat_ai_insights",
        title: "AI Recommendations",
        tooltipKey: "lead_heat_ai_insights",
        size: "medium",
        colSpan: "md:col-span-2",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            showAnomalies: true,
            showRecommendations: true,
            showPatterns: true,
          }) satisfies LeadHeatAiInsightsConfig,
      },
      {
        id: "heat_list",
        type: "lead_heat_list",
        title: "Lead Rankings",
        tooltipKey: "lead_heat_list",
        size: "full",
        colSpan: "col-span-full",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            filterLevel: "all",
            sortBy: "score_desc",
            pageSize: 25,
          }) satisfies LeadHeatListConfig,
      },
    ],
  },

  // ═══ Section 2: Lead Pipeline ═══
  {
    id: "lead_pipeline",
    title: "Lead Pipeline",
    description:
      "Track leads from creation through conversion — spot bottlenecks before they cost you",
    icon: "Users",
    tooltipKey: "lead_pipeline",
    gridClass: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2",
    widgets: [
      {
        id: "total_leads",
        type: "stat_card",
        title: "Total Leads",
        tooltipKey: "stat_card_total",
        size: "small",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            metric: "lead_count",
            comparison: "previous_period",
          }) satisfies StatCardConfig,
      },
      {
        id: "new_leads",
        type: "stat_card",
        title: "New Leads",
        tooltipKey: "stat_card_new",
        size: "small",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            metric: "leads_created",
            comparison: "previous_period",
          }) satisfies StatCardConfig,
      },
      {
        id: "speed_to_lead",
        type: "speed_to_lead",
        title: "Speed to Lead",
        tooltipKey: "speed_to_lead",
        size: "small",
        buildConfig: (dr) =>
          ({ ...BASE_CONFIG(dr) }) satisfies SpeedToLeadConfig,
      },
      {
        id: "status_dist",
        type: "status_distribution",
        title: "Status Distribution",
        tooltipKey: "status_distribution",
        size: "medium",
        colSpan: "lg:col-span-2",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            groupBy: "status",
            sortOrder: "count_desc",
          }) satisfies StatusDistributionConfig,
      },
      {
        id: "lifecycle",
        type: "lifecycle_tracker",
        title: "Lifecycle Velocity",
        tooltipKey: "lifecycle_tracker",
        size: "medium",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            metric: "time_to_first_contact",
            fromStatus: "New",
            toStatus: null,
          }) satisfies LifecycleTrackerConfig,
      },
    ],
  },

  // ═══ Section 3: Call Performance ═══
  {
    id: "call_performance",
    title: "Call Performance",
    description:
      "Optimize your dialing strategy — know when to call, how many times, and what to expect",
    icon: "Phone",
    tooltipKey: "call_performance",
    gridClass: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2",
    widgets: [
      {
        id: "call_analytics",
        type: "call_analytics",
        title: "Call Analytics",
        tooltipKey: "call_analytics",
        size: "medium",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            metric: "calls_total",
            direction: "all",
          }) satisfies CallAnalyticsConfig,
      },
      {
        id: "best_call_times",
        type: "best_call_times",
        title: "Best Time to Call",
        tooltipKey: "best_call_times",
        size: "medium",
        buildConfig: (dr) =>
          ({ ...BASE_CONFIG(dr) }) satisfies BestCallTimesConfig,
      },
      {
        id: "vm_rate",
        type: "vm_rate_smart_view",
        title: "VM Rate by Smart View",
        tooltipKey: "vm_rate_smart_view",
        size: "medium",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            smartViewIds: [], // auto-populated from metadata
            vmThreshold: 40,
            firstCallOnly: true,
          }) satisfies VmRateSmartViewConfig,
      },
      {
        id: "contact_cadence",
        type: "contact_cadence",
        title: "Contact Cadence",
        tooltipKey: "contact_cadence",
        size: "medium",
        colSpan: "lg:col-span-2",
        buildConfig: (dr) =>
          ({ ...BASE_CONFIG(dr) }) satisfies ContactCadenceConfig,
      },
      {
        id: "dial_attempts",
        type: "dial_attempts",
        title: "Dial Attempts",
        tooltipKey: "dial_attempts",
        size: "medium",
        buildConfig: (dr) =>
          ({ ...BASE_CONFIG(dr) }) satisfies DialAttemptsConfig,
      },
    ],
  },

  // ═══ Section 4: Pipeline & Revenue ═══
  {
    id: "pipeline_revenue",
    title: "Pipeline & Revenue",
    description:
      "Track deal flow, win rates, and revenue across your opportunity pipeline",
    icon: "DollarSign",
    tooltipKey: "pipeline_revenue",
    gridClass: "grid grid-cols-1 gap-2",
    widgets: [
      {
        id: "opp_funnel",
        type: "opportunity_summary",
        title: "Opportunity Funnel",
        tooltipKey: "opportunity_summary",
        size: "medium",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            metric: "pipeline_value",
            statusType: "active",
          }) satisfies OpportunitySummaryConfig,
      },
      {
        id: "cross_ref",
        type: "cross_reference",
        title: "Smart View × Status",
        tooltipKey: "cross_reference",
        size: "large",
        buildConfig: (dr) =>
          ({
            ...BASE_CONFIG(dr),
            smartViewIds: [], // auto-populated from metadata
            statusIds: [],
          }) satisfies CrossReferenceConfig,
      },
    ],
  },
];
