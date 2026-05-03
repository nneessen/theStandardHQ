import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full text-sm transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "h-9 rounded-md bg-background border border-input px-3 py-2 text-foreground hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring",

        minimal:
          "h-9 bg-transparent border-b border-input rounded-none px-1 py-2 focus:border-foreground focus:outline-none",

        filled:
          "h-9 rounded-md bg-muted border border-transparent px-3 py-2 text-foreground hover:bg-muted/80 focus:bg-background focus:border-input focus:outline-none focus:ring-2 focus:ring-ring/20",

        ghost:
          "h-9 rounded-md bg-transparent px-3 py-2 hover:bg-accent/50 focus:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring/20",

        outlined:
          "h-9 rounded-md bg-transparent border border-input px-3 py-2 hover:border-foreground/30 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20",
      },
      inputSize: {
        default: "h-9",
        sm: "h-8 text-xs",
        lg: "h-11 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  },
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
