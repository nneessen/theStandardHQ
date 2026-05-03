import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  [
    "relative w-full rounded-md border px-4 py-3 text-sm",
    "[&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-card border-border text-foreground",
          "[&>svg]:text-muted-foreground",
        ].join(" "),

        muted: [
          "bg-muted border-border text-foreground",
          "[&>svg]:text-muted-foreground",
        ].join(" "),

        info: [
          "bg-card border-border border-l-4 border-l-info text-foreground",
          "[&>svg]:text-info",
        ].join(" "),

        success: [
          "bg-card border-border border-l-4 border-l-success text-foreground",
          "[&>svg]:text-success",
        ].join(" "),

        warning: [
          "bg-card border-border border-l-4 border-l-warning text-foreground",
          "[&>svg]:text-warning",
        ].join(" "),

        destructive: [
          "bg-card border-border border-l-4 border-l-destructive text-foreground",
          "[&>svg]:text-destructive",
        ].join(" "),

        outline: [
          "bg-transparent border-border text-foreground",
          "[&>svg]:text-muted-foreground",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90 [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
