// src/features/analytics/board/ClientSegmentsPanel.tsx
import { Users } from "lucide-react";
import { useAnalyticsData } from "@/hooks";
import { formatCurrency } from "@/lib/format";
import { Board, Cap, AnimatedNumber, EmptyState, T } from "@/components/board";

/** Format a dollar amount as "$NNN.NK" with exactly 1 decimal place. */
function formatOneDecimalK(value: number): string {
  if (value === 0) return "$0";
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(value);
}

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
            color: T.mut,
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
          Value tiers &amp; mix
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
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Cap>Client Segments</Cap>
          <div
            style={{
              font: `600 18px ${T.data}`,
              color: T.ink,
              marginTop: 4,
            }}
          >
            Value tiers &amp; mix
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <AnimatedNumber
            value={totalAP}
            prefix="$"
            size="lg"
            style={{ fontSize: 30 }}
          />
          <div
            style={{
              font: `500 11px ${T.mono}`,
              color: T.mut,
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <table
          style={{
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "27%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "17%" }} />
          </colgroup>
          <thead>
            <tr>
              {(
                ["Tier", "Clients", "Total AP", "Avg AP", "Mix %"] as const
              ).map((col) => (
                <th
                  key={col}
                  style={{
                    font: `700 12.5px ${T.mono}`,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: T.mut,
                    textAlign: col === "Tier" ? "left" : "right",
                    paddingBottom: 10,
                    paddingLeft: col !== "Tier" ? 8 : 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.tier}
                style={{
                  borderTop: `1px solid ${T.line}`,
                  borderBottom: idx === rows.length - 1 ? "none" : undefined,
                }}
              >
                <td
                  style={{
                    font: `800 15.5px ${T.disp}`,
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
                    paddingLeft: 8,
                    fontVariantNumeric: "tabular-nums",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.clients}
                </td>
                <td
                  style={{
                    font: `600 15.5px ${T.data}`,
                    color: T.cream,
                    textAlign: "right",
                    paddingLeft: 8,
                    fontVariantNumeric: "tabular-nums",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatOneDecimalK(row.totalAP)}
                </td>
                <td
                  style={{
                    font: `600 15.5px ${T.data}`,
                    color: T.mut,
                    textAlign: "right",
                    paddingLeft: 8,
                    fontVariantNumeric: "tabular-nums",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatCurrency(row.avgAP)}
                </td>
                <td
                  style={{
                    font: `700 15.5px ${T.data}`,
                    color: row.color,
                    textAlign: "right",
                    paddingLeft: 8,
                    fontVariantNumeric: "tabular-nums",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
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
