// src/features/dashboard/components/GatedStat.tsx
// Component to display a gated stat with lock icon when user lacks access

import React from "react";
import { Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface GatedStatProps {
  /** Whether the user has access to this stat */
  hasAccess: boolean;
  /** The actual stat value to display when unlocked */
  value: string | number;
  /** Value to show when locked (default: "—") */
  lockedValue?: string;
  /** Tooltip message when locked */
  lockedTooltip?: string;
  /** Additional className for the value */
  className?: string;
  /** Whether to show the lock icon */
  showLockIcon?: boolean;
}

/**
 * GatedStat - Displays a stat value or locked state based on subscription access
 *
 * When locked:
 * - Shows "—" (or custom lockedValue) with a lock icon
 * - Tooltip explains what tier is needed to unlock
 *
 * When unlocked:
 * - Shows the actual value
 */
export const GatedStat: React.FC<GatedStatProps> = ({
  hasAccess,
  value,
  lockedValue = "—",
  lockedTooltip = "Upgrade to unlock",
  className,
  showLockIcon = true,
}) => {
  if (hasAccess) {
    return <span className={className}>{value}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-muted-foreground dark:text-muted-foreground cursor-help",
              className,
            )}
          >
            {lockedValue}
            {showLockIcon && <Lock className="h-2.5 w-2.5" />}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{lockedTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
