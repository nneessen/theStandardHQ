import { Package } from "lucide-react";
import { Board, Cap, Bar, EmptyState, T } from "@/components/board";
import type { BarTone } from "@/components/board";
import { useAnalyticsData } from "@/hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";

function formatProductName(product: string): string {
  return product
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Fixed color mapping by product type per §5.8 handoff
function getProductTone(label: string): BarTone {
  const normalized = label.toLowerCase();
  if (normalized.includes("term life")) return "blue";
  if (normalized.includes("whole life")) return "cyan";
  // DB enum is `indexed_universal_life` → "Indexed Universal Life"; match both
  // that and a bare "IUL" so the real product name maps to green (not fallback).
  if (normalized.includes("iul") || normalized.includes("indexed universal"))
    return "green";
  if (normalized.includes("final expense")) return "amber";
  if (normalized.includes("annuity")) return "red";
  return "blue";
}

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
      pct: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  const isEmpty = productData.length === 0;

  return (
    <Board
      pad={26}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header — eyebrow + subtitle only, no leading-product callout */}
      <div style={{ marginBottom: 18 }}>
        <Cap>Product Mix</Cap>
        <div style={{ font: `600 18px ${T.data}`, color: T.mut, marginTop: 4 }}>
          {isEmpty
            ? "0 products in book"
            : `${productData.length} product${productData.length !== 1 ? "s" : ""} in book`}
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Package size={22} />}
          title="No product data yet"
          hint="Product mix appears once policies are written."
          pad={40}
        />
      ) : (
        <div style={{ flex: 1 }}>
          {productData.map((row) => {
            const tone = getProductTone(row.label);
            return (
              <div key={row.label} style={{ marginBottom: 18 }}>
                {/* Row: label + pct */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      font: `600 15px ${T.data}`,
                      color: T.ink,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      font: `700 15px ${T.mono}`,
                      color: T.cream,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {(row.pct * 100).toFixed(1)}%
                  </span>
                </div>
                <Bar pct={row.pct} tone={tone} />
              </div>
            );
          })}
        </div>
      )}
    </Board>
  );
}
