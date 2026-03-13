// src/features/business-tools/components/SummaryCards.tsx
// 6 stat cards showing key financial totals

import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  User,
  Calculator,
  Percent,
} from "lucide-react";
import type { SummaryTotals } from "../types";

function formatDollars(cents: number): string {
  const negative = cents < 0;
  const formatted = (Math.abs(cents) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return negative ? `-${formatted}` : formatted;
}

const CARDS: Array<{
  key: keyof SummaryTotals;
  label: string;
  icon: React.ElementType;
  color: string;
  format: "dollar" | "percent";
}> = [
  {
    key: "income_cents",
    label: "1099 Income",
    icon: TrendingUp,
    color: "text-emerald-600 dark:text-emerald-400",
    format: "dollar",
  },
  {
    key: "expense_cents",
    label: "Total Expenses",
    icon: TrendingDown,
    color: "text-red-500 dark:text-red-400",
    format: "dollar",
  },
  {
    key: "business_expense_cents",
    label: "Business Expenses",
    icon: Briefcase,
    color: "text-blue-600 dark:text-blue-400",
    format: "dollar",
  },
  {
    key: "personal_expense_cents",
    label: "Personal Expenses",
    icon: User,
    color: "text-zinc-600 dark:text-zinc-400",
    format: "dollar",
  },
  {
    key: "net_business_cents",
    label: "Net 1099 Income",
    icon: Calculator,
    color: "text-emerald-600 dark:text-emerald-400",
    format: "dollar",
  },
  {
    key: "business_use_pct",
    label: "Business Use %",
    icon: Percent,
    color: "text-amber-600 dark:text-amber-400",
    format: "percent",
  },
];

interface SummaryCardsProps {
  totals: SummaryTotals;
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {CARDS.map((card) => {
        const value = totals[card.key];
        return (
          <div
            key={card.key}
            className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <card.icon className={`h-3 w-3 ${card.color}`} />
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <p className={`text-sm font-semibold tabular-nums ${card.color}`}>
              {card.format === "percent"
                ? `${Number(value).toFixed(1)}%`
                : formatDollars(Number(value))}
            </p>
          </div>
        );
      })}
    </div>
  );
}
