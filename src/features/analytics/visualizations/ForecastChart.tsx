// src/features/analytics/visualizations/ForecastChart.tsx

import React from "react";
import { GrowthProjection } from "../../../services/analytics/forecastService";

interface ForecastChartProps {
  data: GrowthProjection[];
  title?: string;
  valueKey?: "projectedPolicies" | "projectedRevenue" | "projectedCommission";
  valueLabel?: string;
}

/**
 * ForecastChart - Line chart with confidence intervals
 *
 * Displays growth projections with visual confidence bands
 */
export function ForecastChart({
  data,
  title = "Growth Forecast",
  valueKey = "projectedCommission",
  valueLabel = "Projected Commission",
}: ForecastChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-10 text-center text-v2-ink-subtle dark:text-v2-ink-muted text-xs">
        No forecast data available
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  const values = data
    .map((d) => d[valueKey] || 0)
    .filter((v) => !isNaN(v) && isFinite(v));
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const valueRange = Math.max(maxValue - minValue, 1);

  const padding = { top: 40, right: 60, bottom: 60, left: 60 };
  const viewBoxWidth = 600;
  const viewBoxHeight = 300;
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  const dataLength = Math.max(data.length - 1, 1);
  const scaleX = (index: number) => (index / dataLength) * chartWidth;
  const scaleY = (value: number) => {
    if (isNaN(value) || !isFinite(value)) return chartHeight / 2;
    return chartHeight - ((value - minValue) / valueRange) * chartHeight;
  };

  const getConfidenceMargin = (
    confidence: "high" | "medium" | "low",
  ): number => {
    if (confidence === "high") return 0.05;
    if (confidence === "medium") return 0.15;
    return 0.25;
  };

  const linePath = data
    .map((d, i) => {
      const x = scaleX(i);
      const y = scaleY(d[valueKey] || 0);
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return "";
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .filter(Boolean)
    .join(" ");

  const upperBandPath = data
    .map((d, i) => {
      const margin = getConfidenceMargin(d.confidence);
      const value = (d[valueKey] || 0) * (1 + margin);
      const x = scaleX(i);
      const y = scaleY(value);
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return "";
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .filter(Boolean)
    .join(" ");

  const lowerBandPathSegments = data
    .map((d, i) => {
      const margin = getConfidenceMargin(d.confidence);
      const value = (d[valueKey] || 0) * (1 - margin);
      const x = scaleX(i);
      const y = scaleY(value);
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return null;
      return { x, y, isFirst: i === 0 };
    })
    .filter(
      (seg): seg is { x: number; y: number; isFirst: boolean } => seg !== null,
    );

  const lowerBandPath = lowerBandPathSegments
    .map((seg, _i) =>
      seg.isFirst ? `M ${seg.x} ${seg.y}` : `L ${seg.x} ${seg.y}`,
    )
    .join(" ");

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = minValue + (valueRange * i) / 4;
    const y = scaleY(value);
    return { value, y: isNaN(y) || !isFinite(y) ? 0 : y };
  });

  return (
    <div className="w-full">
      {/* Title */}
      <div className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mb-4">
        {title}
      </div>

      {/* Chart SVG - responsive with viewBox */}
      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto max-w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {/* Grid lines */}
            {yTicks.map((tick, i) => (
              <line
                key={`grid-${i}`}
                x1={0}
                y1={tick.y}
                x2={chartWidth}
                y2={tick.y}
                stroke="#3f3f46"
                strokeOpacity="0.2"
                strokeWidth="1"
              />
            ))}

            {/* Confidence band */}
            {upperBandPath &&
              lowerBandPath &&
              lowerBandPathSegments.length > 0 && (
                <path
                  d={`${upperBandPath} ${lowerBandPathSegments
                    .reverse()
                    .map((seg) => `L ${seg.x} ${seg.y}`)
                    .join(" ")} Z`}
                  fill="#3b82f6"
                  opacity={0.1}
                />
              )}

            {/* Upper confidence line */}
            {upperBandPath && (
              <path
                d={upperBandPath}
                stroke="#3b82f6"
                strokeWidth="1"
                strokeDasharray="4,4"
                fill="none"
                opacity={0.4}
              />
            )}

            {/* Lower confidence line */}
            {lowerBandPath && (
              <path
                d={lowerBandPath}
                stroke="#3b82f6"
                strokeWidth="1"
                strokeDasharray="4,4"
                fill="none"
                opacity={0.4}
              />
            )}

            {/* Main forecast line */}
            {linePath && (
              <path
                d={linePath}
                stroke="#3b82f6"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {data.map((d, i) => {
              const x = scaleX(i);
              const y = scaleY(d[valueKey] || 0);
              const color =
                d.confidence === "high"
                  ? "#10b981"
                  : d.confidence === "medium"
                    ? "#f59e0b"
                    : "#ef4444";

              if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y))
                return null;

              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r={5}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="cursor-pointer"
                  />
                  <title>{`${d.periodLabel}: ${formatCurrency(d[valueKey] || 0)} (${d.confidence} confidence)`}</title>
                </g>
              );
            })}

            {/* Axes */}
            <line
              x1={0}
              y1={chartHeight}
              x2={chartWidth}
              y2={chartHeight}
              stroke="#71717a"
              strokeWidth="2"
            />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={chartHeight}
              stroke="#71717a"
              strokeWidth="2"
            />

            {/* Y-axis labels */}
            {yTicks.map((tick, i) => (
              <g key={`y-label-${i}`}>
                <line
                  x1={-6}
                  y1={tick.y}
                  x2={0}
                  y2={tick.y}
                  stroke="#71717a"
                  strokeWidth="2"
                />
                <text
                  x={-10}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="10px"
                  fill="#71717a"
                >
                  {valueKey === "projectedPolicies"
                    ? tick.value.toFixed(0)
                    : formatNumber(tick.value)}
                </text>
              </g>
            ))}

            {/* X-axis labels */}
            {data
              .filter((_, i) => i % 2 === 0)
              .map((d, idx) => {
                const i = idx * 2;
                const x = scaleX(i);
                return (
                  <g key={`x-label-${i}`}>
                    <line
                      x1={x}
                      y1={chartHeight}
                      x2={x}
                      y2={chartHeight + 6}
                      stroke="#71717a"
                      strokeWidth="2"
                    />
                    <text
                      x={x}
                      y={chartHeight + 20}
                      textAnchor="middle"
                      fontSize="10px"
                      fill="#71717a"
                    >
                      {d.periodLabel.split(" ")[0]}
                    </text>
                  </g>
                );
              })}

            {/* Y-axis label */}
            <text
              x={-chartHeight / 2}
              y={-45}
              textAnchor="middle"
              fontSize="11px"
              fontWeight="600"
              fill="#a1a1aa"
              transform={`rotate(-90, ${-chartHeight / 2}, -45)`}
            >
              {valueLabel}
            </text>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-5 flex gap-4 text-xs text-v2-ink-muted dark:text-v2-ink-subtle flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-success rounded-full" />
          <span>High Confidence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-warning rounded-full" />
          <span>Medium Confidence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-destructive rounded-full" />
          <span>Low Confidence</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <svg width="20" height="8">
            <rect
              x="0"
              y="3"
              width="20"
              height="2"
              fill="#3b82f6"
              opacity="0.2"
            />
          </svg>
          <span>Confidence Interval</span>
        </div>
      </div>
    </div>
  );
}
