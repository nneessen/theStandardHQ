import { Package } from "lucide-react";
import { Board, Cap, Num, Bar, EmptyState, T } from "@/components/board";
import type { BarTone } from "@/components/board";
import { useAnalyticsData } from "@/hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { formatCurrency } from "@/lib/format";

function formatProductName(product: string): string {
  return product
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Cycle: blue → green → amber → red (cyan omitted — Jarvis-only per design system)
const ROW_TONES: BarTone[] = ["blue", "green", "amber", "red", "blue", "green"];

export function ProductMixPanel() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div style={{ font: `500 13px ${T.data}`, color: T.mut2 }}>
          Loading...
        </div>
      </Board>
    );
  }

  // Aggregate product data
  const productMap = new Map<string, { count: number; revenue: number }>();
  let totalRevenue = 0;

  raw.policies.forEach((policy) => {
    const product = policy.product || "Unknown";
    const revenue = policy.annualPremium ?? 0;
    const existing = productMap.get(product) ?? { count: 0, revenue: 0 };
    productMap.set(product, {
      count: existing.count + 1,
      revenue: existing.revenue + revenue,
    });
    totalRevenue += revenue;
  });

  const productData = Array.from(productMap.entries())
    .map(([product, data]) => ({
      label: formatProductName(product),
      count: data.count,
      revenue: data.revenue,
      pct: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const isEmpty = productData.length === 0;

  return (
    <Board
      pad={26}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div>
          <Cap>Product Mix</Cap>
          <div
            style={{ font: `600 18px ${T.data}`, color: T.ink, marginTop: 4 }}
          >
            {isEmpty
              ? "0 products in book"
              : `${productData.length} product${productData.length !== 1 ? "s" : ""} in book`}
          </div>
        </div>
        {!isEmpty && productData[0] && (
          <div style={{ textAlign: "right" }}>
            <Num
              text={`${(productData[0].pct * 100).toFixed(0)}%`}
              size="lg"
              color={T.blue}
            />
            <div
              style={{ font: `500 11px ${T.data}`, color: T.mut, marginTop: 2 }}
            >
              {productData[0].label} leads
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Package size={22} />}
          title="No product data yet"
          hint="Product mix appears once policies are written."
          pad={40}
        />
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}
        >
          {productData.map((row, idx) => {
            const tone = ROW_TONES[idx % ROW_TONES.length];
            const accentMap: Record<BarTone, string> = {
              blue: T.blue,
              green: T.green,
              amber: T.amber,
              red: T.red,
            };
            const accentColor = accentMap[tone];
            return (
              <div key={row.label}>
                {/* Row: label + pct */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      font: `600 12px ${T.data}`,
                      color: T.ink,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {row.label}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        font: `700 11px ${T.mono}`,
                        color: accentColor,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {(row.pct * 100).toFixed(1)}%
                    </span>
                    <span
                      style={{
                        font: `500 11px ${T.data}`,
                        color: T.mut,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCurrency(row.revenue)}
                    </span>
                  </div>
                </div>
                <Bar pct={row.pct} tone={tone} height={6} />
              </div>
            );
          })}
        </div>
      )}
    </Board>
  );
}
