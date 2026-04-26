import React from "react";
import { cn } from "@/lib/utils";

interface RingProgressProps {
  value: number; // 0..1
  size?: number; // px
  thickness?: number; // px
  trackColor?: string;
  fillColor?: string;
  centerLabel?: React.ReactNode;
  className?: string;
}

/**
 * Lightweight SVG ring progress (the "Time tracker 02:35" donut in the
 * Crextio reference). Pure SVG — no recharts dependency — so it stays
 * crisp at any size and can host arbitrary center content.
 */
export const RingProgress: React.FC<RingProgressProps> = ({
  value,
  size = 160,
  thickness = 14,
  trackColor = "var(--v2-ring)",
  fillColor = "var(--v2-accent)",
  centerLabel,
  className,
}) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value));
  const dashOffset = circumference * (1 - pct);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fillColor}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          fill="none"
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          {centerLabel}
        </div>
      )}
    </div>
  );
};
