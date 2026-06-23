// src/features/social-studio/components/QuickPostsPanel.tsx
// One-tap presets that configure the studio (Phase 1, fully functional — they
// reshape the live preview from real data). Deeper AI-drafted one-offs
// (recruiting, welcomes, milestones, quote cards) arrive with the automation
// phase; we state that honestly rather than show dead buttons.

import { Cap } from "@/components/board";
import { CalendarDays, CalendarRange, Star, FileBarChart } from "lucide-react";
import type { SocialStudioConfig } from "../types";

interface Preset {
  key: string;
  label: string;
  blurb: string;
  icon: typeof Star;
  patch: Partial<SocialStudioConfig>;
}

const PRESETS: Preset[] = [
  {
    key: "daily10",
    label: "Today's Top 10",
    blurb: "Daily leaderboard",
    icon: CalendarDays,
    patch: { view: "daily", topN: 10, title: undefined },
  },
  {
    key: "weekly",
    label: "Weekly Leaderboard",
    blurb: "This week's top 10",
    icon: CalendarRange,
    patch: { view: "weekly", topN: 10, title: undefined },
  },
  {
    key: "aotw",
    label: "Agent of the Week",
    blurb: "This week's #1 producer",
    icon: Star,
    patch: { view: "aotw" },
  },
  {
    key: "monthly",
    label: "Monthly Report",
    blurb: "Agency recap",
    icon: FileBarChart,
    patch: { view: "monthly", title: undefined },
  },
];

export function QuickPostsPanel({
  onApply,
}: {
  onApply: (patch: Partial<SocialStudioConfig>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onApply(p.patch)}
              className="flex items-start gap-2 rounded-lg border border-border bg-card/50 p-2.5 text-left transition-colors hover:border-accent hover:bg-accent/10"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">
                  {p.label}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.blurb}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {/* div (not p): <Cap> renders a <div>, which is invalid inside a <p> and
          triggers a React hydration warning. */}
      <div className="px-0.5 text-[11px] leading-snug text-muted-foreground">
        <Cap style={{ fontSize: 10, display: "inline" }}>Coming next</Cap> —
        AI-generated one-offs (recruiting / “we’re hiring”, new-recruit
        welcomes, production milestones, work anniversaries, motivational) land
        with the automation phase.
      </div>
    </div>
  );
}
