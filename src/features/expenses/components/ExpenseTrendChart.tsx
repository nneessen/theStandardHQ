// src/features/expenses/components/ExpenseTrendChart.tsx
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Empty as EmptyState } from "@/components/ui/empty";
import { formatCurrency } from "@/lib/format";

interface TrendDataPoint {
  month: string;
  amount: number;
}

interface ExpenseTrendChartProps {
  data: TrendDataPoint[];
}

export function ExpenseTrendChart({ data }: ExpenseTrendChartProps) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          6-Month Trend
        </div>
        <CardDescription className="text-xs">
          Monthly spending over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="flex items-end gap-2 h-48">
            {data.map((item, idx) => {
              const height = (item.amount / maxAmount) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-gradient-to-t from-primary to-primary/80 rounded-t"
                    style={{
                      height: `${height}%`,
                      minHeight: item.amount > 0 ? "8px" : "0",
                    }}
                    title={`${item.month}: ${formatCurrency(item.amount)}`}
                  />
                  <div className="text-[11px] text-muted-foreground font-semibold text-center">
                    {item.month}
                  </div>
                  <div className="text-[11px] font-mono font-semibold">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No trend data available" />
        )}
      </CardContent>
    </Card>
  );
}
