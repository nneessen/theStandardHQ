// src/features/social-cards/index.ts
// Public barrel for the social-graphics cards (Agent of the Week / leaderboard /
// monthly report) and their shared formatters. These are presentational components
// consumed by the Social Studio feature; importing through this root barrel keeps
// callers off banned deep paths (eslint no-restricted-imports).

export { AgentOfWeekCard, AOTW_COPY } from "./AgentOfWeekCard";
export type {
  AgentOfWeekCardProps,
  AowDesign,
  AowStyle,
} from "./AgentOfWeekCard";

export {
  NewAgentCard,
  WELCOME_COPY,
  type NewAgentCardProps,
  type WelcomeVariant,
} from "./NewAgentCard";
export {
  RecruitingCard,
  RECRUITING_COPY,
  type RecruitingCardProps,
  type RecruitingVariant,
} from "./RecruitingCard";
export { copyForVariant, type CopyField, type CopyMap } from "./templateCopy";

export { PhotoFrame, type PhotoFrameProps } from "./PhotoFrame";

export {
  LeaderboardSocialCard,
  LEADERBOARD_COPY,
} from "./LeaderboardSocialCard";
export type {
  LeaderboardSocialCardProps,
  SocialAgentRow,
} from "./LeaderboardSocialCard";

export { MonthlyReportCard, MONTHLY_COPY } from "./MonthlyReportCard";
export type { MonthlyReportCardProps, ReportStat } from "./MonthlyReportCard";

export { MarketingCard } from "./MarketingCard";
export type {
  MarketingCardProps,
  MarketingVariant,
  SlideListItem,
  SlideCompareColumn,
  SlideCompare,
} from "./MarketingCard";

export { usd, toLastInitial, initials, FORMAT_DIMS } from "./socialFormat";
export type { SocialFormat, CardPageInfo } from "./socialFormat";

export { renderCardToPng } from "./exportCard";

export {
  CARD_THEMES,
  CARD_THEME_LABEL,
  CARD_THEME_BLURB,
  CARD_THEME_TOKENS,
  resolveCardTheme,
  normalizeCardTheme,
  cardThemeWrapperClass,
  themePageBackground,
} from "./themes";
export type { CardTheme, CardThemeTokens } from "./themes";
