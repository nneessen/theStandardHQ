// src/features/messages/components/instagram/InstagramWindowIndicator.tsx
// 24hr messaging window status indicator badge — board token restyle

import { type ReactNode } from "react";
import { Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { T } from "@/components/board/tokens";
import {
  selectWindowStatus,
  selectWindowTimeRemaining,
  formatTimeRemaining,
} from "@/lib/instagram";

// Alpha tints — T has solid colors only; literals match mock exactly
const AMBER_BG = "rgba(244,180,58,0.20)";
const RED_BG = "rgba(255,106,93,0.18)";
const MUT3 = "rgba(255,255,255,0.28)";

interface InstagramWindowIndicatorProps {
  canReplyUntil: string | null;
  variant?: "badge" | "inline" | "minimal";
  className?: string;
  showTooltip?: boolean;
}

export function InstagramWindowIndicator({
  canReplyUntil,
  variant = "badge",
  className: _className,
  showTooltip = true,
}: InstagramWindowIndicatorProps): ReactNode {
  const status = selectWindowStatus(canReplyUntil);
  const timeRemaining = selectWindowTimeRemaining(canReplyUntil);
  const formattedTime = formatTimeRemaining(timeRemaining);

  const getStatusConfig = () => {
    switch (status) {
      case "open":
        return {
          bg: AMBER_BG,
          color: T.amber,
          dotColor: T.amber,
          label: formattedTime,
          shortLabel: formattedTime || "Open",
        };
      case "closing_soon":
        return {
          bg: AMBER_BG,
          color: T.amber,
          dotColor: T.amber,
          label: formattedTime,
          shortLabel: formattedTime || "Closing soon",
        };
      case "closed":
        return {
          bg: RED_BG,
          color: T.red,
          dotColor: T.red,
          label: "Window closed",
          shortLabel: "Closed",
        };
    }
  };

  const config = getStatusConfig();

  const tooltipContent = (
    <div style={{ maxWidth: 240 }}>
      <p
        style={{
          font: `700 11px ${T.data}`,
          color: T.ink,
          margin: "0 0 4px",
        }}
      >
        Instagram 24-Hour Window
      </p>
      <p
        style={{
          font: `500 10px ${T.data}`,
          color: T.mut,
          margin: "0 0 4px",
        }}
      >
        {status === "closed"
          ? "You can only send messages within 24 hours of the user's last message. Wait for them to message you first."
          : "You can reply to this conversation until the window closes. After that, wait for the user to message you."}
      </p>
      {canReplyUntil && status !== "closed" && (
        <p style={{ font: `500 10px ${T.data}`, color: T.mut2, margin: 0 }}>
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
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 22,
              padding: "0 9px",
              borderRadius: 99,
              background: config.bg,
              color: config.color,
              font: `700 10px ${T.mono}`,
              letterSpacing: "0.04em",
              flexShrink: 0,
            }}
          >
            <Clock style={{ width: 11, height: 11 }} />
            <span>{config.shortLabel}</span>
          </div>
        );

      case "inline":
        return (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: `600 11px ${T.data}`,
              color: config.color,
            }}
          >
            <Clock style={{ width: 12, height: 12 }} />
            <span>{config.label}</span>
          </div>
        );

      case "minimal":
        return (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: config.dotColor,
            }}
            title={config.label}
          />
        );
    }
  })();

  if (!showTooltip) {
    return indicator;
  }

  // No canReplyUntil — render MUT3 minimal pill
  if (!canReplyUntil && variant === "badge") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          height: 22,
          padding: "0 9px",
          borderRadius: 99,
          background: "rgba(255,255,255,0.06)",
          color: MUT3,
          font: `700 10px ${T.mono}`,
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        <Clock style={{ width: 11, height: 11 }} />
        <span>No window</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent
          side="top"
          style={{ background: T.surface5, border: `1px solid ${T.line2}` }}
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
