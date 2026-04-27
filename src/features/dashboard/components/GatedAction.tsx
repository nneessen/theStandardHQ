// src/features/dashboard/components/GatedAction.tsx
// Component to display a gated action button with upgrade prompt when user lacks access

import React from "react";
import { Lock, Crown } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface GatedActionProps {
  /** Whether the user has access to this action */
  hasAccess: boolean;
  /** Button label */
  label: string;
  /** Click handler when unlocked */
  onClick: () => void;
  /** Whether the action is currently loading/disabled */
  isLoading?: boolean;
  /** Tooltip message when locked */
  lockedTooltip?: string;
  /** Required tier name for display */
  requiredTier?: string;
  /** Additional className */
  className?: string;
}

/**
 * GatedAction - Button that shows locked state when user lacks subscription access
 *
 * When locked:
 * - Button is disabled with lock icon
 * - Tooltip shows upgrade message
 * - Click redirects to billing page
 *
 * When unlocked:
 * - Normal button behavior
 */
export const GatedAction: React.FC<GatedActionProps> = ({
  hasAccess,
  label,
  onClick,
  isLoading = false,
  lockedTooltip,
  requiredTier = "Pro",
  className,
}) => {
  const navigate = useNavigate();

  const handleLockedClick = () => {
    navigate({ to: "/billing" });
  };

  if (hasAccess) {
    return (
      <Button
        onClick={onClick}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className={cn(
          "h-6 text-[10px] font-medium justify-start w-full border-v2-ring dark:border-v2-ring-strong hover:bg-v2-canvas dark:hover:bg-v2-card-tinted",
          isLoading && "opacity-60 cursor-not-allowed",
          className,
        )}
      >
        {isLoading ? `${label}...` : label}
      </Button>
    );
  }

  const tooltipMessage =
    lockedTooltip || `Upgrade to ${requiredTier} to unlock`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleLockedClick}
            variant="outline"
            size="sm"
            className={cn(
              "h-6 text-[10px] font-medium justify-start w-full border-v2-ring dark:border-v2-ring-strong",
              "text-v2-ink-subtle dark:text-v2-ink-muted hover:text-v2-ink-muted dark:hover:text-v2-ink-subtle",
              "hover:bg-v2-canvas dark:hover:bg-v2-card-tinted",
              className,
            )}
          >
            <Lock className="h-2.5 w-2.5 mr-1.5" />
            {label}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-[200px]">
          <div className="flex items-start gap-1.5">
            <Crown className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{tooltipMessage}</p>
              <p className="text-v2-ink-subtle dark:text-v2-ink-muted mt-0.5">
                Click to view plans
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
