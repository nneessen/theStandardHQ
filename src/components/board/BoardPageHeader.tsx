import React from "react";
import { Num } from "./Num";
import { T } from "./tokens";
import { useIsMobile } from "@/hooks/ui";

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
  const isMobile = useIsMobile();
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
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: isMobile ? 8 : 14,
          minWidth: 0,
        }}
      >
        <div
          style={{
            // The 40px display title can't fit beside its meta on a phone and
            // won't wrap (single word) — shrink it on mobile so the header
            // never forces the page wider than the viewport.
            font: `800 ${isMobile ? 26 : 40}px ${T.disp}`,
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {periods && periods.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 3,
              padding: 4,
              borderRadius: 10,
              // A lifted panel + brighter hairline so the control reads as one
              // distinct widget rather than text floating on the page.
              background: T.panel2,
              border: `1px solid rgba(236,226,205,0.28)`,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {periods.map((p) => {
              const active = p === period;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPeriodChange?.(p)}
                  // Inactive labels use full-opacity cream (was 55% T.mut, which
                  // washed out on the dark panel) and brighten further on hover.
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = T.tile;
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      e.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    padding: "7px 13px",
                    borderRadius: 7,
                    font: `700 12.5px ${T.mono}`,
                    letterSpacing: "0.06em",
                    background: active ? T.blue : "transparent",
                    color: active ? "#08152b" : T.cream,
                    border: "none",
                    cursor: "pointer",
                    transition: "background 120ms ease, color 120ms ease",
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
