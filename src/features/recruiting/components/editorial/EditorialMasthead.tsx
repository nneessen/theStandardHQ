import React from "react";
import { cn } from "@/lib/utils";

interface EditorialMastheadProps {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightSlot?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export const EditorialMasthead: React.FC<EditorialMastheadProps> = ({
  eyebrow,
  title,
  subtitle,
  rightSlot,
  icon: Icon,
  className,
}) => {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white dark:bg-v2-card shadow-md dark:shadow-none ring-1 ring-v2-ring ",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-1 bg-amber-500"
      />
      <div className="px-6 md:px-8 pt-7 pb-7 md:pt-8 md:pb-8">
        <div className="flex items-center gap-3 mb-3">
          {Icon && (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900">
              <Icon className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </span>
          )}
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-700 dark:text-amber-400">
            {eyebrow}
          </span>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight text-v2-ink  leading-[1.05]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-[14px] text-v2-ink dark:text-v2-ink-subtle max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {rightSlot && (
            <div className="flex-shrink-0 flex items-end">{rightSlot}</div>
          )}
        </div>
      </div>
    </header>
  );
};
