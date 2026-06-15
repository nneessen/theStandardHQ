// src/features/messages/components/instagram/InstagramPriorityBadge.tsx
// Visual priority star indicator with tooltip — board token restyle

import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { T } from "@/components/board/tokens";

// Violet tint for active priority chip
const VIOLET_BG = "rgba(182,155,255,0.16)";

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
      style={{
        width: 14,
        height: 14,
        fill: isPriority ? T.violet : "none",
        color: isPriority ? T.violet : T.mut2,
        transition: "color .12s, fill .12s",
      }}
    />
  );

  // Badge variant — just the icon with tooltip (for sidebar display)
  if (variant === "badge") {
    if (!isPriority) return null;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div style={{ display: "flex", alignItems: "center" }}>
              {starIcon}
            </div>
          </TooltipTrigger>
          <TooltipContent
            style={{ background: T.surface5, border: `1px solid ${T.line2}` }}
          >
            <div
              style={{ font: `700 11px ${T.data}`, color: T.ink, margin: 0 }}
            >
              Priority conversation
            </div>
            {prioritySetAt && (
              <div
                style={{
                  font: `500 10px ${T.data}`,
                  color: T.mut2,
                  marginTop: 2,
                }}
              >
                Since {format(new Date(prioritySetAt), "MMM d, yyyy")}
              </div>
            )}
            {priorityNotes && (
              <div
                style={{
                  font: `500 10px ${T.data}`,
                  color: T.mut2,
                  marginTop: 4,
                }}
              >
                {priorityNotes}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Button variant — clickable toggle
  // Active = violet tinted chip; inactive = ghost icon button
  const buttonContent = isPriority ? (
    // Active priority — violet tint chip
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 22,
        padding: "0 9px",
        borderRadius: 7,
        background: VIOLET_BG,
        color: T.violet,
        font: `700 10px ${T.data}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        border: "none",
      }}
    >
      {starIcon}
      <span>Priority</span>
    </div>
  ) : (
    // Inactive — ghost icon button style
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 9,
        background: T.surface3,
        border: `1px solid ${T.line2}`,
        color: T.mut,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "color .12s, border-color .12s",
      }}
    >
      {starIcon}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            type="button"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {buttonContent}
          </button>
        </TooltipTrigger>
        <TooltipContent
          style={{ background: T.surface5, border: `1px solid ${T.line2}` }}
        >
          <span style={{ font: `600 11px ${T.data}`, color: T.ink }}>
            {isPriority ? "Remove from priority" : "Add to priority"}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
