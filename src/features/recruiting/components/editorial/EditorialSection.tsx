import React from "react";
import { cn } from "@/lib/utils";

interface EditorialSectionProps {
  eyebrow: string;
  title?: React.ReactNode;
  caption?: React.ReactNode;
  rightSlot?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconTone?: "stone" | "brand" | "success" | "progress" | "error";
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const ICON_TONE: Record<
  NonNullable<EditorialSectionProps["iconTone"]>,
  string
> = {
  stone:
    "bg-v2-ring dark:bg-v2-ring ring-v2-ring  text-v2-ink dark:text-v2-ink-subtle",
  brand:
    "bg-warning/10 dark:bg-warning/20 ring-warning/30 dark:ring-warning text-warning",
  success:
    "bg-success/10 dark:bg-success/20 ring-success/30 dark:ring-success text-success",
  progress:
    "bg-info/10 dark:bg-info/40 ring-info dark:ring-info text-info dark:text-info",
  error:
    "bg-destructive/10 dark:bg-destructive/20 ring-destructive/30 dark:ring-destructive text-destructive",
};

export const EditorialSection: React.FC<EditorialSectionProps> = ({
  eyebrow,
  title,
  caption,
  rightSlot,
  icon: Icon,
  iconTone = "stone",
  children,
  className,
  compact = false,
}) => {
  return (
    <section
      className={cn(
        "rounded-2xl bg-white dark:bg-v2-card ring-1 ring-v2-ring  shadow-sm dark:shadow-none",
        compact ? "p-5 md:p-6" : "p-6 md:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          {Icon && (
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 flex-shrink-0",
                ICON_TONE[iconTone],
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
              {eyebrow}
            </div>
            {title && (
              <h2
                className="mt-1 text-xl font-bold tracking-tight text-v2-ink "
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {title}
              </h2>
            )}
            {caption && (
              <p className="mt-1.5 text-[13px] text-v2-ink-muted dark:text-v2-ink-subtle max-w-2xl leading-relaxed">
                {caption}
              </p>
            )}
          </div>
        </div>
        {rightSlot && (
          <div className="flex-shrink-0 flex items-center">{rightSlot}</div>
        )}
      </div>
      {children}
    </section>
  );
};
