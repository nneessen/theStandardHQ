// src/features/leaderboard/components/MetricsHelpPopover.tsx
// Help popover explaining leaderboard metrics (IP, AP, Policies, etc.)

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function MetricsHelpPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-muted-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-xs">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-foreground mb-1">
              Metrics Explained
            </h4>
          </div>

          <div className="space-y-2">
            <div>
              <span className="font-medium text-warning">
                IP (Issued Premium)
              </span>
              <p className="text-muted-foreground dark:text-muted-foreground text-[11px] mt-0.5">
                Total annual premium from active policies with paid advance
                commissions. This represents confirmed, commission-generating
                business.
              </p>
            </div>

            <div>
              <span className="font-medium text-info">AP (Annual Premium)</span>
              <p className="text-muted-foreground dark:text-muted-foreground text-[11px] mt-0.5">
                Total annual premium from pending policies (submitted but not
                yet issued). This is business in the pipeline awaiting carrier
                approval.
              </p>
            </div>

            <div>
              <span className="font-medium text-muted-foreground">
                Policies (+N)
              </span>
              <p className="text-muted-foreground dark:text-muted-foreground text-[11px] mt-0.5">
                Shows issued policy count with pending policies in parentheses.
                Example: "12 (+3)" means 12 issued policies and 3 more pending.
              </p>
            </div>

            <div>
              <span className="font-medium text-muted-foreground">
                Prospects
              </span>
              <p className="text-muted-foreground dark:text-muted-foreground text-[11px] mt-0.5">
                Potential recruits who have been identified but not yet enrolled
                in the onboarding pipeline.
              </p>
            </div>

            <div>
              <span className="font-medium text-muted-foreground">
                Pipeline
              </span>
              <p className="text-muted-foreground dark:text-muted-foreground text-[11px] mt-0.5">
                Recruits actively progressing through onboarding stages (not
                prospects, completed, or dropped).
              </p>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
