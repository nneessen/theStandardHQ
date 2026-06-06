/*
 * Static marketing content for the HQ landing page — adapted from the reference
 * (docs/todo/"The Standard HQ - Landing.html" inline <script>).
 *
 * IMPORTANT — NO TECH-STACK DISCLOSURE: vendor/product names (the CRM, the LLM
 * providers, the voice/billing/data/e-sign/OCR/hosting tools) are deliberately
 * NOT named anywhere on this public page. Copy describes WHAT the platform does,
 * never WHAT it is built on or HOW it is wired — the page must not hand a
 * competitor a blueprint to replicate the build. Keep it that way when editing.
 *
 * This is typed editorial content, NOT mock data: it's the canonical recruiting
 * copy for the page, the same pattern as data/platform-pillars.ts.
 */

import type { IconName } from "../lib/icons";

export interface StatItem {
  /** numeric target the count-up animates to */
  count: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

export const HERO_STATS: StatItem[] = [
  { count: 50, suffix: "+", label: "Capabilities Shipped" },
  { count: 7, label: "Platform Pillars" },
  { count: 4, label: "AI Features" },
  { count: 14, label: "Integrations" },
];

export const OPP_STATS: StatItem[] = [
  { count: 150000, prefix: "$", suffix: "+", label: "Average First Year" },
  { count: 7, suffix: "+", label: "Team Members" },
  { count: 49, label: "States Licensed" },
  { count: 100, suffix: "%", label: "Remote Work" },
];

export interface PillarItem {
  num: string;
  icon: IconName;
  category: string;
  title: string;
  desc: string;
}

export const PILLARS: PillarItem[] = [
  {
    num: "01",
    icon: "ai",
    category: "Sales & Lead Intelligence",
    title: "Stop dialing dead leads.",
    desc: "AI scores every lead 0–100 so you spend the day on the ones that close.",
  },
  {
    num: "02",
    icon: "chat",
    category: "Recruiting & Onboarding",
    title: "A recruiting pipeline that runs itself.",
    desc: "Drag-and-drop phases, interactive checklists, automated welcome sequences.",
  },
  {
    num: "03",
    icon: "bolt",
    category: "Training & Certification",
    title: "Training built like a video game.",
    desc: "XP, badges, streaks and team leaderboards. Quiz Builder for custom assessments.",
  },
  {
    num: "04",
    icon: "scan",
    category: "Underwriting & Carrier Tools",
    title: "Underwriting in 3 minutes, not 30.",
    desc: "Health intake to carrier recommendation with an AI underwriting wizard.",
  },
  {
    num: "05",
    icon: "card",
    category: "Commissions & Finance",
    title: "Commissions tracked. Spreadsheets gone.",
    desc: "Premiums in, commissions out — advances, chargebacks, persistency, overrides.",
  },
  {
    num: "06",
    icon: "db",
    category: "Dashboards & Reporting",
    title: "Know exactly where you stand.",
    desc: "Pace, commission, leaderboard and a live activity feed in one screen.",
  },
  {
    num: "07",
    icon: "mail",
    category: "Communications",
    title: "Every channel, one inbox.",
    desc: "Email, SMS, team chat and Instagram DMs orchestrated by trigger-based workflows.",
  },
];

export interface ToolkitItem {
  icon: IconName;
  title: string;
  badge: "LIVE" | "DEV";
  tag: string;
  desc: string;
}

export const TOOLKIT: ToolkitItem[] = [
  {
    icon: "ai",
    title: "Lead Heat Index",
    badge: "LIVE",
    tag: "Stop dialing dead leads.",
    desc: "Every lead scored 0–100 using 17 deterministic signals plus AI portfolio analysis. The Hot 100 is the only call list you need.",
  },
  {
    icon: "bolt",
    title: "AI Message Builder",
    badge: "LIVE",
    tag: "Generate emails, SMS, full sequences.",
    desc: "Tell the assistant what you want — a callback ask, a renewal nudge — and it writes the email, the SMS, or the whole sequence. Reply STOP enforced.",
  },
  {
    icon: "scan",
    title: "AI Underwriting Wizard",
    badge: "LIVE",
    tag: "Health intake to carrier in 3 min.",
    desc: "Walk a client through their medical history. AI classifies them into a health tier and tells you which carriers fit.",
  },
  {
    icon: "db",
    title: "Game Plan AI Coach",
    badge: "LIVE",
    tag: "Daily targets, carrier recs.",
    desc: "Your daily plan against target, with carrier and product recommendations based on what's converting right now.",
  },
];

/*
 * NOTE: the standalone "Stack/Difference" section was removed to cut redundancy
 * (it re-listed capabilities already covered by Pillars + Inventory, and after
 * the vendor-name scrub it no longer had a distinct purpose). Intentionally no
 * STACK export remains.
 */

export interface InventoryCategory {
  icon: IconName;
  title: string;
  items: string[];
}

export const INVENTORY: InventoryCategory[] = [
  {
    icon: "ai",
    title: "Sales & Lead Generation",
    items: [
      "Lead KPI Dashboard",
      "AI Lead Heat Index",
      "AI Hot 100",
      "Lead Heat Status Config",
      "AI Message Builder",
      "Lifecycle Velocity Analytics",
      "Speed-to-Lead Tracking",
      "Cadence Analysis",
      "Best-Time-to-Call",
    ],
  },
  {
    icon: "chat",
    title: "Recruiting & Onboarding",
    items: [
      "Drag-and-Drop Pipeline",
      "Interactive Checklists",
      "Branded Landing Pages",
      "Automated Onboarding",
      "Carrier Contracts & Writing Numbers",
      "Contract Document Storage",
      "Phase Automations",
      "Welcome Sequences",
    ],
  },
  {
    icon: "bolt",
    title: "Training & Certification",
    items: [
      "Gamified Training Modules",
      "Rich Content Block Editor",
      "Quiz Builder",
      "XP & Badges",
      "Team Leaderboards",
      "Adaptive Assessments",
      "Trainer Dashboard",
      "Certification Tracking",
    ],
  },
  {
    icon: "db",
    title: "Dashboards & Reporting",
    items: [
      "Main Dashboard",
      "Analytics Dashboard",
      "Game Plan AI Coach",
      "Reports Dashboard",
      "Hierarchy / Org Chart",
      "Team & Downline Reports",
      "Targets Module",
      "Daily Leaderboard Digest",
      "Custom Alert Rules",
      "Audit Trail",
    ],
  },
  {
    icon: "mail",
    title: "Communications & Messaging",
    items: [
      "Email Hub",
      "Email Template Builder",
      "Team Chat Integration",
      "Instagram DM Management",
      "Channel Orchestration Rules",
      "Workflows",
      "Marketing Hub",
      "Message Scheduling",
    ],
  },
  {
    icon: "doc",
    title: "Team, Documents & Legal",
    items: ["The Standard Team", "Documents", "Legal", "Settings"],
  },
  {
    icon: "scan",
    title: "Platform & Admin",
    items: [
      "Role-Based Access Control",
      "User Management",
      "Billing & Subscriptions",
      "Multi-Factor Auth",
      "Custom Domain & White-Label",
      "API Tokens",
      "Notification Rules",
    ],
  },
];

export interface PathStep {
  num: string;
  title: string;
  desc: string;
  supportTitle: string;
  supportDesc: string;
}

export const PATH: PathStep[] = [
  {
    num: "01",
    title: "Join",
    desc: "Apply and complete onboarding",
    supportTitle: "Branded application + e-sign",
    supportDesc:
      "Apply through a recruiter link, e-sign your contract, and finish guided onboarding checklists.",
  },
  {
    num: "02",
    title: "Train",
    desc: "Learn proven systems from top producers",
    supportTitle: "Gamified training modules",
    supportDesc:
      "XP for lessons, badges for streaks, team leaderboards. Quiz Builder for custom assessments.",
  },
  {
    num: "03",
    title: "Earn",
    desc: "Start building real income immediately",
    supportTitle: "AI Lead Heat + auto-commission engine",
    supportDesc:
      "Every lead scored 0–100. Premiums in, commissions out — advances, chargebacks, persistency handled.",
  },
  {
    num: "04",
    title: "Lead",
    desc: "Build and mentor your own team",
    supportTitle: "Recruiting pipeline + downline reports",
    supportDesc:
      "Your team on the same kanban you came in through. Branded pages, real-time override roll-ups.",
  },
];

export interface EarningCard {
  icon: IconName;
  title: string;
  desc: string;
}

export const EARNINGS: EarningCard[] = [
  {
    icon: "card",
    title: "Auto-Paid Commissions",
    desc: "Premium recorded → commission booked. No spreadsheets, no reconciliation calls. The contract rate matrix lives in the comp guide; the engine posts it.",
  },
  {
    icon: "cal",
    title: "Advance Schedules Tracked",
    desc: "Monthly, semi-annual, annual — the system knows when each piece earns out. See what's advanced, earned, and still subject to chargeback risk.",
  },
  {
    icon: "scan",
    title: "Persistency Calculated Daily",
    desc: "Percent of policies still in force across rolling 13-month windows. Know your true book health, not last quarter's snapshot.",
  },
  {
    icon: "bolt",
    title: "Override Roll-Ups Visible",
    desc: "Your downline production rolls up your hierarchy. Earn on what your team produces and watch the override line grow in real time.",
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    q: "Does The Standard provide all this software, or do I have to buy it?",
    a: "Everything is included. The platform was built by The Standard for The Standard. You don't pay separately for AI lead scoring, the AI message builder, the underwriting wizard, or the training modules. It's the operating system you log into when you join — period.",
  },
  {
    q: "What does the AI actually do for me, day to day?",
    a: "It scores every lead 0–100 so you know who to call, writes your emails and SMS sequences, recommends carriers from a health intake in 3 minutes, and coaches your daily game plan against your targets.",
  },
  {
    q: "Is my client data safe?",
    a: "Yes. Your data is encrypted, access is strictly role-based, and every sensitive operation is logged to a 90-day audit trail.",
  },
  {
    q: "What does it cost me to use the platform as an agent?",
    a: "The platform is included with your agreement. No per-seat SaaS fees, no add-on charges for the AI tooling.",
  },
];

export interface CompareRow {
  title: string;
  desc: string;
}

export const COMPARE_OLD: CompareRow[] = [
  {
    title: "Manual Lead Qualification",
    desc: "Cold-calling everyone in your CRM, hoping the next pickup is a closer. Hours wasted on stale leads.",
  },
  {
    title: "Spreadsheet Commissions",
    desc: "Manual Excel reconciliation every month. Advances, chargebacks, and persistency calculated wrong.",
  },
  {
    title: "Generic Email Templates",
    desc: "The same five templates everyone in your IMO uses. Reply rates suffer because clients have seen the exact message before.",
  },
];

export const COMPARE_NEW: CompareRow[] = [
  {
    title: "AI Lead Heat Scores · 0–100",
    desc: "17 deterministic signals plus AI portfolio analysis run continuously. The Hot 100 ranks who to call right now.",
  },
  {
    title: "Audited Commission Engine",
    desc: "Premiums in, commissions out. Advances, chargebacks, persistency, override roll-ups — all automatic, 90-day audit trail.",
  },
  {
    title: "AI Writes Every Send",
    desc: "Tell the assistant the ask — callback, renewal nudge, check-in — and it writes the email, SMS, or the whole sequence.",
  },
];

export interface JarvisCapability {
  icon: IconName;
  title: string;
  desc: string;
}

export const JARVIS_CAPABILITIES: JarvisCapability[] = [
  {
    icon: "ai",
    title: "Score every lead",
    desc: "Ranks your whole pipeline 0–100 and tells you who to call next.",
  },
  {
    icon: "mail",
    title: "Write every send",
    desc: "Emails, SMS, full sequences — in your voice, ready to fire.",
  },
  {
    icon: "cal",
    title: "Run your calendar",
    desc: "Books callbacks, sets reminders, never double-books a slot.",
  },
  {
    icon: "scan",
    title: "Draft underwriting",
    desc: "Health intake to carrier recommendation in three minutes.",
  },
  {
    icon: "db",
    title: "Build any report",
    desc: "Ask in plain English; get the numbers, charted and dated.",
  },
  {
    icon: "chat",
    title: "Recruit on autopilot",
    desc: "Drafts outreach, screens replies, moves candidates down the pipeline.",
  },
];

export const JARVIS_CHIPS: string[] = [
  "Score leads",
  "Write emails",
  "Book calls",
  "Draft UW",
  "Build reports",
  "Recruit",
];

export interface JarvisExchange {
  you: string;
  jarvis: string;
}

export const JARVIS_DEMO: JarvisExchange[] = [
  {
    you: "Jarvis, who should I call right now?",
    jarvis: "Pulling your Hot 100 — top 3 are warm. Dialing Carlos first.",
  },
  {
    you: "Write a renewal nudge for the Patel policy.",
    jarvis: "Drafted email + SMS in your voice. Want me to send?",
  },
  {
    you: "Build me a commission report for May.",
    jarvis: "Done — $8,420 booked, 2 chargebacks flagged for review.",
  },
  {
    you: "Book a callback with Rebecca tomorrow at 2pm.",
    jarvis: "On your calendar. Rebecca notified, reminder set.",
  },
];
