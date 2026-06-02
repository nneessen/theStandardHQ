// src/features/business-tools/components/SummaryCards.tsx
// Financial totals as a Board FlapTile band.

import { Board, Cap, FlapTile } from "@/components/board";
import type { FlapTileTone } from "@/components/board";
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
  tone: FlapTileTone;
  format: "dollar" | "percent";
}> = [
  {
    key: "income_cents",
    label: "1099 Income",
    tone: "green",
    format: "dollar",
  },
  {
    key: "expense_cents",
    label: "Total Expenses",
    tone: "red",
    format: "dollar",
  },
  {
    key: "business_expense_cents",
    label: "Business Expenses",
    tone: "blue",
    format: "dollar",
  },
  {
    key: "personal_expense_cents",
    label: "Personal Expenses",
    tone: "default",
    format: "dollar",
  },
  {
    key: "net_business_cents",
    label: "Net 1099 Income",
    tone: "green",
    format: "dollar",
  },
  {
    key: "business_use_pct",
    label: "Business Use %",
    tone: "amber",
    format: "percent",
  },
];

interface SummaryCardsProps {
  totals: SummaryTotals;
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  return (
    <Board pad={18}>
      <Cap style={{ marginBottom: 14 }}>Financial Summary</Cap>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
          gap: 10,
        }}
      >
        {CARDS.map((card) => {
          const value = totals[card.key];
          return (
            <FlapTile
              key={card.key}
              label={card.label}
              tone={card.tone}
              value={
                card.format === "percent"
                  ? `${Number(value).toFixed(1)}%`
                  : formatDollars(Number(value))
              }
            />
          );
        })}
      </div>
    </Board>
  );
}
