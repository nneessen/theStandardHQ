import { describe, it, expect } from "vitest";
import {
  WIDGET_REGISTRY,
  METRIC_CATALOG,
  WIDGET_CATEGORIES,
  getStatCardMetrics,
  getMetricsForCategory,
  getMetricDefinition,
  getWidgetColSpan,
} from "../widget-registry";
import type { WidgetType, Metric } from "../../types/close-kpi.types";

describe("WIDGET_REGISTRY", () => {
  it("has entries for all WidgetType values", () => {
    const expectedTypes: WidgetType[] = [
      "stat_card",
      "status_distribution",
      "lifecycle_tracker",
      "opportunity_summary",
      "call_analytics",
      "vm_rate_smart_view",
      "best_call_times",
      "cross_reference",
      "speed_to_lead",
      "contact_cadence",
      "dial_attempts",
    ];
    for (const type of expectedTypes) {
      expect(WIDGET_REGISTRY[type]).toBeDefined();
      expect(WIDGET_REGISTRY[type].type).toBe(type);
    }
  });

  it("every entry has required fields", () => {
    for (const [key, entry] of Object.entries(WIDGET_REGISTRY)) {
      expect(entry.label).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.icon).toBeTruthy();
      expect(entry.defaultSize).toBeTruthy();
      expect(entry.allowedSizes.length).toBeGreaterThan(0);
      expect(entry.defaultConfig).toBeDefined();
      // Default size must be in allowed sizes
      expect(entry.allowedSizes).toContain(entry.defaultSize);
      // Type must match key
      expect(entry.type).toBe(key);
    }
  });

  it("no entry has comingSoon flag", () => {
    for (const entry of Object.values(WIDGET_REGISTRY)) {
      expect(entry.comingSoon).toBeFalsy();
    }
  });

  it("colSpan values are positive", () => {
    for (const entry of Object.values(WIDGET_REGISTRY)) {
      expect(entry.colSpan.small).toBeGreaterThan(0);
      expect(entry.colSpan.medium).toBeGreaterThan(0);
      expect(entry.colSpan.large).toBeGreaterThan(0);
    }
  });
});

describe("METRIC_CATALOG", () => {
  it("has no duplicate metric keys", () => {
    const keys = METRIC_CATALOG.map((m) => m.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("every metric has required fields", () => {
    for (const metric of METRIC_CATALOG) {
      expect(metric.key).toBeTruthy();
      expect(metric.label).toBeTruthy();
      expect(metric.description).toBeTruthy();
      expect(metric.category).toBeTruthy();
      expect(metric.aggregationType).toBeTruthy();
      expect(metric.objectType).toBeTruthy();
    }
  });

  it("every metric category exists in WIDGET_CATEGORIES", () => {
    const validCategories = new Set(WIDGET_CATEGORIES.map((c) => c.id));
    for (const metric of METRIC_CATALOG) {
      expect(validCategories.has(metric.category)).toBe(true);
    }
  });

  it("contains at least one metric per category", () => {
    for (const cat of WIDGET_CATEGORIES) {
      const metricsInCategory = METRIC_CATALOG.filter(
        (m) => m.category === cat.id,
      );
      expect(metricsInCategory.length).toBeGreaterThan(0);
    }
  });
});

describe("getStatCardMetrics", () => {
  it("returns all catalog metrics (all are implemented)", () => {
    const metrics = getStatCardMetrics();
    expect(metrics.length).toBe(METRIC_CATALOG.length);
  });

  it("returns valid MetricDefinition objects", () => {
    const metrics = getStatCardMetrics();
    for (const m of metrics) {
      expect(m.key).toBeTruthy();
      expect(m.label).toBeTruthy();
    }
  });
});

describe("getMetricsForCategory", () => {
  it("returns only metrics for the specified category", () => {
    const callMetrics = getMetricsForCategory("calls");
    expect(callMetrics.length).toBeGreaterThan(0);
    for (const m of callMetrics) {
      expect(m.category).toBe("calls");
    }
  });

  it("returns empty array for non-existent category", () => {
    // @ts-expect-error Testing with invalid category
    const metrics = getMetricsForCategory("nonexistent");
    expect(metrics).toEqual([]);
  });
});

describe("getMetricDefinition", () => {
  it("finds a known metric", () => {
    const def = getMetricDefinition("lead_count");
    expect(def).toBeDefined();
    expect(def?.label).toBe("Total Leads");
  });

  it("returns undefined for unknown metric", () => {
    const def = getMetricDefinition("nonexistent" as Metric);
    expect(def).toBeUndefined();
  });
});

describe("getWidgetColSpan", () => {
  it("returns correct col span for stat_card small", () => {
    const span = getWidgetColSpan("stat_card", "small");
    expect(span).toBe(1);
  });

  it("returns correct col span for status_distribution large", () => {
    const span = getWidgetColSpan("status_distribution", "large");
    expect(span).toBe(2);
  });
});
