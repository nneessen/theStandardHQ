// src/features/business-tools/components/MonthlyTrendChart.tsx
// ComposedChart: income bars, stacked expense bars (biz+personal), net line

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthlyBreakdown } from "../types";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
};

function formatDollars(value: number): string {
  const negative = value < 0;
  const formatted = `$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
  return negative ? `-${formatted}` : formatted;
}

interface MonthlyTrendChartProps {
  data: MonthlyBreakdown[];
}

interface ChartRow {
  month: string;
  fullMonth: string;
  income: number;
  business: number;
  personal: number;
  net: number;
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-v2-ink-subtle">
        No monthly data yet
      </div>
    );
  }

  const chartData: ChartRow[] = data.map((d) => {
    const monthNum = d.month.slice(5, 7);
    const year = d.month.slice(2, 4);
    const label = MONTH_LABELS[monthNum] || monthNum;
    return {
      month: `${label} '${year}`,
      fullMonth: d.month,
      income: d.income_cents / 100,
      business: d.expense_cents / 100,
      personal: d.personal_cents / 100,
      net: d.net_cents / 100,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#e4e4e7"
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatDollars(v)}
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as ChartRow;
            return (
              <div className="bg-v2-card-dark border border-v2-ring rounded-md px-2.5 py-1.5 text-[11px] text-v2-canvas space-y-0.5">
                <p className="font-medium">{row.month}</p>
                <p className="text-success">
                  Income: {formatDollars(row.income)}
                </p>
                <p className="text-info">
                  Biz Expenses: {formatDollars(row.business)}
                </p>
                <p className="text-v2-ink-subtle">
                  Personal: {formatDollars(row.personal)}
                </p>
                <p className="text-warning">
                  Net 1099: {formatDollars(row.net)}
                </p>
              </div>
            );
          }}
        />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontSize: 10, color: "#a1a1aa" }}
        />
        <Bar dataKey="income" name="Income" fill="#10b981" barSize={24} />
        <Bar
          dataKey="business"
          name="Biz Expenses"
          stackId="exp"
          fill="#3b82f6"
          barSize={24}
        />
        <Bar
          dataKey="personal"
          name="Personal"
          stackId="exp"
          fill="#a1a1aa"
          radius={[3, 3, 0, 0]}
          barSize={24}
        />
        <Line
          dataKey="net"
          name="Net 1099"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3, fill: "#f59e0b" }}
          type="monotone"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
