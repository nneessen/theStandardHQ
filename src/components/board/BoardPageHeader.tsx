import React from "react";
import { Num } from "./Num";
import { T } from "./tokens";

export interface BoardPageHeaderProps {
  /** Large display title, e.g. "MAY 2026" or "POLICIES". */
  title: React.ReactNode;
  /** Amber sub-value beside the title, e.g. "30/31". */
  meta?: React.ReactNode;
  /** Period segmented control labels, e.g. ["DAY","WK","MTD","MO","YR"]. */
  periods?: string[];
  /** Currently selected period label. */
  period?: string;
  onPeriodChange?: (period: string) => void;
  /** Extra right-aligned controls (buttons, arrows, etc.). */
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * The departure-board topbar — reused across pages. Display title + optional
 * amber meta, with a right-aligned segmented period control and/or actions.
 * Ported from TheBoard.jsx `Topbar`.
 */
export function BoardPageHeader({
  title,
  meta,
  periods,
  period,
  onPeriodChange,
  actions,
  style,
}: BoardPageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        marginBottom: 18,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div
          style={{
            font: `800 40px ${T.disp}`,
            letterSpacing: "0.01em",
            color: T.ink,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {meta != null && <Num text={meta} size="sm" color={T.amber} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {periods && periods.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 3,
              padding: 4,
              borderRadius: 10,
              background: T.panel,
              border: `1px solid ${T.line2}`,
            }}
          >
            {periods.map((p) => {
              const active = p === period;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPeriodChange?.(p)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 7,
                    font: `700 11px ${T.mono}`,
                    letterSpacing: "0.06em",
                    background: active ? T.blue : "transparent",
                    color: active ? "#08152b" : T.mut,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        )}
        {actions}
      </div>
    </div>
  );
}
