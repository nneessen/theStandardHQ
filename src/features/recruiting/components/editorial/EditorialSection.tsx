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
    "bg-amber-50 dark:bg-amber-950/40 ring-amber-200 dark:ring-amber-900 text-amber-700 dark:text-amber-400",
  success:
    "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-200 dark:ring-emerald-900 text-emerald-700 dark:text-emerald-400",
  progress:
    "bg-sky-50 dark:bg-sky-950/40 ring-sky-200 dark:ring-sky-900 text-sky-700 dark:text-sky-400",
  error:
    "bg-red-50 dark:bg-red-950/40 ring-red-200 dark:ring-red-900 text-red-700 dark:text-red-400",
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
