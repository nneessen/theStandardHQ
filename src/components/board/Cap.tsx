import React from "react";
import { T } from "./tokens";

export interface CapProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Space-Mono uppercase eyebrow / caption label. Ported from TheBoard.jsx `Cap`.
 * Defaults to 13px / 0.18em tracking / `mut` color; override via `style`.
 * (Lifted Jun 14 2026 from 12px/`mut2` — eyebrows were too dim/small app-wide.)
 */
export const Cap = React.forwardRef<HTMLDivElement, CapProps>(
  ({ style, children, ...rest }, ref) => (
    <div
      ref={ref}
      style={{
        font: `700 13px ${T.mono}`,
        letterSpacing: "0.18em",
        color: T.mut,
        textTransform: "uppercase",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  ),
);
Cap.displayName = "Cap";
