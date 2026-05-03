import { Zap } from "lucide-react";

export function XpDisplay({ xp }: { xp: number }) {
  // XP levels: 0-499 = Lvl 1, 500-1499 = Lvl 2, etc.
  const level = Math.floor(xp / 500) + 1;

  return (
    <div className="flex items-center gap-1">
      <Zap className="h-3 w-3 text-warning" />
      <span className="font-bold text-warning text-[11px]">
        {xp.toLocaleString()}
      </span>
      <span className="text-v2-ink-subtle text-[10px]">XP</span>
      <span className="text-[9px] bg-warning/20 dark:bg-warning/30 text-warning px-1 rounded">
        Lvl {level}
      </span>
    </div>
  );
}
