// src/features/reports/components/ReportSectionCard.tsx

import { CheckCircle } from "lucide-react";
import type { ReportSection } from "../../../types/reports.types";
import { CommissionAgingChart, ClientTierChart } from "./charts";
import { getAgingChartData, getTierChartData } from "../utils";

interface ReportSectionCardProps {
  section: ReportSection;
  onAgingBucketClick?: (bucket: string) => void;
  onClientTierClick?: (tier: string) => void;
}

/**
 * Renders a single report section with metrics, charts, tables, and insights.
 */
export function ReportSectionCard({
  section,
  onAgingBucketClick,
  onClientTierClick,
}: ReportSectionCardProps) {
  return (
    <div className="px-3 py-2 md:py-3 border-b border-v2-ring last:border-b-0">
      <h2 className="text-sm font-bold text-v2-ink mb-1.5">{section.title}</h2>

      {section.description && (
        <p className="text-xs text-v2-ink-muted mb-2">{section.description}</p>
      )}

      {/* Section Metrics Table */}
      {section.metrics && section.metrics.length > 0 && (
        <SectionMetricsTable metrics={section.metrics} />
      )}

      {/* Section Chart Placeholder */}
      {section.chartData && <SectionChartPlaceholder section={section} />}

      {/* Section Table with Optional Chart */}
      {section.tableData && (
        <SectionTableWithChart
          section={section}
          onAgingBucketClick={onAgingBucketClick}
          onClientTierClick={onClientTierClick}
        />
      )}

      {/* Section Insights */}
      {section.insights && section.insights.length > 0 && (
        <SectionInsights insights={section.insights} />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface MetricItem {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  change?: number;
}

function SectionMetricsTable({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div className="mb-3">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-v2-ring/60">
          {metrics.map((metric, idx) => (
            <tr key={idx} className="group hover:bg-v2-canvas">
              <td className="py-1 pr-2 text-v2-ink-muted font-medium w-1/3">
                {metric.label}
              </td>
              <td className="py-1 text-v2-ink font-bold text-sm">
                <div className="flex items-baseline gap-1">
                  <span>{metric.value}</span>
                  {metric.trend && (
                    <span
                      className={`text-xs font-medium ${
                        metric.trend === "up"
                          ? "text-success"
                          : metric.trend === "down"
                            ? "text-destructive"
                            : "text-v2-ink-muted"
                      }`}
                    >
                      {metric.trend === "up"
                        ? "↑"
                        : metric.trend === "down"
                          ? "↓"
                          : "→"}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-1 text-right text-xs text-v2-ink-muted">
                {metric.change !== undefined && (
                  <span>
                    {metric.change > 0 ? "+" : ""}
                    {metric.change}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionChartPlaceholder({ section }: { section: ReportSection }) {
  if (!section.chartData) return null;

  return (
    <div className="mb-3 space-y-1">
      <h4 className="text-xs font-semibold text-v2-ink">Performance Trends</h4>
      <div className="p-2 bg-v2-canvas rounded border border-v2-ring">
        <div className="h-40 flex items-center justify-center text-v2-ink-muted text-xs">
          Chart data available ({section.chartData.datasets.length} datasets)
        </div>
      </div>
    </div>
  );
}

interface SectionTableWithChartProps {
  section: ReportSection;
  onAgingBucketClick?: (bucket: string) => void;
  onClientTierClick?: (tier: string) => void;
}

function SectionTableWithChart({
  section,
  onAgingBucketClick,
  onClientTierClick,
}: SectionTableWithChartProps) {
  if (!section.tableData) return null;

  return (
    <div className="mb-3 space-y-2">
      {/* Render chart for specific sections */}
      {section.id === "commission-aging" && onAgingBucketClick && (
        <div className="mb-2">
          <CommissionAgingChart
            data={getAgingChartData(section)}
            height={160}
            onBarClick={onAgingBucketClick}
          />
        </div>
      )}
      {section.id === "client-tiers" && onClientTierClick && (
        <div className="mb-2">
          <ClientTierChart
            data={getTierChartData(section)}
            height={140}
            onSliceClick={onClientTierClick}
          />
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-v2-canvas border-b border-v2-ring">
            <tr>
              {section.tableData.headers.map((header, headerIdx) => (
                <th
                  key={headerIdx}
                  className="px-2 py-1.5 text-left font-semibold text-v2-ink-muted text-[10px]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-v2-ring/60">
            {section.tableData.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-v2-canvas">
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-2 py-1.5 text-xs text-v2-ink-muted"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface InsightItem {
  id?: string;
  title: string;
  description: string;
  recommendedActions?: string[];
}

function SectionInsights({ insights }: { insights: InsightItem[] }) {
  return (
    <div className="mt-3 space-y-2">
      <h4 className="text-xs font-semibold text-v2-ink">Key Findings</h4>
      {insights.map((insight, idx) => (
        <div
          key={insight.id || idx}
          className="flex items-start gap-2 p-2 bg-info/10 rounded-sm border-l-2 border-l-blue-500"
        >
          <CheckCircle className="w-3 h-3 text-info flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium text-v2-ink mb-0.5">
              {insight.title}
            </p>
            <p className="text-xs text-v2-ink-muted leading-relaxed">
              {insight.description}
            </p>
            {insight.recommendedActions &&
              insight.recommendedActions.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {insight.recommendedActions.map((action, actionIdx) => (
                    <li key={actionIdx} className="text-xs text-v2-ink">
                      → {action}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}
