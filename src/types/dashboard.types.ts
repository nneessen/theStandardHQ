// src/types/dashboard.types.ts

/**
 * Dashboard Type Definitions
 *
 * TypeScript interfaces and types for dashboard components and data.
 */

import { TimePeriod } from "../utils/dateRange";
import { METRIC_COLORS } from "../constants/dashboard";

/**
 * Tooltip configuration for metric explanations
 */
export interface MetricTooltipConfig {
  title: string;
  description: string;
  formula?: string;
  example?: string;
  note?: string;
}

/**
 * Heatmap intensity hint for a single KPI. Drives the cell tint in
 * KPIGridHeatmap. Optional — when omitted, the cell renders neutral.
 *
 * - `numeric`: the raw value to compare (e.g., 62.4 for "62.4%")
 * - `direction`: "higher_better" tints green when high, red when low.
 *                "lower_better" inverts (e.g., lapse rate, expenses).
 *                "neutral" renders without tint.
 * - `target`: optional reference value. If provided, intensity = value / target
 *             (clamped 0..1.5). If omitted, falls back to absolute thresholds
 *             baked into the renderer (works well for percentages 0–100).
 */
export interface KPIIntensity {
  numeric: number;
  direction: "higher_better" | "lower_better" | "neutral";
  target?: number;
}

/**
 * KPI section for DetailedKPIGrid
 */
export interface KPISection {
  category: string;
  kpis: Array<{
    label: string;
    value: string | number;
    /** Optional heatmap hint — drives cell tint when present. */
    intensity?: KPIIntensity;
  }>;
  /** Whether this section is gated (user lacks access) */
  gated?: boolean;
  /** Required tier for display when gated */
  requiredTier?: string;
}

/**
 * Alert configuration for AlertsPanel
 */
export interface AlertConfig {
  type: "info" | "warning" | "danger" | "error";
  title: string;
  message: string;
  condition: boolean; // Whether to show this alert
}

/**
 * Quick action button configuration
 */
export interface QuickAction {
  label: string;
  action: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  /** Whether user has access to this action (for gating) */
  hasAccess?: boolean;
  /** Tooltip when locked */
  lockedTooltip?: string;
  /** Required tier name for display */
  requiredTier?: string;
}

/**
 * Dashboard metrics from hooks
 */
export interface DashboardMetrics {
  periodCommissions: {
    earned: number;
    count: number;
    averageAmount: number;
    averageRate: number;
  };
  periodExpenses: {
    total: number;
    count: number;
    recurring: number;
    oneTime: number;
  };
  periodPolicies: {
    newCount: number;
    cancelled: number;
    lapsed: number;
    premiumWritten: number;
    averagePremium: number;
    commissionableValue: number;
  };
  periodClients: {
    newCount: number;
    totalValue: number;
    averageAge: number;
  };
  currentState: {
    activePolicies: number;
    totalPolicies: number;
    totalClients: number;
    pendingPipeline: number;
    retentionRate: number;
  };
  periodAnalytics: {
    policiesNeeded: number;
    breakevenNeeded: number;
    surplusDeficit: number;
    netIncome: number;
    profitMargin: number;
    paceMetrics: {
      dailyTarget: number;
      weeklyTarget: number;
      monthlyTarget: number;
    };
  };
}

/**
 * Derived calculations from dashboard metrics
 */
export interface DerivedMetrics {
  lapsedRate: number;
  cancellationRate: number;
  avgClientValue: number;
}

/**
 * Time period switcher props
 */
export interface TimePeriodSwitcherProps {
  timePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
}

/**
 * Detailed KPI grid props
 */
export interface DetailedKPIGridProps {
  sections: KPISection[];
}

/**
 * Performance status type
 */
export type PerformanceStatus = "hit" | "good" | "fair" | "poor" | "neutral";

/**
 * Color scheme type for metrics
 * Represents the actual Tailwind class names used for metric colors
 */
export type MetricColor = (typeof METRIC_COLORS)[keyof typeof METRIC_COLORS];

/**
 * KPI layout variant type
 */
export type KPILayout = "heatmap" | "narrative" | "matrix";

/**
 * KPI layout switcher props
 */
export interface KPILayoutSwitcherProps {
  layout: KPILayout;
  onLayoutChange: (layout: KPILayout) => void;
}
