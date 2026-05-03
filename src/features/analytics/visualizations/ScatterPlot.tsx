// src/features/analytics/visualizations/ScatterPlot.tsx

import React from "react";

export interface ScatterDataPoint {
  x: number;
  y: number;
  label: string;
  size?: number;
  color?: string;
}

interface ScatterPlotProps {
  data: ScatterDataPoint[];
  xLabel: string;
  yLabel: string;
  title?: string;
  width?: number;
  height?: number;
}

/**
 * ScatterPlot - Generic scatter plot visualization
 *
 * Used for visualizing relationships between two variables
 * (e.g., age vs premium, carrier ROI, etc.)
 */
export function ScatterPlot({
  data,
  xLabel,
  yLabel,
  title,
  width = 500,
  height = 300,
}: ScatterPlotProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-10 text-center text-muted-foreground text-xs">
        No data available
      </div>
    );
  }

  // Calculate bounds with null safety
  const xValues = data
    .map((d) => d.x || 0)
    .filter((v) => !isNaN(v) && isFinite(v));
  const yValues = data
    .map((d) => d.y || 0)
    .filter((v) => !isNaN(v) && isFinite(v));
  const xMin = Math.min(...xValues, 0);
  const xMax = Math.max(...xValues, 1);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues, 1);

  // Add padding
  const xRange = Math.max(xMax - xMin, 1); // Minimum range of 1
  const yRange = Math.max(yMax - yMin, 1); // Minimum range of 1
  const xPadding = xRange * 0.1;
  const yPadding = yRange * 0.1;

  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scale functions with null safety
  const scaleX = (value: number) => {
    if (isNaN(value) || !isFinite(value)) return chartWidth / 2;
    return ((value - (xMin - xPadding)) / (xRange + 2 * xPadding)) * chartWidth;
  };

  const scaleY = (value: number) => {
    if (isNaN(value) || !isFinite(value)) return chartHeight / 2;
    return (
      chartHeight -
      ((value - (yMin - yPadding)) / (yRange + 2 * xPadding)) * chartHeight
    );
  };

  // Format numbers
  const formatNumber = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  // Calculate axis ticks
  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const value = xMin + (xRange * i) / 4;
    const x = scaleX(value);
    return { value, x: isNaN(x) || !isFinite(x) ? 0 : x };
  });

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = yMin + (yRange * i) / 4;
    const y = scaleY(value);
    return { value, y: isNaN(y) || !isFinite(y) ? 0 : y };
  });

  return (
    <div>
      {/* Title */}
      {title && (
        <div className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">
          {title}
        </div>
      )}

      {/* Chart SVG */}
      <svg width={width} height={height} className="overflow-visible">
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <line
              key={`y-grid-${i}`}
              x1={0}
              y1={tick.y}
              x2={chartWidth}
              y2={tick.y}
              stroke="rgb(241, 245, 249)"
              strokeWidth="1"
            />
          ))}

          {xTicks.map((tick, i) => (
            <line
              key={`x-grid-${i}`}
              x1={tick.x}
              y1={0}
              x2={tick.x}
              y2={chartHeight}
              stroke="rgb(241, 245, 249)"
              strokeWidth="1"
            />
          ))}

          {/* Axes */}
          <line
            x1={0}
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="rgb(45, 55, 72)"
            strokeWidth="2"
          />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={chartHeight}
            stroke="rgb(45, 55, 72)"
            strokeWidth="2"
          />

          {/* X-axis ticks and labels */}
          {xTicks.map((tick, i) => (
            <g key={`x-tick-${i}`}>
              <line
                x1={tick.x}
                y1={chartHeight}
                x2={tick.x}
                y2={chartHeight + 6}
                stroke="rgb(45, 55, 72)"
                strokeWidth="2"
              />
              <text
                x={tick.x}
                y={chartHeight + 20}
                textAnchor="middle"
                fontSize="10px"
                fill="rgb(101, 109, 118)"
              >
                {formatNumber(tick.value)}
              </text>
            </g>
          ))}

          {/* Y-axis ticks and labels */}
          {yTicks.map((tick, i) => (
            <g key={`y-tick-${i}`}>
              <line
                x1={-6}
                y1={tick.y}
                x2={0}
                y2={tick.y}
                stroke="rgb(45, 55, 72)"
                strokeWidth="2"
              />
              <text
                x={-10}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="10px"
                fill="rgb(101, 109, 118)"
              >
                {formatNumber(tick.value)}
              </text>
            </g>
          ))}

          {/* Data points */}
          {data.map((point, i) => {
            const cx = scaleX(point.x || 0);
            const cy = scaleY(point.y || 0);
            const radius = point.size || 6;
            const color = point.color || "rgb(59, 130, 246)";

            // Skip if coordinates are invalid
            if (isNaN(cx) || isNaN(cy) || !isFinite(cx) || !isFinite(cy))
              return null;

            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={color}
                  opacity={0.7}
                  stroke={color}
                  strokeWidth="2"
                  className="cursor-pointer"
                />
                <title>{`${point.label}: (${formatNumber(point.x || 0)}, ${formatNumber(point.y || 0)})`}</title>
              </g>
            );
          })}

          {/* Axis labels */}
          <text
            x={chartWidth / 2}
            y={chartHeight + 45}
            textAnchor="middle"
            fontSize="11px"
            fontWeight="600"
            fill="rgb(26, 26, 26)"
          >
            {xLabel}
          </text>

          <text
            x={-chartHeight / 2}
            y={-45}
            textAnchor="middle"
            fontSize="11px"
            fontWeight="600"
            fill="rgb(26, 26, 26)"
            transform={`rotate(-90, ${-chartHeight / 2}, -45)`}
          >
            {yLabel}
          </text>
        </g>
      </svg>
    </div>
  );
}
