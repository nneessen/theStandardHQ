import React from "react";
import { cn } from "@/lib/utils";

interface EditorialStatProps {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "brand" | "success" | "progress" | "warn" | "error";
  className?: string;
}

// Themed for `.theme-landing` — Big Shoulders Display value, JetBrains Mono
// eyebrow/caption.

const VALUE_SIZE: Record<NonNullable<EditorialStatProps["size"]>, string> = {
  sm: "text-2xl",
  md: "text-3xl sm:text-4xl",
  lg: "text-4xl sm:text-5xl",
  xl: "text-5xl sm:text-6xl",
};

const TONE_COLOR: Record<NonNullable<EditorialStatProps["tone"]>, string> = {
  default: "var(--landing-deep-green)",
  brand: "var(--landing-deep-green)",
  success: "var(--landing-deep-green)",
  progress: "var(--landing-deep-green)",
  warn: "var(--landing-terrain-grey-dark)",
  error: "rgb(185, 28, 28)",
};

export const EditorialStat: React.FC<EditorialStatProps> = ({
  label,
  value,
  caption,
  size = "lg",
  tone = "default",
  className,
}) => {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-eyebrow">{label}</span>
      <span
        className={cn(
          "mt-1 uppercase tracking-tight leading-none tabular",
          VALUE_SIZE[size],
        )}
        style={{
          color: TONE_COLOR[tone],
          fontFamily: "var(--landing-font-display)",
          fontWeight: 900,
        }}
      >
        {value}
      </span>
      {caption && (
        <span className="mt-1.5 text-eyebrow normal-case">{caption}</span>
      )}
    </div>
  );
};
