// src/features/messages/components/instagram/InstagramPriorityBadge.tsx
// Visual priority star indicator with tooltip

import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InstagramPriorityBadgeProps {
  isPriority: boolean;
  prioritySetAt?: string | null;
  priorityNotes?: string | null;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "button" | "badge";
}

export function InstagramPriorityBadge({
  isPriority,
  prioritySetAt,
  priorityNotes,
  onClick,
  disabled,
  variant = "button",
}: InstagramPriorityBadgeProps): ReactNode {
  const starIcon = (
    <Star
      className={cn(
        "h-3.5 w-3.5",
        isPriority && "fill-amber-500 text-amber-500",
      )}
    />
  );

  // Badge variant - just the icon with tooltip (for sidebar display)
  if (variant === "badge") {
    if (!isPriority) return null;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">{starIcon}</div>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] max-w-xs">
            <div>Priority conversation</div>
            {prioritySetAt && (
              <div className="text-v2-ink-subtle">
                Since {format(new Date(prioritySetAt), "MMM d, yyyy")}
              </div>
            )}
            {priorityNotes && (
              <div className="text-v2-ink-subtle mt-1">{priorityNotes}</div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Button variant - clickable toggle
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              isPriority && "text-amber-500 hover:text-amber-600",
            )}
            onClick={onClick}
            disabled={disabled}
          >
            {starIcon}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">
          {isPriority ? "Remove from priority" : "Add to priority"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
