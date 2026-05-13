import React from "react";
import {
  Check,
  Clock,
  Lock,
  CircleAlert,
  Circle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StepperStatus =
  | "completed"
  | "in_progress"
  | "blocked"
  | "locked"
  | "not_started";

export interface StepperItem {
  id: string;
  index: number;
  name: string;
  status: StepperStatus;
  caption?: React.ReactNode;
  detail?: React.ReactNode;
}

interface EditorialStepperProps {
  items: StepperItem[];
  className?: string;
  expandedId?: string | null;
  onToggleExpanded?: (id: string) => void;
}

// Themed for `.theme-landing` — sharp 2px corners, deep-green / icy-blue /
// adventure-yellow palette, JetBrains Mono numeric labels.

const ICON_BY_STATUS: Record<
  StepperStatus,
  React.ComponentType<{ className?: string }>
> = {
  completed: Check,
  in_progress: Clock,
  blocked: CircleAlert,
  locked: Lock,
  not_started: Circle,
};

type ToneStyles = { bg: string; color: string; border: string };

const ICON_TONE: Record<StepperStatus, ToneStyles> = {
  completed: {
    bg: "var(--landing-deep-green)",
    color: "var(--landing-adventure-yellow)",
    border: "var(--landing-deep-green)",
  },
  in_progress: {
    bg: "var(--landing-adventure-yellow)",
    color: "var(--landing-deep-green)",
    border: "var(--landing-deep-green)",
  },
  blocked: {
    bg: "rgb(220, 38, 38)",
    color: "var(--landing-icy-blue)",
    border: "rgb(185, 28, 28)",
  },
  locked: {
    bg: "var(--landing-icy-blue-light)",
    color: "var(--landing-terrain-grey-dark)",
    border: "var(--landing-border)",
  },
  not_started: {
    bg: "var(--landing-white)",
    color: "var(--landing-terrain-grey-dark)",
    border: "var(--landing-border)",
  },
};

const PILL_TONE: Record<StepperStatus, ToneStyles> = {
  completed: {
    bg: "var(--landing-adventure-yellow)",
    color: "var(--landing-deep-green)",
    border: "var(--landing-deep-green)",
  },
  in_progress: {
    bg: "var(--landing-icy-blue)",
    color: "var(--landing-deep-green)",
    border: "var(--landing-deep-green)",
  },
  blocked: {
    bg: "rgba(220, 38, 38, 0.10)",
    color: "rgb(185, 28, 28)",
    border: "rgba(220, 38, 38, 0.35)",
  },
  locked: {
    bg: "var(--landing-icy-blue-light)",
    color: "var(--landing-terrain-grey-dark)",
    border: "var(--landing-border)",
  },
  not_started: {
    bg: "var(--landing-white)",
    color: "var(--landing-terrain-grey-dark)",
    border: "var(--landing-border)",
  },
};

const STATUS_LABEL: Record<StepperStatus, string> = {
  completed: "Done",
  in_progress: "In progress",
  blocked: "Blocked",
  locked: "Locked",
  not_started: "Not started",
};

export const EditorialStepper: React.FC<EditorialStepperProps> = ({
  items,
  className,
  expandedId,
  onToggleExpanded,
}) => {
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => {
        const Icon = ICON_BY_STATUS[item.status];
        const isExpanded = expandedId === item.id;
        const isInteractive = !!onToggleExpanded && !!item.detail;
        const muted = item.status === "locked" || item.status === "not_started";
        const iconStyles = ICON_TONE[item.status];
        const pillStyles = PILL_TONE[item.status];
        return (
          <li
            key={item.id}
            className={cn(
              "rounded-[2px] surface-paper border border-[var(--landing-border)] overflow-hidden",
              "shadow-[0_1px_0_rgba(22,27,19,0.04),0_4px_16px_-2px_rgba(22,27,19,0.06)]",
              isInteractive &&
                "transition-shadow hover:shadow-[0_1px_0_rgba(22,27,19,0.08),0_8px_24px_-4px_rgba(22,27,19,0.12)]",
            )}
          >
            <div
              role={isInteractive ? "button" : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              onClick={
                isInteractive ? () => onToggleExpanded?.(item.id) : undefined
              }
              onKeyDown={
                isInteractive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleExpanded?.(item.id);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5",
                isInteractive && "cursor-pointer select-none",
              )}
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] border flex-shrink-0"
                style={{
                  background: iconStyles.bg,
                  borderColor: iconStyles.border,
                  color: iconStyles.color,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span
                className="font-mono tabular text-[12px] font-bold w-7 flex-shrink-0"
                style={{ color: "var(--landing-terrain-grey-dark)" }}
              >
                {String(item.index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[14px] sm:text-[15px] font-bold tracking-tight truncate"
                  style={{
                    color: muted
                      ? "var(--landing-terrain-grey-dark)"
                      : "var(--landing-deep-green)",
                  }}
                >
                  {item.name}
                </div>
                {item.caption && (
                  <div className="mt-0.5 text-eyebrow normal-case">
                    {item.caption}
                  </div>
                )}
              </div>
              <span
                className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] uppercase tracking-[0.12em] font-bold border whitespace-nowrap font-mono"
                style={{
                  background: pillStyles.bg,
                  color: pillStyles.color,
                  borderColor: pillStyles.border,
                }}
              >
                {STATUS_LABEL[item.status]}
              </span>
              {isInteractive && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform flex-shrink-0",
                    isExpanded && "rotate-180",
                  )}
                  style={{ color: "var(--landing-terrain-grey-dark)" }}
                />
              )}
            </div>
            {isExpanded && item.detail && (
              <div
                className="border-t border-[var(--landing-border)] px-4 sm:px-5 py-4"
                style={{ background: "var(--landing-icy-blue-light)" }}
              >
                {item.detail}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};
