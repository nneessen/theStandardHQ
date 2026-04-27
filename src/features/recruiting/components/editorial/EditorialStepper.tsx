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

const ICON_RING: Record<StepperStatus, string> = {
  completed: "bg-emerald-500 text-white ring-emerald-100 dark:ring-emerald-950",
  in_progress: "bg-sky-500 text-white ring-sky-100 dark:ring-sky-950",
  blocked: "bg-red-600 text-white ring-red-100 dark:ring-red-950",
  locked:
    "bg-v2-ring  text-v2-ink-muted dark:text-v2-ink-subtle ring-v2-ring/60 ",
  not_started:
    "bg-white dark:bg-v2-card text-v2-ink-subtle dark:text-v2-ink-muted ring-v2-ring  border border-v2-ring ",
};

const STATUS_PILL: Record<StepperStatus, string> = {
  completed:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900",
  in_progress:
    "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-900",
  blocked:
    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-900",
  locked:
    "bg-v2-ring dark:bg-v2-ring text-v2-ink-muted dark:text-v2-ink-subtle ring-v2-ring ",
  not_started:
    "bg-v2-canvas dark:bg-v2-card text-v2-ink-muted dark:text-v2-ink-subtle ring-v2-ring ",
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
        return (
          <li
            key={item.id}
            className={cn(
              "rounded-xl bg-white dark:bg-v2-card ring-1 ring-v2-ring  shadow-sm dark:shadow-none overflow-hidden transition-shadow",
              isInteractive && "hover:shadow-md ",
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
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full ring-4 flex-shrink-0",
                  ICON_RING[item.status],
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono tabular-nums text-[12px] font-bold text-v2-ink-subtle dark:text-v2-ink-muted w-7 flex-shrink-0">
                {String(item.index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-[14px] sm:text-[15px] font-semibold tracking-tight truncate",
                    muted
                      ? "text-v2-ink-muted dark:text-v2-ink-subtle"
                      : "text-v2-ink ",
                  )}
                >
                  {item.name}
                </div>
                {item.caption && (
                  <div className="mt-0.5 text-[12px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
                    {item.caption}
                  </div>
                )}
              </div>
              <span
                className={cn(
                  "hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em] font-bold ring-1 whitespace-nowrap",
                  STATUS_PILL[item.status],
                )}
              >
                {STATUS_LABEL[item.status]}
              </span>
              {isInteractive && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-v2-ink-subtle dark:text-v2-ink-muted transition-transform flex-shrink-0",
                    isExpanded && "rotate-180",
                  )}
                />
              )}
            </div>
            {isExpanded && item.detail && (
              <div className="border-t border-v2-ring  bg-v2-canvas/50 dark:bg-v2-canvas/40 px-4 sm:px-5 py-4">
                {item.detail}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};
