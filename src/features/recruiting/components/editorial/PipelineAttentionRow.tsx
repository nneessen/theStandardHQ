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
  default: "text-stone-900 dark:text-stone-100",
  warn: "text-amber-700 dark:text-amber-400",
  error: "text-red-700 dark:text-red-400",
  success: "text-emerald-700 dark:text-emerald-400",
  progress: "text-sky-700 dark:text-sky-400",
};

const PILL_TONE: Record<NonNullable<AttentionItem["tone"]>, string> = {
  default:
    "bg-stone-50 dark:bg-stone-800 ring-stone-200 dark:ring-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700",
  warn: "bg-amber-50 dark:bg-amber-950/40 ring-amber-200 dark:ring-amber-900 hover:bg-amber-100 dark:hover:bg-amber-950/60",
  error:
    "bg-red-50 dark:bg-red-950/40 ring-red-200 dark:ring-red-900 hover:bg-red-100 dark:hover:bg-red-950/60",
  success:
    "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-200 dark:ring-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-950/60",
  progress:
    "bg-sky-50 dark:bg-sky-950/40 ring-sky-200 dark:ring-sky-900 hover:bg-sky-100 dark:hover:bg-sky-950/60",
};

const PILL_ACTIVE: Record<NonNullable<AttentionItem["tone"]>, string> = {
  default: "bg-stone-100 dark:bg-stone-700 ring-stone-300 dark:ring-stone-600",
  warn: "bg-amber-100 dark:bg-amber-950/60 ring-amber-300 dark:ring-amber-800",
  error: "bg-red-100 dark:bg-red-950/60 ring-red-300 dark:ring-red-800",
  success:
    "bg-emerald-100 dark:bg-emerald-950/60 ring-emerald-300 dark:ring-emerald-800",
  progress: "bg-sky-100 dark:bg-sky-950/60 ring-sky-300 dark:ring-sky-800",
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
        "rounded-2xl bg-white dark:bg-stone-900 ring-1 ring-stone-200/70 dark:ring-stone-800 shadow-sm dark:shadow-none p-5 md:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-700 dark:text-stone-300">
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
              <span className="text-[12px] text-stone-700 dark:text-stone-300">
                {item.label}
              </span>
            </Tag>
          );
        })}
      </div>
    </section>
  );
};
