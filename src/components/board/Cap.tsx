import React from "react";
import { T } from "./tokens";

export interface CapProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Space-Mono uppercase eyebrow / caption label. Ported from TheBoard.jsx `Cap`.
 * Defaults to 12px / 0.18em tracking / mut2 color; override via `style`.
 */
export const Cap = React.forwardRef<HTMLDivElement, CapProps>(
  ({ style, children, ...rest }, ref) => (
    <div
      ref={ref}
      style={{
        font: `700 12px ${T.mono}`,
        letterSpacing: "0.18em",
        color: T.mut2,
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
