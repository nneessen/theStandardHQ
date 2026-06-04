// src/features/analytics/board/ActionFeedPanel.tsx
import { Zap } from "lucide-react";
import { useAnalyticsData } from "@/hooks";
import { useCalculatedTargets } from "@/hooks/targets";
import { useExpenses } from "../../../hooks/expenses/useExpenses";
import { gamePlanService } from "../../../services/analytics/gamePlanService";
import type {
  SmartMove,
  Scenario,
} from "../../../services/analytics/gamePlanService";
import { formatCurrency } from "@/lib/format";
import { Board, Cap, Pill, StatusDot, EmptyState, T } from "@/components/board";

export function ActionFeedPanel() {
  // Period-independent: calculateGamePlan windows the full book into the
  // current month + YTD internally, so it must receive the whole book.
  const { raw, isLoading: isAnalyticsLoading } = useAnalyticsData();

  const { calculated, isLoading: isTargetsLoading } = useCalculatedTargets();

  const { data: allExpenses, isLoading: isExpensesLoading } = useExpenses();

  const isLoading = isAnalyticsLoading || isTargetsLoading || isExpensesLoading;

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
          Smart Moves · Flags
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

  // calculateGamePlan's 4th arg is CURRENT-MONTH expenses (its `mtdExpenses`
  // param), matching its internal current-month windowing — not the selector.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const mtdExpenses = (allExpenses ?? [])
    .filter((e) => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const gamePlan = gamePlanService.calculateGamePlan(
    raw.policies,
    raw.commissions,
    calculated,
    mtdExpenses,
  );

  const smartMoves: SmartMove[] = gamePlan.smartMoves ?? [];
  const scenarios: Scenario[] = gamePlan.scenarios ?? [];

  const isEmpty = smartMoves.length === 0 && scenarios.length === 0;

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
          <Cap>Smart Moves · Flags</Cap>
          <div
            style={{
              font: `600 18px ${T.data}`,
              color: T.ink,
              marginTop: 4,
            }}
          >
            Action Feed
          </div>
        </div>
        {!isEmpty && (
          <div
            style={{
              font: `800 28px ${T.disp}`,
              color: T.amber,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {String(smartMoves.length).padStart(2, "0")}
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Zap size={22} />}
          title="No moves yet"
          hint="Smart moves appear once you have policy + target data."
          pad={40}
          style={{ flex: 1 }}
        />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Smart Moves list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginBottom: 16,
            }}
          >
            {smartMoves.map((move) => {
              const isHigh = move.urgency === "high";
              const dotColor = isHigh ? T.red : T.amber;
              return (
                <div
                  key={move.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${T.line}`,
                  }}
                >
                  <StatusDot color={dotColor} size={8} glow />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        font: `700 14px ${T.data}`,
                        color: T.ink,
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {move.title}
                    </div>
                    <div
                      style={{
                        font: `500 12px ${T.data}`,
                        color: T.mut,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {move.description}
                    </div>
                  </div>
                  <Pill tone={isHigh ? "red" : "amber"} dot={false}>
                    {isHigh ? "Act Now" : "Monitor"}
                  </Pill>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: T.line2,
              marginBottom: 16,
            }}
          />

          {/* What-If Scenarios */}
          {scenarios.length > 0 && (
            <div>
              <Cap style={{ marginBottom: 10 }}>What-If Scenarios</Cap>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <thead>
                  <tr>
                    {(["Scenario", "Projected", "Goal %"] as const).map(
                      (col) => (
                        <th
                          key={col}
                          style={{
                            font: `700 11px ${T.mono}`,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: T.mut2,
                            textAlign: col === "Scenario" ? "left" : "right",
                            paddingBottom: 8,
                            paddingLeft: col !== "Scenario" ? 18 : 0,
                          }}
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((row) => {
                    const pctColor = row.goalPercent >= 100 ? T.green : T.amber;
                    return (
                      <tr key={row.id}>
                        <td
                          style={{
                            font: `500 13px ${T.data}`,
                            color: T.mut,
                            paddingBottom: 6,
                          }}
                        >
                          {row.condition}
                        </td>
                        <td
                          style={{
                            font: `600 13px ${T.data}`,
                            color: T.cream,
                            textAlign: "right",
                            paddingLeft: 18,
                            paddingBottom: 6,
                          }}
                        >
                          {formatCurrency(row.projectedEarnings)}
                        </td>
                        <td
                          style={{
                            font: `700 13px ${T.data}`,
                            color: pctColor,
                            textAlign: "right",
                            paddingLeft: 18,
                            paddingBottom: 6,
                          }}
                        >
                          {Math.round(row.goalPercent)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Board>
  );
}
