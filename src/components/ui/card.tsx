import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-lg text-card-foreground transition-colors duration-150",
  {
    variants: {
      variant: {
        default:
          "bg-card border border-border shadow-[0_1px_2px_rgba(22,27,19,0.05),0_4px_12px_-2px_rgba(22,27,19,0.08)] dark:shadow-[0_1px_0_rgba(0,0,0,0.4),0_8px_24px_-4px_rgba(0,0,0,0.4)]",

        glass:
          "bg-card/80 backdrop-blur-xl border border-border shadow-[0_1px_2px_rgba(22,27,19,0.05),0_4px_12px_-2px_rgba(22,27,19,0.08)]",

        elevated:
          "bg-card border border-border shadow-[0_2px_4px_rgba(22,27,19,0.08),0_12px_32px_-6px_rgba(22,27,19,0.14)] dark:shadow-[0_2px_0_rgba(0,0,0,0.5),0_16px_40px_-8px_rgba(0,0,0,0.5)]",

        interactive:
          "bg-card border border-border shadow-[0_1px_2px_rgba(22,27,19,0.05),0_4px_12px_-2px_rgba(22,27,19,0.08)] hover:border-foreground/20 hover:shadow-[0_2px_4px_rgba(22,27,19,0.08),0_12px_32px_-6px_rgba(22,27,19,0.14)] cursor-pointer",

        outlined: "bg-card border border-border hover:border-foreground/30",

        ghost: "bg-transparent hover:bg-accent/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface CardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-foreground",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
};
