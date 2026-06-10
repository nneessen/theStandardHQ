// src/features/analytics/board/inbound/shared.tsx
// Shared scaffolding for the always-visible "Inbound Calls" analytics section.
// Every panel reads the same period the rest of /analytics uses, fetches via the
// (cached, value-keyed) call-analytics query, and renders with Board primitives.
import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { Board, Bar, Cap, EmptyState, T } from "@/components/board";
import type { BarTone } from "@/components/board";

/**
 * Board shell with a Cap eyebrow + title and uniform loading / empty handling
 * so all inbound-call panels look and degrade identically.
 */
export function CallBoard({
  eyebrow = "Inbound Calls",
  title,
  subtitle,
  isLoading,
  isEmpty,
  emptyTitle = "No inbound calls yet",
  emptyHint = "Metrics appear once calls are recorded and analyzed.",
  minHeight,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  isLoading: boolean;
  isEmpty: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  minHeight?: number;
  children: ReactNode;
}) {
  return (
    <Board
      pad={26}
      style={{
        height: "100%",
        minHeight,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 16, minWidth: 0 }}>
        <Cap>{eyebrow}</Cap>
        <div style={{ font: `600 18px ${T.data}`, color: T.ink, marginTop: 4 }}>
          {title}
        </div>
        {subtitle && (
          <div
            style={{ font: `500 12px ${T.data}`, color: T.mut, marginTop: 2 }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {isLoading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `500 13px ${T.data}`,
            color: T.mut2,
            minHeight: 80,
          }}
        >
          Loading…
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={<Phone size={22} />}
          title={emptyTitle}
          hint={emptyHint}
          pad={32}
          style={{ flex: 1 }}
        />
      ) : (
        children
      )}
    </Board>
  );
}

/** Label-left / value-right row with an inset Bar beneath. */
export function BarRow({
  label,
  valueText,
  pct,
  tone = "green",
}: {
  label: ReactNode;
  valueText: ReactNode;
  pct: number;
  tone?: BarTone;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            font: `600 12px ${T.data}`,
            color: T.ink,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <span
          style={{
            font: `700 12px ${T.mono}`,
            color: T.cream,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {valueText}
        </span>
      </div>
      <Bar pct={pct} tone={tone} height={6} />
    </div>
  );
}

/** Vertical stack with consistent gap for BarRow lists. */
export function BarStack({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}
