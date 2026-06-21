// src/features/social-cards/index.ts
// Public barrel for the social-graphics cards (Agent of the Week / leaderboard /
// monthly report) and their shared formatters. These are presentational components
// consumed by the Social Studio feature; importing through this root barrel keeps
// callers off banned deep paths (eslint no-restricted-imports).

export { AgentOfWeekCard } from "./AgentOfWeekCard";
export type {
  AgentOfWeekCardProps,
  AowDesign,
  AowStyle,
} from "./AgentOfWeekCard";

export { LeaderboardSocialCard } from "./LeaderboardSocialCard";
export type {
  LeaderboardSocialCardProps,
  SocialAgentRow,
} from "./LeaderboardSocialCard";

export { MonthlyReportCard } from "./MonthlyReportCard";
export type { MonthlyReportCardProps, ReportStat } from "./MonthlyReportCard";

export { usd, toLastInitial, initials, FORMAT_DIMS } from "./socialFormat";
export type { SocialFormat } from "./socialFormat";
