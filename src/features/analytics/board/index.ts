// "The Board" analytics panels — verdict-first re-skin of the Analytics page.
// Each panel is self-contained: it reuses the existing analytics hooks/services
// (TanStack Query dedupes the shared fetches) and renders into the shipped
// Board design system (charcoal surfaces, `@/components/board` primitives).
export { AnalyticsHero } from "./AnalyticsHero";
export { TrendChartPanel } from "./TrendChartPanel";
export { GrowthChartPanel } from "./GrowthChartPanel";
export { AgentTablePanel } from "./AgentTablePanel";
export { InboundEconomicsPanel } from "./InboundEconomicsPanel";
export { TeamInboundEconomicsPanel } from "./TeamInboundEconomicsPanel";
export { ClientSegmentsPanel } from "./ClientSegmentsPanel";
export { PipelinePanel } from "./PipelinePanel";
export { TrendComparisonPanel } from "./TrendComparisonPanel";
export { ProductMixPanel } from "./ProductMixPanel";
export { PremiumByStatePanel } from "./PremiumByStatePanel";
export { CarriersPanel } from "./CarriersPanel";

// ─── Inbound Calls section (always-visible; reuses the kpi call-analytics layer) ─
export { InboundCallsOverviewPanel } from "./inbound/InboundCallsOverviewPanel";
export { CallTimingPanel } from "./inbound/CallTimingPanel";
export { CallLengthPanel } from "./inbound/CallLengthPanel";
export { CallDemographicsPanel } from "./inbound/CallDemographicsPanel";
export { CallGeographyPanel } from "./inbound/CallGeographyPanel";
export { WordTrackEffectivenessPanel } from "./inbound/WordTrackEffectivenessPanel";
