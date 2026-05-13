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

// Themed for `.theme-landing` — sharp corners, paper surface, mono eyebrows.
const ICON_TONE_STYLES: Record<
  NonNullable<EditorialSectionProps["iconTone"]>,
  { bg: string; color: string; border: string }
> = {
  stone: {
    bg: "var(--landing-icy-blue-light)",
    color: "var(--landing-terrain-grey-dark)",
    border: "var(--landing-border)",
  },
  brand: {
    bg: "var(--landing-adventure-yellow)",
    color: "var(--landing-deep-green)",
    border: "var(--landing-deep-green)",
  },
  success: {
    bg: "var(--landing-adventure-yellow)",
    color: "var(--landing-deep-green)",
    border: "var(--landing-deep-green)",
  },
  progress: {
    bg: "var(--landing-icy-blue)",
    color: "var(--landing-deep-green)",
    border: "var(--landing-deep-green)",
  },
  error: {
    bg: "rgba(220, 38, 38, 0.10)",
    color: "rgb(185, 28, 28)",
    border: "rgba(220, 38, 38, 0.35)",
  },
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
  const tone = ICON_TONE_STYLES[iconTone];
  return (
    <section
      className={cn(
        "rounded-[2px] surface-paper border border-[var(--landing-border)]",
        "shadow-[0_1px_0_rgba(22,27,19,0.04),0_4px_16px_-2px_rgba(22,27,19,0.06)]",
        compact ? "p-5 md:p-6" : "p-6 md:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          {Icon && (
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] border flex-shrink-0"
              style={{
                background: tone.bg,
                borderColor: tone.border,
                color: tone.color,
              }}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-eyebrow">{eyebrow}</div>
            {title && (
              <h2
                className="mt-1 text-display-xl"
                style={{
                  color: "var(--landing-deep-green)",
                  fontWeight: 900,
                }}
              >
                {title}
              </h2>
            )}
            {caption && (
              <p className="mt-2 text-fluid-base text-muted max-w-2xl">
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
