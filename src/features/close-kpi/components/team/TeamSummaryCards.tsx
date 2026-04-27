// src/features/close-kpi/components/team/TeamSummaryCards.tsx
// Compact 4-tile summary strip for the Team tab.
// Computed entirely client-side from the snapshot rows.

import React, { useMemo } from "react";
import { Activity, Phone, Target, Flame } from "lucide-react";
import type {
  TeamPipelineRow,
  TeamSummaryTotals,
} from "../../types/team-kpi.types";

interface TeamSummaryCardsProps {
  rows: TeamPipelineRow[];
}

const ACTIVE_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes

function computeTotals(rows: TeamPipelineRow[]): TeamSummaryTotals {
  const now = Date.now();
  let activeAgents = 0;
  let totalDials = 0;
  let totalConnects = 0;
  let totalHotLeads = 0;

  for (const r of rows) {
    if (r.lastScoredAt) {
      const ts = new Date(r.lastScoredAt).getTime();
      if (now - ts <= ACTIVE_THRESHOLD_MS) activeAgents += 1;
    }
    totalDials += r.totalDials;
    totalConnects += r.totalConnects;
    totalHotLeads += r.hotCount;
  }

  // weightedConnectRate = sum(connects) / sum(dials), NOT mean of per-row rates.
  // This weights high-volume agents proportionally instead of letting a 1-dial
  // agent skew the team rate.
  const weightedConnectRate =
    totalDials > 0 ? totalConnects / totalDials : null;

  return {
    activeAgents,
    totalDials,
    totalConnects,
    weightedConnectRate,
    totalHotLeads,
  };
}

interface TileProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subLabel?: string;
}

const Tile: React.FC<TileProps> = ({ icon: Icon, label, value, subLabel }) => (
  <div className="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3 w-3" />
      <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
        {label}
      </span>
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-xl font-bold text-foreground leading-none">
        {value}
      </span>
      {subLabel && (
        <span className="text-[10px] text-muted-foreground">{subLabel}</span>
      )}
    </div>
  </div>
);

export const TeamSummaryCards: React.FC<TeamSummaryCardsProps> = ({ rows }) => {
  const totals = useMemo(() => computeTotals(rows), [rows]);
  const teamSize = rows.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Tile
        icon={Activity}
        label="Active Agents"
        value={`${totals.activeAgents}`}
        subLabel={`of ${teamSize}`}
      />
      <Tile
        icon={Phone}
        label="Total Dials"
        value={totals.totalDials.toLocaleString()}
        subLabel={`${totals.totalConnects.toLocaleString()} connects`}
      />
      <Tile
        icon={Target}
        label="Connect Rate"
        value={
          totals.weightedConnectRate != null
            ? `${(totals.weightedConnectRate * 100).toFixed(1)}%`
            : "—"
        }
        subLabel="weighted"
      />
      <Tile
        icon={Flame}
        label="Hot Leads"
        value={totals.totalHotLeads.toLocaleString()}
      />
    </div>
  );
};
