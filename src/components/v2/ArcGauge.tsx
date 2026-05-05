import React from "react";
import { cn } from "@/lib/utils";

interface ArcGaugeProps {
  value: number;
  size?: number;
  thickness?: number;
  trackColor?: string;
  fillColor?: string;
  centerLabel?: React.ReactNode;
  showTicks?: boolean;
  className?: string;
}

export const ArcGauge: React.FC<ArcGaugeProps> = ({
  value,
  size = 180,
  thickness = 12,
  trackColor = "var(--v2-ring)",
  fillColor = "var(--v2-accent-strong)",
  centerLabel,
  showTicks = true,
  className,
}) => {
  const pct = Math.max(0, Math.min(1, value));
  const cx = 100;
  const cy = 100;
  const r = 88;
  const arcLength = Math.PI * r;
  const dashOffset = arcLength * (1 - pct);
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const ticks = showTicks
    ? Array.from({ length: 21 }, (_, i) => {
        const angle = Math.PI * (1 - i / 20);
        const inner = r - 5;
        const outer = r + 5;
        const x1 = cx + inner * Math.cos(angle);
        const y1 = cy - inner * Math.sin(angle);
        const x2 = cx + outer * Math.cos(angle);
        const y2 = cy - outer * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={0.7}
            opacity={0.35}
            className="text-v2-ink-subtle"
          />
        );
      })
    : null;

  return (
    <div
      className={cn("relative inline-block", className)}
      style={{ width: size }}
    >
      <svg
        viewBox="0 0 200 110"
        width={size}
        height={size * 0.55}
        style={{ display: "block" }}
      >
        {ticks}
        <path
          d={arcPath}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={arcPath}
          stroke={fillColor}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      {centerLabel && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center pb-1 pointer-events-none">
          {centerLabel}
        </div>
      )}
    </div>
  );
};
