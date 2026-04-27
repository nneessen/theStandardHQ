// src/features/business-tools/components/CategoryChart.tsx
// Horizontal stacked bar chart showing top categories by income & expense

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { CategoryBreakdown } from "../types";

function formatDollars(value: number): string {
  return `$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface CategoryChartProps {
  data: CategoryBreakdown[];
}

interface ChartRow {
  name: string;
  expense: number;
  income: number;
  count: number;
}

export function CategoryChart({ data }: CategoryChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-v2-ink-subtle">
        No category data yet
      </div>
    );
  }

  // Sort by largest expense, take top 12 + "Other" bucket
  const sorted = [...data].sort(
    (a, b) => b.biz_expense_cents - a.biz_expense_cents,
  );
  const top = sorted.slice(0, 12);
  const rest = sorted.slice(12);

  const chartData: ChartRow[] = top.map((d) => ({
    name: d.category,
    expense: d.biz_expense_cents / 100,
    income: d.biz_income_cents / 100,
    count: d.count,
  }));

  if (rest.length > 0) {
    chartData.push({
      name: "Other",
      expense: rest.reduce((s, d) => s + d.biz_expense_cents, 0) / 100,
      income: rest.reduce((s, d) => s + d.biz_income_cents, 0) / 100,
      count: rest.reduce((s, d) => s + d.count, 0),
    });
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="#e4e4e7"
        />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatDollars(v)}
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as ChartRow;
            return (
              <div className="bg-v2-card-dark border border-v2-ring rounded-md px-2.5 py-1.5 text-[11px] text-v2-canvas space-y-0.5">
                <p className="font-medium">{label}</p>
                {row.income > 0 && (
                  <p className="text-emerald-400">
                    Income: {formatDollars(row.income)}
                  </p>
                )}
                {row.expense > 0 && (
                  <p className="text-blue-400">
                    Expenses: {formatDollars(row.expense)}
                  </p>
                )}
                <p className="text-v2-ink-subtle">{row.count} transactions</p>
              </div>
            );
          }}
        />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontSize: 10, color: "#a1a1aa" }}
        />
        <Bar
          dataKey="expense"
          name="Business Expenses"
          fill="#3b82f6"
          stackId="cat"
          radius={[0, 0, 0, 0]}
          barSize={16}
        />
        <Bar
          dataKey="income"
          name="Business Income"
          fill="#10b981"
          stackId="cat"
          radius={[0, 3, 3, 0]}
          barSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
