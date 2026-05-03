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

const VALUE_SIZE: Record<NonNullable<EditorialStatProps["size"]>, string> = {
  sm: "text-2xl",
  md: "text-3xl sm:text-4xl",
  lg: "text-4xl sm:text-5xl",
  xl: "text-5xl sm:text-6xl",
};

const TONE: Record<NonNullable<EditorialStatProps["tone"]>, string> = {
  default: "text-v2-ink ",
  brand: "text-warning",
  success: "text-success",
  progress: "text-info dark:text-info",
  warn: "text-warning dark:text-warning",
  error: "text-destructive",
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
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
        {label}
      </span>
      <span
        className={cn(
          "mt-1 font-mono tabular-nums font-bold tracking-tight leading-none",
          VALUE_SIZE[size],
          TONE[tone],
        )}
      >
        {value}
      </span>
      {caption && (
        <span className="mt-1.5 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
          {caption}
        </span>
      )}
    </div>
  );
};
