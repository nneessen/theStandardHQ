import React from "react";
import { cn } from "@/lib/utils";

type PillButtonTone = "black" | "yellow" | "ghost" | "white" | "glass";
type PillButtonSize = "sm" | "md" | "lg";

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: PillButtonTone;
  size?: PillButtonSize;
  fullWidth?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const toneStyles: Record<PillButtonTone, string> = {
  black:
    "bg-v2-ink text-white hover:bg-black border border-v2-ink disabled:opacity-50",
  yellow:
    "bg-v2-accent text-v2-ink hover:bg-v2-accent-strong border border-v2-accent-strong disabled:opacity-50",
  ghost:
    "bg-transparent text-v2-ink hover:bg-v2-accent-soft border border-v2-ring disabled:opacity-50",
  white:
    "bg-v2-card text-v2-ink hover:bg-v2-card-tinted border border-v2-ring disabled:opacity-50",
  glass: "v2-glass-pill text-v2-ink disabled:opacity-50",
};

const sizeStyles: Record<PillButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

/**
 * Pill-shaped button used throughout v2 surfaces. The black tone is the
 * primary call-to-action; yellow is for emphasized actions; ghost is the
 * default secondary; white sits on tinted backgrounds.
 */
export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  (
    {
      tone = "black",
      size = "md",
      fullWidth,
      leadingIcon,
      trailingIcon,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-v2-pill font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-accent focus-visible:ring-offset-2 focus-visible:ring-offset-v2-canvas",
          toneStyles[tone],
          sizeStyles[size],
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {leadingIcon}
        {children}
        {trailingIcon}
      </button>
    );
  },
);
PillButton.displayName = "PillButton";
