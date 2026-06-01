import React from "react";
import { T } from "./tokens";

export interface EmptyStateProps {
  /** Lucide icon element (rendered dimmed inside a dashed ring). */
  icon?: React.ReactNode;
  /** Short title, e.g. "No carrier data yet". */
  title: string;
  /** One line of guidance, e.g. "Carrier mix appears once policies are written.". */
  hint?: string;
  /** Vertical padding in px (tune to fill an equal-height row). */
  pad?: number;
  style?: React.CSSProperties;
}

/**
 * Intentional empty state — a dashed ring around a dimmed icon, a title, and
 * one line of guidance. Used instead of flat-zero charts/counters (which read
 * as broken) for panels with no data yet.
 */
export function EmptyState({
  icon,
  title,
  hint,
  pad = 28,
  style,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
        padding: `${pad}px 16px`,
        ...style,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: `1.5px dashed ${T.line2}`,
          display: "grid",
          placeItems: "center",
          color: T.mut2,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          font: `700 14px ${T.data}`,
          color: T.mut,
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            font: `500 12.5px ${T.data}`,
            color: T.mut2,
            maxWidth: 280,
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
