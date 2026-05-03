import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva(
  [
    "flex w-full rounded-md text-sm transition-colors duration-150",
    "placeholder:text-muted-foreground",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border border-input bg-background text-foreground",
          "hover:border-foreground/30",
          "focus:border-ring focus:ring-2 focus:ring-ring/20",
        ].join(" "),

        filled: [
          "border border-transparent bg-muted text-foreground",
          "hover:bg-muted/80",
          "focus:bg-background focus:border-input focus:ring-2 focus:ring-ring/20",
        ].join(" "),

        ghost: [
          "border border-transparent bg-transparent text-foreground",
          "hover:bg-accent/50",
          "focus:bg-accent/50 focus:ring-2 focus:ring-ring/20",
        ].join(" "),

        error: [
          "border border-destructive bg-background text-foreground",
          "hover:border-destructive/80",
          "focus:border-destructive focus:ring-2 focus:ring-destructive/20",
        ].join(" "),
      },
      textSize: {
        sm: "text-xs min-h-[60px] px-2.5 py-1.5",
        default: "text-sm min-h-[80px] px-3 py-2",
        lg: "text-base min-h-[100px] px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      textSize: "default",
    },
  },
);

interface TextareaProps
  extends
    React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, textSize, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant, textSize }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
