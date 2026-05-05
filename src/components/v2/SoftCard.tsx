import React from "react";
import { cn } from "@/lib/utils";

type SoftCardVariant =
  | "default"
  | "tinted"
  | "dark"
  | "accent"
  | "ghost"
  | "glass";
type SoftCardRadius = "md" | "lg";
type SoftCardPadding = "none" | "sm" | "md" | "lg";

interface SoftCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SoftCardVariant;
  radius?: SoftCardRadius;
  padding?: SoftCardPadding;
  lift?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}

const variantStyles: Record<SoftCardVariant, string> = {
  default: "bg-v2-card text-v2-ink border border-v2-ring",
  tinted: "bg-v2-card-tinted text-v2-ink border border-v2-ring",
  dark: "bg-v2-card-dark text-white border border-white/5",
  accent: "bg-v2-accent text-v2-ink border border-v2-accent-strong",
  ghost: "bg-transparent text-v2-ink border border-v2-ring",
  glass: "v2-glass-card text-v2-ink",
};

const radiusStyles: Record<SoftCardRadius, string> = {
  md: "rounded-v2-md",
  lg: "rounded-v2-lg",
};

const paddingStyles: Record<SoftCardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

/**
 * Large soft-rounded card — the workhorse surface for v2 layouts.
 * Use on dashboards, settings pages, anywhere a "block of content" needs
 * a clear container with the new aesthetic.
 */
export const SoftCard = React.forwardRef<HTMLDivElement, SoftCardProps>(
  (
    {
      variant = "default",
      radius = "lg",
      padding = "md",
      lift = false,
      as: Component = "div",
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const Tag = Component as React.ElementType;
    const isGlass = variant === "glass";
    return (
      <Tag
        ref={ref}
        className={cn(
          variantStyles[variant],
          radiusStyles[radius],
          paddingStyles[padding],
          isGlass ? "" : lift ? "shadow-v2-lift" : "shadow-v2-soft",
          "transition-shadow duration-200",
          className,
        )}
        {...rest}
      >
        {children}
      </Tag>
    );
  },
);
SoftCard.displayName = "SoftCard";
