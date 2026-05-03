// src/features/reports/components/charts/ScatterCorrelationChart.tsx

import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { formatCurrency } from "../../../../lib/format";

export interface ScatterCorrelationChartData {
  name: string;
  x: number;
  y: number;
  z?: number; // Optional size dimension
}

export interface ScatterCorrelationChartProps {
  data: ScatterCorrelationChartData[];
  xAxisLabel: string;
  yAxisLabel: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  xFormat?: "currency" | "number" | "percent";
  yFormat?: "currency" | "number" | "percent";
  color?: string;
  showTrendLine?: boolean;
}

/**
 * ScatterCorrelationChart - Scatter plot for analyzing relationships between metrics
 *
 * @example
 * <ScatterCorrelationChart
 *   data={[
 *     { name: 'Client A', x: 50000, y: 5000, z: 10 },
 *     { name: 'Client B', x: 75000, y: 8000, z: 15 },
 *   ]}
 *   xAxisLabel="Annual Premium"
 *   yAxisLabel="Commission Earned"
 *   xFormat="currency"
 *   yFormat="currency"
 *   showTrendLine
 * />
 */
export function ScatterCorrelationChart({
  data,
  xAxisLabel,
  yAxisLabel,
  height = 300,
  showGrid = true,
  showLegend = false,
  xFormat = "number",
  yFormat = "number",
  color = "#3b82f6",
  showTrendLine = false,
}: ScatterCorrelationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/10"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  const formatValue = (
    value: number,
    format?: "currency" | "number" | "percent",
  ) => {
    if (typeof value !== "number") return value;

    switch (format) {
      case "currency":
        return formatCurrency(value);
      case "percent":
        return `${value.toFixed(1)}%`;
      case "number":
      default:
        return value.toLocaleString();
    }
  };

  // Calculate trend line using simple linear regression
  const calculateTrendLine = () => {
    if (!showTrendLine || data.length < 2) return null;

    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const xMin = Math.min(...data.map((d) => d.x));
    const xMax = Math.max(...data.map((d) => d.x));

    return [
      { x: xMin, y: slope * xMin + intercept, name: "Trend" },
      { x: xMax, y: slope * xMax + intercept, name: "Trend" },
    ];
  };

  const trendLineData = calculateTrendLine();

  // Calculate correlation coefficient (R²)
  const calculateCorrelation = () => {
    if (data.length < 2) return null;

    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);
    const sumY2 = data.reduce((sum, d) => sum + d.y * d.y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );

    if (denominator === 0) return null;

    const r = numerator / denominator;
    return r * r; // R²
  };

  const rSquared = calculateCorrelation();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chart data type
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        <p className="text-xs font-semibold text-foreground mb-2">
          {data.name}
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>
            {xAxisLabel}:{" "}
            <span className="font-medium text-foreground">
              {formatValue(data.x, xFormat)}
            </span>
          </div>
          <div>
            {yAxisLabel}:{" "}
            <span className="font-medium text-foreground">
              {formatValue(data.y, yFormat)}
            </span>
          </div>
          {data.z && (
            <div>
              Size:{" "}
              <span className="font-medium text-foreground">{data.z}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
          )}
          <XAxis
            type="number"
            dataKey="x"
            name={xAxisLabel}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            stroke="hsl(var(--border))"
            tickFormatter={(value) => formatValue(value, xFormat)}
            label={{
              value: xAxisLabel,
              position: "insideBottom",
              offset: -5,
              style: { fontSize: 12 },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yAxisLabel}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            stroke="hsl(var(--border))"
            tickFormatter={(value) => formatValue(value, yFormat)}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12 },
            }}
          />
          <ZAxis type="number" dataKey="z" range={[50, 400]} />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ strokeDasharray: "3 3" }}
          />
          {showLegend && (
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
          )}

          {/* Trend line */}
          {trendLineData && (
            <Scatter
              name="Trend Line"
              data={trendLineData}
              fill={color}
              line={{ stroke: color, strokeWidth: 2, strokeDasharray: "5 5" }}
              shape={<></>}
            />
          )}

          {/* Data points */}
          <Scatter
            name={`${xAxisLabel} vs ${yAxisLabel}`}
            data={data}
            fill={color}
            fillOpacity={0.6}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* R² indicator */}
      {rSquared !== null && showTrendLine && (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          Correlation (R²):{" "}
          <span className="font-medium text-foreground">
            {rSquared.toFixed(3)}
          </span>
          {rSquared > 0.7 && (
            <span className="ml-2 text-success">Strong correlation</span>
          )}
          {rSquared >= 0.4 && rSquared <= 0.7 && (
            <span className="ml-2 text-warning">Moderate correlation</span>
          )}
          {rSquared < 0.4 && (
            <span className="ml-2 text-destructive">Weak correlation</span>
          )}
        </div>
      )}
    </div>
  );
}
