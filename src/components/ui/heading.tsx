import * as React from "react";
import { cn } from "@/lib/utils";

export interface HeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  variant?: "default" | "compact" | "display";
}

const Heading = React.forwardRef<HTMLDivElement, HeadingProps>(
  (
    { title, subtitle, className, children, variant = "compact", ...props },
    ref,
  ) => {
    if (variant === "display") {
      return (
        <div ref={ref} className={cn("mb-4", className)} {...props}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1
                className="text-page-title text-2xl md:text-3xl text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            {children && (
              <div className="flex items-center gap-2">{children}</div>
            )}
          </div>
        </div>
      );
    }

    if (variant === "compact") {
      return (
        <div ref={ref} className={cn("mb-2", className)} {...props}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[11px] font-medium text-muted-foreground uppercase">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {children && (
              <div className="flex items-center gap-1">{children}</div>
            )}
          </div>
          <div className="h-px bg-border mt-1.5" />
        </div>
      );
    }

    // Default — banner-style header.
    return (
      <div ref={ref} className={cn("-mx-3 -mt-3 mb-4", className)} {...props}>
        <div className="bg-muted px-3 py-2 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {children && (
              <div className="flex items-center gap-1.5">{children}</div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
Heading.displayName = "Heading";

export { Heading };
