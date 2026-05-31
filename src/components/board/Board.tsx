import React from "react";
import { T } from "./tokens";

// Four corner rivets — ported from TheBoard.jsx `Rivets`.
export function Rivets() {
  const positions: Array<[string?, string?, string?, string?]> = [
    ["8px", "8px"],
    ["8px", undefined, "8px"],
    [undefined, "8px", undefined, "8px"],
    [undefined, undefined, "8px", "8px"],
  ];
  return (
    <>
      {positions.map((p, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            top: p[0],
            right: p[1],
            bottom: p[2],
            left: p[3],
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #4a4031, #110d06)",
            boxShadow: "0 1px 1px rgba(0,0,0,0.6)",
          }}
        />
      ))}
    </>
  );
}

export interface BoardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Inner padding in px (handoff default 20). */
  pad?: number;
  /** Show the four corner rivets. */
  rivets?: boolean;
}

/**
 * The riveted departure-board panel — the workhorse surface for "The Board"
 * aesthetic. Warm panel gradient, line2 border, inset + deep-drop shadow.
 * Ported from TheBoard.jsx `Board`.
 */
export const Board = React.forwardRef<HTMLDivElement, BoardProps>(
  ({ pad = 20, rivets = true, style, children, ...rest }, ref) => (
    <div
      ref={ref}
      style={{
        position: "relative",
        background: T.panelGradient,
        border: `1px solid ${T.line2}`,
        borderRadius: 12,
        padding: pad,
        boxShadow: T.panelShadow,
        ...style,
      }}
      {...rest}
    >
      {rivets && <Rivets />}
      {children}
    </div>
  ),
);
Board.displayName = "Board";
