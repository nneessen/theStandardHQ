// src/features/underwriting/components/QuickQuote/icon-toggle.tsx

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface IconToggleOption<T extends string> {
  value: T;
  label: string;
  content: ReactNode;
}

interface IconToggleProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: IconToggleOption<T>[];
}

/**
 * A segmented toggle that renders icon/ReactNode content with tooltip labels.
 */
export function IconToggle<T extends string>({
  value,
  onChange,
  options,
}: IconToggleProps<T>) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex rounded-md border border-border dark:border-border overflow-hidden h-7">
        {options.map((opt, idx) => (
          <Tooltip key={opt.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(opt.value)}
                className={cn(
                  "px-2.5 flex items-center justify-center gap-1 text-xs font-medium transition-colors",
                  value === opt.value
                    ? "bg-foreground text-background dark:bg-background dark:text-foreground"
                    : "bg-white text-muted-foreground hover:bg-background dark:bg-card dark:text-muted-foreground dark:hover:bg-card-tinted",
                  idx > 0 && "border-l border-border dark:border-border",
                )}
              >
                {opt.content}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {opt.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
