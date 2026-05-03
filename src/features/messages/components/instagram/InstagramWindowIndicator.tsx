// src/features/messages/components/instagram/InstagramWindowIndicator.tsx
// 24hr messaging window status indicator badge

import { type ReactNode } from "react";
import { Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  selectWindowStatus,
  selectWindowTimeRemaining,
  formatTimeRemaining,
} from "@/lib/instagram";

interface InstagramWindowIndicatorProps {
  canReplyUntil: string | null;
  variant?: "badge" | "inline" | "minimal";
  className?: string;
  showTooltip?: boolean;
}

export function InstagramWindowIndicator({
  canReplyUntil,
  variant = "badge",
  className,
  showTooltip = true,
}: InstagramWindowIndicatorProps): ReactNode {
  const status = selectWindowStatus(canReplyUntil);
  const timeRemaining = selectWindowTimeRemaining(canReplyUntil);
  const formattedTime = formatTimeRemaining(timeRemaining);

  const getStatusConfig = () => {
    switch (status) {
      case "open":
        return {
          icon: CheckCircle,
          color: "text-success",
          bgColor: "bg-success/20 dark:bg-success/30",
          borderColor: "border-success/30",
          dotColor: "bg-success",
          label: formattedTime,
          shortLabel: "Open",
        };
      case "closing_soon":
        return {
          icon: AlertCircle,
          color: "text-warning",
          bgColor: "bg-warning/20 dark:bg-warning/30",
          borderColor: "border-warning/30",
          dotColor: "bg-warning",
          label: formattedTime,
          shortLabel: "Closing soon",
        };
      case "closed":
        return {
          icon: XCircle,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          borderColor: "border-border",
          dotColor: "bg-muted",
          label: "Window closed",
          shortLabel: "Closed",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const tooltipContent = (
    <div className="max-w-xs space-y-1">
      <p className="font-medium text-[11px]">Instagram 24-Hour Window</p>
      <p className="text-[10px] text-muted-foreground">
        {status === "closed"
          ? "You can only send messages within 24 hours of the user's last message. Wait for them to message you first."
          : "You can reply to this conversation until the window closes. After that, wait for the user to message you."}
      </p>
      {canReplyUntil && status !== "closed" && (
        <p className="text-[10px] text-muted-foreground">
          Expires:{" "}
          {new Date(canReplyUntil).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );

  const indicator: ReactNode = ((): ReactNode => {
    switch (variant) {
      case "badge":
        return (
          <div
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border",
              config.bgColor,
              config.borderColor,
              config.color,
              className,
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            <span>{config.shortLabel}</span>
          </div>
        );

      case "inline":
        return (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px]",
              config.color,
              className,
            )}
          >
            <Clock className="h-3 w-3" />
            <span>{config.label}</span>
          </div>
        );

      case "minimal":
        return (
          <div
            className={cn("w-2 h-2 rounded-full", config.dotColor, className)}
            title={config.label}
          />
        );
    }
  })();

  if (!showTooltip) {
    return indicator;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent side="top" className="p-2">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
