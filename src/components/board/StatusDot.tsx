import React from "react";

export interface StatusDotProps {
  color: string;
  size?: number;
  /** Soft glow halo around the dot (the lit departure-status look). */
  glow?: boolean;
  style?: React.CSSProperties;
}

/** A glowing status dot — flight-board indicator. */
export function StatusDot({
  color,
  size = 8,
  glow = true,
  style,
}: StatusDotProps) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: color,
        boxShadow: glow ? `0 0 ${size - 1}px ${color}` : "none",
        flexShrink: 0,
        display: "inline-block",
        ...style,
      }}
    />
  );
}
