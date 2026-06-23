// src/features/analytics/tabs/InboundCallsTab.tsx
// Inbound-call performance — merged in from the retired /kpi page. Two data
// sources, kept legible by the provenance divider:
//   • logged DAILY totals (Performance + Trend) — manual "Log day" entry
//   • analyzed call RECORDINGS (overview, timing, demographics, geography,
//     length, leaderboard) — RLS-scoped, board-skinned panels
// Date range comes from the page-level selector via useInboundCallRange().

import { Link } from "@tanstack/react-router";
import { CalendarPlus, Headphones } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ManualKpiEntryPanel,
  KpiGuideSheet,
  PerformanceBand,
  TrendPanel,
  RecordingsProvenance,
} from "@/features/kpi";
import { useInboundCallRange } from "../board/inbound/utils";
import { ROW_1, ROW_3, ROW_3_WIDE } from "./grid";
import {
  InboundCallsOverviewPanel,
  CallTimingPanel,
  CallDemographicsPanel,
  CallGeographyPanel,
  CallAgentLeaderboardPanel,
  CallLengthPanel,
  PlainCell,
} from "./panels";

export function InboundCallsTab() {
  const range = useInboundCallRange();

  return (
    <>
      {/* Toolbar — log a day's numbers + the metric guide. Date range is set by
          the page-level period selector in the header. */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <CalendarPlus className="h-3.5 w-3.5" />
              Log day
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Log day</DialogTitle>
              <DialogDescription>
                Enter or edit a day's call numbers. Saving updates the
                Performance band and Trend.
              </DialogDescription>
            </DialogHeader>
            <ManualKpiEntryPanel />
          </DialogContent>
        </Dialog>
        <KpiGuideSheet />
      </div>

      {/* 1. Performance + 2. Trend — from logged daily totals */}
      <div className="mb-6">
        <PerformanceBand range={range} />
      </div>
      <div className="mb-6">
        <TrendPanel range={range} />
      </div>

      {/* Provenance divider — everything below is from analyzed recordings */}
      <div className="mb-6">
        <RecordingsProvenance range={range} />
      </div>

      {/* Inbound overview (outcome mix; full width) */}
      <div className={ROW_1}>
        <PlainCell minHeight={220}>
          <InboundCallsOverviewPanel />
        </PlainCell>
      </div>

      {/* Timing | Demographics | Geography */}
      <div className={ROW_3}>
        <PlainCell minHeight={340}>
          <CallTimingPanel />
        </PlainCell>
        <PlainCell minHeight={340}>
          <CallDemographicsPanel />
        </PlainCell>
        <PlainCell minHeight={340}>
          <CallGeographyPanel />
        </PlainCell>
      </div>

      {/* Agent leaderboard (2-wide) | Call length */}
      <div className={ROW_3_WIDE}>
        <PlainCell span={2} minHeight={320}>
          <CallAgentLeaderboardPanel />
        </PlainCell>
        <PlainCell minHeight={320}>
          <CallLengthPanel />
        </PlainCell>
      </div>

      {/* Where the analyzed recordings come from */}
      <div className="flex justify-center">
        <Link
          to="/call-reviews"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-v2-ink-muted hover:text-v2-ink"
        >
          <Headphones className="h-3.5 w-3.5" />
          Upload calls in Call Reviews →
        </Link>
      </div>
    </>
  );
}
