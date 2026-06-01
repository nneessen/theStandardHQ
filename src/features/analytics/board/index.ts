// "The Board" analytics panels — verdict-first re-skin of the Analytics page.
// Each panel is self-contained: it reuses the existing analytics hooks/services
// (TanStack Query dedupes the shared fetches) and renders into the shipped
// Board design system (charcoal surfaces, `@/components/board` primitives).
export { AnalyticsHero } from "./AnalyticsHero";
export { TrendChartPanel } from "./TrendChartPanel";
export { GrowthChartPanel } from "./GrowthChartPanel";
export { ActionFeedPanel } from "./ActionFeedPanel";
export { AgentTablePanel } from "./AgentTablePanel";
export { FunnelPanel } from "./FunnelPanel";
export { ClientSegmentsPanel } from "./ClientSegmentsPanel";
export { PipelinePanel } from "./PipelinePanel";
export { TrendComparisonPanel } from "./TrendComparisonPanel";
export { ProductMixPanel } from "./ProductMixPanel";
export { PremiumByStatePanel } from "./PremiumByStatePanel";
export { CarriersPanel } from "./CarriersPanel";
