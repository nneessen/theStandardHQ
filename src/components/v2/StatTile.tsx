import React from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  icon?: React.ReactNode;
  value: string | number;
  caption: string;
  align?: "start" | "center";
  className?: string;
}

/**
 * Big-number stat tile (the "78 Employees / 56 Hirings / 203 Projects"
 * row in the Crextio reference). Use in tight horizontal clusters at
 * the top of a page.
 */
export const StatTile: React.FC<StatTileProps> = ({
  icon,
  value,
  caption,
  align = "start",
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        align === "center" && "items-center",
        className,
      )}
    >
      <div className="flex items-end gap-2">
        {icon && (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-v2-pill bg-v2-accent-soft text-v2-ink mb-1">
            {icon}
          </span>
        )}
        <span className="text-4xl font-semibold tracking-tight leading-none text-v2-ink">
          {value}
        </span>
      </div>
      <span className="text-[11px] uppercase tracking-wider text-v2-ink-muted font-medium">
        {caption}
      </span>
    </div>
  );
};
