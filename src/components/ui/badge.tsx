import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",

        secondary: "bg-secondary text-secondary-foreground",

        success: "bg-success text-success-foreground",

        warning: "bg-warning text-warning-foreground",

        destructive: "bg-destructive text-destructive-foreground",

        info: "bg-info text-info-foreground",

        outline: "border border-border bg-background text-foreground",

        ghost: "bg-muted text-muted-foreground",

        accent: "bg-accent text-accent-foreground",

        // Premium retained for backward compat — neutralized to accent.
        premium: "bg-accent text-accent-foreground",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
