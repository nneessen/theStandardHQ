// src/features/social-studio/sampleData.ts
// Clearly-labeled SAMPLE preview data, shown only when an agency has no live
// metrics yet (the owner's current reality — agency just started). Never posted;
// the preview pane stamps a "SAMPLE PREVIEW" badge over it.

import {
  toLastInitial,
  type SocialAgentRow,
  type MonthlyReportCardProps,
  type AgentOfWeekCardProps,
} from "@/features/social-cards";

const ROSTER = [
  "Marcus Webb",
  "Alyssa Chen",
  "Priya Nair",
  "Jordan Mercer",
  "Devon Brooks",
  "Sofia Alvarez",
  "Tyrone Wallace",
  "Hannah Kim",
  "Liam O'Connor",
  "Grace Okafor",
  "Andre Foster",
  "Bianca Russo",
  "Caleb Nguyen",
  "Daniela Ortiz",
  "Elijah Park",
  "Farah Haddad",
  "Gavin Reyes",
  "Isla Bennett",
  "Jamal Carter",
  "Kayla Singh",
];

function build(ap: number[], pol: number[]): SocialAgentRow[] {
  return ROSTER.map((name, i) => ({
    rank: i + 1,
    name: toLastInitial(name),
    agency: null,
    ap: ap[i],
    policies: pol[i],
  }));
}

export const SAMPLE_DAILY = build(
  [
    14820, 12400, 11150, 9640, 8200, 7310, 6450, 5720, 4980, 3540, 3210, 2980,
    2760, 2540, 2310, 2090, 1870, 1640, 1420, 1180,
  ],
  [9, 8, 7, 6, 6, 5, 4, 4, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1],
);

export const SAMPLE_WEEKLY = build(
  [
    52400, 47900, 43200, 38600, 34100, 29800, 26400, 22900, 19500, 15200, 13800,
    12500, 11300, 10100, 9000, 7900, 6800, 5700, 4600, 3500,
  ],
  [31, 28, 25, 22, 20, 18, 15, 14, 11, 9, 8, 8, 7, 7, 6, 5, 5, 4, 3, 3],
);

export const SAMPLE_MONTHLY: Pick<
  MonthlyReportCardProps,
  "totalAp" | "stats" | "topPerformer" | "top" | "growthLabel"
> = {
  totalAp: 1284500,
  stats: [
    { label: "POLICIES", value: "642" },
    { label: "AGENTS", value: "18" },
    { label: "AVG AP / AGENT", value: "$71,361" },
  ],
  topPerformer: {
    name: toLastInitial("Marcus Webb"),
    ap: 184200,
    policies: 92,
  },
  top: [
    { rank: 1, name: toLastInitial("Marcus Webb"), ap: 184200 },
    { rank: 2, name: toLastInitial("Alyssa Chen"), ap: 156800 },
    { rank: 3, name: toLastInitial("Priya Nair"), ap: 142300 },
    { rank: 4, name: toLastInitial("Jordan Mercer"), ap: 128900 },
    { rank: 5, name: toLastInitial("Devon Brooks"), ap: 112400 },
  ],
  // No growthLabel: the live monthly path can't compute MoM growth yet, so the
  // sample must not promise a badge the real card will never show.
};

export const SAMPLE_TOTAL_DAILY = SAMPLE_DAILY.reduce((s, r) => s + r.ap, 0);
export const SAMPLE_TOTAL_WEEKLY = SAMPLE_WEEKLY.reduce((s, r) => s + r.ap, 0);

// Agent-of-the-Week sample = the weekly sample's #1 producer (one hero agent),
// so the placeholder stays consistent with the weekly leaderboard sample.
export const SAMPLE_AOTW: AgentOfWeekCardProps["agent"] = {
  name: SAMPLE_WEEKLY[0].name,
  ap: SAMPLE_WEEKLY[0].ap,
  policies: SAMPLE_WEEKLY[0].policies,
  photoUrl: null,
};
