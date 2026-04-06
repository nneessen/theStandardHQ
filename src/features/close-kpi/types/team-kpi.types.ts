// src/features/close-kpi/types/team-kpi.types.ts
// Types for the Close KPIs Team monitoring tab.
// Mirrors the get_team_pipeline_snapshot RPC return shape (snake_case → camelCase).

export interface TeamPipelineRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  isSelf: boolean;
  hasCloseConfig: boolean;
  lastScoredAt: string | null;
  totalLeads: number;
  hotCount: number;
  warmingCount: number;
  neutralCount: number;
  coolingCount: number;
  coldCount: number;
  avgScore: number | null;
  totalDials: number;
  totalConnects: number;
  connectRate: number | null;
  staleLeadsCount: number;
  untouchedActive: number;
  noAnswerStreak: number;
  straightToVm: number;
  activeOppsCount: number;
  openOppValueUsd: number;
}

export type TeamPipelineSnapshot = TeamPipelineRow[];

// Computed client-side from rows for the summary strip.
// Active agents = rows whose lastScoredAt is within 90 minutes.
// weightedConnectRate = sum(connects) / sum(dials) — NOT mean of per-agent rates.
export interface TeamSummaryTotals {
  activeAgents: number;
  totalDials: number;
  totalConnects: number;
  weightedConnectRate: number | null;
  totalHotLeads: number;
}
