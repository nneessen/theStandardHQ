import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AttentionItem {
  id: string;
  count: number;
  label: string;
  tone?: "default" | "warn" | "error" | "success" | "progress";
  onSelect?: () => void;
  isActive?: boolean;
}

interface PipelineAttentionRowProps {
  items: AttentionItem[];
  className?: string;
}

const COUNT_TONE: Record<NonNullable<AttentionItem["tone"]>, string> = {
  default: "text-v2-ink ",
  warn: "text-warning",
  error: "text-destructive",
  success: "text-success",
  progress: "text-info dark:text-info",
};

const PILL_TONE: Record<NonNullable<AttentionItem["tone"]>, string> = {
  default:
    "bg-v2-canvas dark:bg-v2-ring ring-v2-ring  hover:bg-v2-ring dark:hover:bg-v2-card-dark",
  warn: "bg-warning/10 dark:bg-warning/20 ring-warning/30 dark:ring-warning hover:bg-warning/20 dark:hover:bg-warning/10/60",
  error:
    "bg-destructive/10 dark:bg-destructive/20 ring-destructive/30 dark:ring-destructive hover:bg-destructive/20 dark:hover:bg-destructive/10/60",
  success:
    "bg-success/10 dark:bg-success/20 ring-success/30 dark:ring-success hover:bg-success/20 dark:hover:bg-success/10/60",
  progress:
    "bg-info/10 dark:bg-info/40 ring-info dark:ring-info hover:bg-info/20 dark:hover:bg-info/60",
};

const PILL_ACTIVE: Record<NonNullable<AttentionItem["tone"]>, string> = {
  default: "bg-v2-ring  ring-v2-ring ",
  warn: "bg-warning/20 dark:bg-warning/10/60 ring-warning/40 dark:ring-warning",
  error:
    "bg-destructive/20 dark:bg-destructive/10/60 ring-destructive/40 dark:ring-destructive",
  success:
    "bg-success/20 dark:bg-success/10/60 ring-success/40 dark:ring-success",
  progress: "bg-info/20 dark:bg-info/60 ring-info dark:ring-info",
};

export const PipelineAttentionRow: React.FC<PipelineAttentionRowProps> = ({
  items,
  className,
}) => {
  const visible = items.filter((i) => i.count > 0);
  if (visible.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-2xl bg-white dark:bg-v2-card ring-1 ring-v2-ring  shadow-sm dark:shadow-none p-5 md:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-3.5 w-3.5 text-warning" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-v2-ink dark:text-v2-ink-subtle">
          Needs your attention
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((item) => {
          const tone = item.tone ?? "default";
          const interactive = !!item.onSelect;
          const Tag = interactive ? "button" : "div";
          return (
            <Tag
              key={item.id}
              type={interactive ? "button" : undefined}
              onClick={interactive ? item.onSelect : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full ring-1 px-3 py-1.5 transition-colors",
                item.isActive ? PILL_ACTIVE[tone] : PILL_TONE[tone],
                interactive && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "font-mono tabular-nums font-bold text-[14px]",
                  COUNT_TONE[tone],
                )}
              >
                {item.count}
              </span>
              <span className="text-[12px] text-v2-ink dark:text-v2-ink-subtle">
                {item.label}
              </span>
            </Tag>
          );
        })}
      </div>
    </section>
  );
};
