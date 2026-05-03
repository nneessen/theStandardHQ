import { Flame } from "lucide-react";

export function StreakIndicator({ days }: { days: number }) {
  const isActive = days > 0;

  return (
    <div className="flex items-center gap-1">
      <Flame
        className={`h-3 w-3 ${isActive ? "text-warning" : "text-v2-ink-subtle dark:text-v2-ink-muted"}`}
      />
      <span
        className={`font-bold text-[11px] ${isActive ? "text-warning" : "text-v2-ink-subtle"}`}
      >
        {days}
      </span>
      <span className="text-v2-ink-subtle text-[10px]">
        day{days !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
