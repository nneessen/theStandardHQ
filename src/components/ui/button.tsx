import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none transition-colors duration-150",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95",

        primary:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95",

        secondary:
          "bg-secondary text-secondary-foreground border border-border/60 hover:bg-secondary/80 hover:border-foreground/25 active:bg-secondary/90 shadow-sm",

        success:
          "bg-success text-success-foreground hover:bg-success/90 active:bg-success/95",

        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 active:bg-warning/95",

        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95",

        outline:
          "border border-foreground/25 bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-foreground/40 active:bg-accent/80 shadow-sm dark:border-foreground/15 dark:hover:border-foreground/30",

        ghost:
          "bg-muted/50 text-foreground border border-transparent hover:bg-accent hover:text-accent-foreground hover:border-foreground/20 active:bg-accent/80 dark:bg-muted/40",

        muted:
          "bg-muted text-foreground border border-border/60 hover:bg-muted/80 active:bg-muted/90",

        link: "text-foreground underline-offset-4 hover:underline hover:text-foreground/80",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        xs: "h-6 rounded-sm px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
