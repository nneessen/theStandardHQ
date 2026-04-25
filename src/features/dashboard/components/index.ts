// src/features/dashboard/components/index.ts

// Editorial dashboard components
export { Masthead } from "./Masthead";
export { HeroSummary } from "./HeroSummary";
export { SecondaryMetricsRow } from "./SecondaryMetricsRow";
export { PaceLines } from "./PaceLines";
export { EditorialAlertsActions } from "./EditorialAlertsActions";
export { DetailsSection } from "./DetailsSection";

// Period chrome (still used by other dashboards in the app)
export { TimePeriodSwitcher } from "./TimePeriodSwitcher";
export { PeriodNavigator } from "./PeriodNavigator";
export { DateRangeDisplay } from "./DateRangeDisplay";

// Legacy KPI grid variants (for layout switcher)
export { KPIGrid } from "./KPIGrid";
export { KPIGridHeatmap } from "./KPIGridHeatmap";
export { KPIGridNarrative } from "./KPIGridNarrative";
export { KPIGridMatrix } from "./KPIGridMatrix";
export { KPILayoutSwitcher } from "./KPILayoutSwitcher";
export { MiniSparkline } from "./kpi-layouts/MiniSparkline";
export { CircularGauge } from "./kpi-layouts/CircularGauge";
export { NarrativeInsight } from "./kpi-layouts/NarrativeInsight";

// Org / Team sections
export { OrgMetricsSection } from "./OrgMetricsSection";
export { TeamRecruitingSection } from "./TeamRecruitingSection";

// Subscription gating
export { GatedAction } from "./GatedAction";
export { GatedKPISection } from "./GatedKPISection";

// Activity feed (used by HierarchyDashboardCompact)
export { ActivityFeed } from "./ActivityFeed";
