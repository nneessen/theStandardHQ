// src/features/analytics/board/ClientSegmentsPanel.tsx
import { Users } from "lucide-react";
import { useAnalyticsData } from "@/hooks";
import { formatCurrency } from "@/lib/format";
import { Board, Cap, AnimatedNumber, EmptyState, T } from "@/components/board";

export function ClientSegmentsPanel() {
  // Period-independent: client value tiers are a whole-book segmentation.
  const { segmentation, isLoading } = useAnalyticsData();

  if (isLoading) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            font: `500 12px ${T.mono}`,
            color: T.mut2,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Client Segments
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `500 13px ${T.data}`,
            color: T.mut2,
          }}
        >
          Loading…
        </div>
      </Board>
    );
  }

  const segData = segmentation?.segments;
  const allTiersEmpty =
    !segData ||
    (segData.highValue.length === 0 &&
      segData.mediumValue.length === 0 &&
      segData.lowValue.length === 0);

  if (allTiersEmpty) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <Cap style={{ marginBottom: 4 }}>Client Segments</Cap>
        <div
          style={{
            font: `600 18px ${T.data}`,
            color: T.ink,
            marginBottom: 12,
          }}
        >
          Value tiers
        </div>
        <EmptyState
          icon={<Users size={22} />}
          title="No clients yet"
          hint="Segments appear once clients have policies."
          pad={40}
          style={{ flex: 1 }}
        />
      </Board>
    );
  }

  const totalAP =
    segData.totalPremiumByTier.high +
    segData.totalPremiumByTier.medium +
    segData.totalPremiumByTier.low;

  const rows = [
    {
      tier: "HIGH",
      clients: segData.highValue.length,
      totalAP: segData.totalPremiumByTier.high,
      avgAP: segData.avgPremiumByTier.high,
      mixPct:
        totalAP > 0 ? (segData.totalPremiumByTier.high / totalAP) * 100 : 0,
      color: T.green,
    },
    {
      tier: "MED",
      clients: segData.mediumValue.length,
      totalAP: segData.totalPremiumByTier.medium,
      avgAP: segData.avgPremiumByTier.medium,
      mixPct:
        totalAP > 0 ? (segData.totalPremiumByTier.medium / totalAP) * 100 : 0,
      color: T.amber,
    },
    {
      tier: "LOW",
      clients: segData.lowValue.length,
      totalAP: segData.totalPremiumByTier.low,
      avgAP: segData.avgPremiumByTier.low,
      mixPct:
        totalAP > 0 ? (segData.totalPremiumByTier.low / totalAP) * 100 : 0,
      color: T.red,
    },
  ];

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
          marginBottom: 20,
        }}
      >
        <div>
          <Cap>Client Segments</Cap>
          <div
            style={{
              font: `600 18px ${T.data}`,
              color: T.ink,
              marginTop: 4,
            }}
          >
            Value tiers
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <AnimatedNumber value={totalAP} prefix="$" size="lg" />
          <div
            style={{
              font: `500 11px ${T.mono}`,
              color: T.mut2,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            total AP
          </div>
        </div>
      </div>

      {/* Segments table */}
      <div style={{ flex: 1 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <thead>
            <tr>
              {(
                ["Tier", "Clients", "Total AP", "Avg AP", "Mix %"] as const
              ).map((col) => (
                <th
                  key={col}
                  style={{
                    font: `700 11px ${T.mono}`,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: T.mut2,
                    textAlign: col === "Tier" ? "left" : "right",
                    paddingBottom: 10,
                    paddingLeft: col !== "Tier" ? 18 : 0,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.tier}
                style={{
                  borderTop: `1px solid ${T.line}`,
                }}
              >
                <td
                  style={{
                    font: `700 15.5px ${T.data}`,
                    color: row.color,
                    paddingTop: 10,
                    paddingBottom: 10,
                  }}
                >
                  {row.tier}
                </td>
                <td
                  style={{
                    font: `600 15.5px ${T.data}`,
                    color: T.ink,
                    textAlign: "right",
                    paddingLeft: 18,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.clients}
                </td>
                <td
                  style={{
                    font: `600 15.5px ${T.data}`,
                    color: T.cream,
                    textAlign: "right",
                    paddingLeft: 18,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCurrency(row.totalAP)}
                </td>
                <td
                  style={{
                    font: `600 15.5px ${T.data}`,
                    color: T.mut,
                    textAlign: "right",
                    paddingLeft: 18,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCurrency(row.avgAP)}
                </td>
                <td
                  style={{
                    font: `700 15.5px ${T.data}`,
                    color: row.color,
                    textAlign: "right",
                    paddingLeft: 18,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.mixPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Board>
  );
}
