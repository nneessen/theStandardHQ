import { Zap } from "lucide-react";

export function XpDisplay({ xp }: { xp: number }) {
  // XP levels: 0-499 = Lvl 1, 500-1499 = Lvl 2, etc.
  const level = Math.floor(xp / 500) + 1;

  return (
    <div className="flex items-center gap-1">
      <Zap className="h-3 w-3 text-amber-500" />
      <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px]">
        {xp.toLocaleString()}
      </span>
      <span className="text-v2-ink-subtle text-[10px]">XP</span>
      <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 rounded">
        Lvl {level}
      </span>
    </div>
  );
}
