// src/features/kpi/components/KpiGuideSheet.tsx
// The "?" guide for the Call KPI dashboard: a grounded reference of what every
// section shows and how each number is computed, so nothing reads as a mystery.

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface GuideItem {
  title: string;
  body: string;
}

const SECTIONS: GuideItem[] = [
  {
    title: "Performance",
    body: "Your headline numbers from the daily totals you log: inbound call volume, closing rate (clients ÷ calls), policies sold, premium written, cost per acquisition ((lead + marketing spend) ÷ clients), and the average length of your analyzed calls.",
  },
  {
    title: "Trend",
    body: "Inbound calls (bars) and policies sold (line) day by day, so you can see momentum and slow days across the selected range.",
  },
  {
    title: "Best Performing States",
    body: "Your top states ranked by closing rate, with the rate bar colored green / amber / red, plus premium written and call count — from analyzed call recordings.",
  },
  {
    title: "Time of Day & Day of Week",
    body: "When inbound calls actually close: a row per hour that had calls (volume bar + close-rate color), a day-of-week strip, and a highlighted best window to staff the phones.",
  },
  {
    title: "Caller Demographics",
    body: "The mix of who's calling — call counts by age band with each band's closing rate, and a gender split.",
  },
  {
    title: "Call Length Distribution",
    body: "How long calls run (0–2m / 2–5m / 5–10m / 10m+) and the closing rate within each bucket, so you can see whether longer conversations close.",
  },
  {
    title: "Word-Track Effectiveness",
    body: "Which scripted phrases close: the closing rate when each phrase is used versus your overall baseline (the green/red delta), how often it's used, and where in the call it typically lands.",
  },
  {
    title: "Team",
    body: "An agent leaderboard ranked by closing rate, with calls, policies, and premium — scoped to the agents you're allowed to see.",
  },
];

const NOTES = [
  "The Performance band and Trend use your logged daily totals (the complete call volume and economics).",
  "All breakdowns below the Trend are computed from your analyzed call recordings, so their denominators reflect the recordings you've uploaded, not every dialer call.",
  "Use the date-range selector to change the period, and “Log day” to enter or edit a day's numbers.",
];

export function KpiGuideSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="How to read this dashboard"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>How to read this dashboard</SheetTitle>
          <SheetDescription>
            Every section and how its numbers are computed. All figures come
            from your real KPI data and respect what you're allowed to see.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-5">
          {SECTIONS.map((s) => (
            <div key={s.title} className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}

          <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
            <h3 className="text-sm font-semibold text-foreground">
              Where the numbers come from
            </h3>
            <ul className="list-disc space-y-1.5 pl-4">
              {NOTES.map((n) => (
                <li
                  key={n}
                  className="text-[13px] leading-relaxed text-muted-foreground"
                >
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
