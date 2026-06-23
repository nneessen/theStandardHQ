// src/features/analytics/tabs/ProductionTab.tsx
// The production deep-dive: conversion, pipeline, AI growth, period-over-period
// comparison, product mix, premium by state, and carriers.

import { Suspense } from "react";
import { AnalyticsSectionGate } from "@/components/subscription";
import { ROW_1, ROW_3, ROW_3_WIDE } from "./grid";
import {
  FunnelPanel,
  PipelinePanel,
  GrowthChartPanel,
  TrendComparisonPanel,
  ProductMixPanel,
  PremiumByStatePanel,
  CarriersPanel,
  Cell,
  AiCell,
  PanelSkeleton,
} from "./panels";

export function ProductionTab() {
  return (
    <>
      {/* Funnel | Pipeline | AI growth */}
      <div className={ROW_3}>
        <Cell section="conversion_funnel" minHeight={300}>
          <FunnelPanel />
        </Cell>
        <Cell section="commission_pipeline" minHeight={300}>
          <PipelinePanel />
        </Cell>
        <AiCell minHeight={300}>
          <GrowthChartPanel />
        </AiCell>
      </div>

      {/* Trend comparison (2-wide) | stack(Product mix + Premium by state) */}
      <div className={ROW_3_WIDE}>
        <Cell section="trend_comparison" span={2} minHeight={340}>
          <TrendComparisonPanel />
        </Cell>
        <div
          style={{
            display: "grid",
            gap: 24,
            alignContent: "start",
            minWidth: 0,
          }}
        >
          <AnalyticsSectionGate section="product_matrix">
            <Suspense fallback={<PanelSkeleton minHeight={160} />}>
              <ProductMixPanel />
            </Suspense>
          </AnalyticsSectionGate>
          <AnalyticsSectionGate section="geographic">
            <Suspense fallback={<PanelSkeleton minHeight={160} />}>
              <PremiumByStatePanel />
            </Suspense>
          </AnalyticsSectionGate>
        </div>
      </div>

      {/* Carriers (full width) */}
      <div className={ROW_1}>
        <Cell section="carriers_products" minHeight={240}>
          <CarriersPanel />
        </Cell>
      </div>
    </>
  );
}
