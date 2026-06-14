import React from "react";
import { T } from "./tokens";

// Four corner rivets — ported from TheBoard.jsx `Rivets`.
export function Rivets() {
  const positions: Array<[string?, string?, string?, string?]> = [
    ["9px", "9px"],
    ["9px", undefined, "9px"],
    [undefined, "9px", undefined, "9px"],
    [undefined, undefined, "9px", "9px"],
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
        borderRadius: 14,
        padding: pad,
        boxShadow: T.panelShadow,
        // Allow the card to shrink within a grid/flex track and never spill
        // past its column on narrow screens.
        minWidth: 0,
        maxWidth: "100%",
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
