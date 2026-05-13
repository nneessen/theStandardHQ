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

// Themed for `.theme-landing` — restrained editorial header. Section-eyebrow
// row (number/line/label style) at top, display headline below.
// NOTE: no big accent stripe, no boxed icon — matches the public landing
// page's minimal masthead aesthetic.
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
        "relative overflow-hidden rounded-[2px] surface-paper border border-[var(--landing-border)]",
        "shadow-[0_1px_0_rgba(22,27,19,0.04),0_4px_16px_-2px_rgba(22,27,19,0.06)]",
        "px-6 md:px-8 py-6 md:py-7",
        className,
      )}
    >
      <div
        className="section-eyebrow-row mb-3"
        style={{ marginBottom: "1rem" }}
      >
        {Icon && (
          <span
            className="inline-flex items-center"
            style={{ color: "var(--landing-deep-green)" }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <span className="section-eyebrow-num">01</span>
        <span className="section-eyebrow-line" />
        <span className="section-eyebrow-label">{eyebrow}</span>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1
            className="text-display-xl"
            style={{
              color: "var(--landing-deep-green)",
              textTransform: "none",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-fluid-base text-muted max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        {rightSlot && (
          <div className="flex-shrink-0 flex items-end">{rightSlot}</div>
        )}
      </div>
    </header>
  );
};
