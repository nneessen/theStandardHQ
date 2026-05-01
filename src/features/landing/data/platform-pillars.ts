import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Phone,
  Users,
  GraduationCap,
  Stethoscope,
  DollarSign,
  BarChart3,
  MessageSquare,
} from "lucide-react";

export type PlatformPillar = {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  tagline: string;
  body: string;
  features: string[];
};

export const PLATFORM_PILLARS: PlatformPillar[] = [
  {
    id: "sales-lead-intel",
    icon: Sparkles,
    eyebrow: "Sales & Lead Intelligence",
    title: "Stop dialing dead leads.",
    tagline:
      "AI scores every lead so you spend your day on the ones that close.",
    body: "The Close KPI dashboard cross-references every lead in your pipeline against 17 deterministic signals plus AI portfolio analysis from Claude. The result: a 0–100 heat score that tells you exactly who to call next, and who to ignore.",
    features: [
      "Close KPI dashboard with lifecycle velocity tracking",
      "AI Lead Heat Index — 17 deterministic signals + Haiku batch + Sonnet on-demand",
      "AI Hot 100 with per-user status filtering (Lead Heat Status Config)",
      "Close AI Builder — generate emails, SMS, and sequences with Claude",
      "Close Lead Drop — bulk transfer leads between Close accounts",
      "Speed-to-lead and cadence analytics",
      "Smart-view × spam-status cross-reference",
      "Best time of day to call analysis",
    ],
  },
  {
    id: "voice-phone",
    icon: Phone,
    eyebrow: "AI Voice & Phone",
    title: "An AI agent that answers your phone.",
    tagline:
      "Cloned voice. Custom personality. Live Close CRM writeback. You sleep, it sells.",
    body: "Powered by Retell. Your AI voice agent answers inbound calls in your cloned voice, qualifies the lead with a personality you control, and writes everything back to Close in real time. Manage multiple phone numbers, route by skill or time of day, and never miss another inbound.",
    features: [
      "Retell voice agent with custom LLM personality",
      "Voice cloning — your AI sounds exactly like you",
      "Inbound and outbound call routing",
      "Multi-number management with per-number rules",
      "SMS auto-responder with conditional logic",
      "Call transcript storage and full-text search",
      "Business-hours voice schedule (cloned vs. stock voice)",
      "Close CRM lead capture and custom field writeback",
    ],
  },
  {
    id: "recruiting",
    icon: Users,
    eyebrow: "Recruiting & Onboarding",
    title: "A recruiting pipeline that runs itself.",
    tagline:
      "Drag-and-drop kanban, interactive checklists, branded landing pages.",
    body: "Build downline. Custom recruiting pipelines with drag-and-drop phases, interactive checklists (videos, quizzes, signatures, document uploads), and per-recruiter branded landing pages with custom domains. Phase transitions trigger automated emails. Appointments sync to your calendar.",
    features: [
      "Drag-and-drop recruiting pipeline with custom phases",
      "Interactive checklists: videos, quizzes, signatures, document uploads",
      "Per-recruiter branded landing pages with custom domains",
      "Appointment scheduling with calendar sync",
      "Document collection with DocuSeal integration",
      "Automated phase-transition emails",
      "Slack alerts on new recruits and phase changes",
      "Appointment request forms embedded on landing pages",
    ],
  },
  {
    id: "training",
    icon: GraduationCap,
    eyebrow: "Training & Certification",
    title: "Training built like a video game.",
    tagline:
      "XP, badges, streaks, leaderboards, daily challenges. Agents actually finish it.",
    body: "Most agency training is a checkbox. Ours has skin in the game. Earn XP for completing modules, unlock badges for streaks, climb the leaderboard, and tackle daily challenges. Rich content blocks let trainers build interactive lessons with text, video, code, callouts, and image galleries.",
    features: [
      "Gamified training modules with XP, badges, streaks, leaderboards",
      "Rich content block editor: text, video, code, callouts, galleries",
      "Quiz Builder with multi-question, multi-option, scoring rules",
      "Training Hub document browser with category filtering",
      "Agent Roadmap with milestones and progress tracking",
      "Daily Challenges with periodic refresh",
      "Completion certificates",
      "Trainer dashboard with assignment and progress tools",
    ],
  },
  {
    id: "underwriting",
    icon: Stethoscope,
    eyebrow: "Underwriting & Carrier Tools",
    title: "Underwriting in 3 minutes, not 30.",
    tagline:
      "AI walks the client through health intake and recommends the right carrier.",
    body: "Stop guessing on health rate classes. Our AI Underwriting Wizard walks a client through their medical history with smart follow-up questions, classifies them into a health tier, and recommends the carrier and rate table most likely to approve them. Carrier underwriting guides are auto-extracted from PDFs by PaddleOCR + Claude.",
    features: [
      "AI Underwriting Wizard with multi-step health intake",
      "AI health tier classification (standard, moderate, substandard)",
      "Carrier-specific recommendations with rate-table lookup",
      "Underwriting Guides Library with PDF auto-extraction (PaddleOCR + Claude)",
      "Coverage Audit — AI review of existing client policies",
      "Carrier Acceptance Rules engine (v1 quoting + v2 Coverage Builder)",
      "Health condition database with medication tracking",
      "Comp Guide rate matrix — carrier × product × contract level",
    ],
  },
  {
    id: "commissions",
    icon: DollarSign,
    eyebrow: "Commissions & Finance",
    title: "Commissions tracked. Spreadsheets gone.",
    tagline:
      "Auto-calculation, advance tracking, chargebacks, persistency, override distribution.",
    body: "Your policies feed the system. The system computes everything. Commissions are calculated automatically from your contract rates and policy premiums. Advances are tracked through their earning schedules. Chargebacks are handled when policies lapse. Override commissions roll up through your hierarchy.",
    features: [
      "Auto-commission calculation from policy premiums and contract rates",
      "Advance tracking with monthly, semi-annual, and annual schedules",
      "Chargeback handling for policy lapses",
      "Persistency calculations across time windows",
      "Hierarchy override distribution (upline + downline)",
      "Policy management: intake, status workflow, batch import/export",
      "Expenses & Budget tracking with category trends",
      "Business Tools — Paddle Parser financial statement analysis",
    ],
  },
  {
    id: "dashboards",
    icon: BarChart3,
    eyebrow: "Dashboards & Reporting",
    title: "Know exactly where you stand.",
    tagline:
      "Real-time KPIs, AI Game Plan coaching, downline reports, Slack-integrated leaderboards.",
    body: "Your dashboard shows pace toward target, monthly commission, leaderboard position, and an activity feed. The Analytics dashboard goes deeper with trend charts, product / carrier / geographic breakdowns, and predictive earnings forecasting. The Game Plan AI coaches you on which carrier and product to focus on this week.",
    features: [
      "Main Dashboard — pace ring, commission widget, leaderboard, activity feed",
      "Analytics Dashboard — trend charts, product / carrier / geo / client-segment breakdowns",
      "Game Plan AI — daily target tracking and actionable carrier/product recommendations",
      "Reports Dashboard — executive, agency, IMO, recruiting, team, downline templates",
      "Hierarchy / Org Chart with drag-and-drop upline assignments",
      "Team Dashboard with downline performance roll-up",
      "Slack-integrated daily leaderboard with reaction-based logging",
      "Custom alert rules: pace warnings, inactivity flags, target shortfalls",
      "Targets module with monthly goal setting and progress tracking",
      "Audit Trail — 90-day searchable activity history",
    ],
  },
  {
    id: "comms",
    icon: MessageSquare,
    eyebrow: "Communications & Messaging",
    title: "Every channel. One inbox. Templates everywhere.",
    tagline:
      "Email, SMS, Instagram DM, Slack — all orchestrated, all templated, all tracked.",
    body: "The Email Hub composes, sends, and tracks email threads with Resend delivery. Slack is fully two-way — daily leaderboards post automatically, agents react to confirm activity, and policy updates stream to channels. Instagram DM management lets you bulk-send and schedule. The orchestration rules engine routes every inbound by your custom logic.",
    features: [
      "Email Hub with template builder and Resend delivery",
      "HTML email generator with preview and variable substitution",
      "Slack 2-way integration: daily leaderboards, policy alerts, reaction logging",
      "Instagram DM inbox, bulk messaging, scheduled DMs, templates",
      "Channel Orchestration rules engine (voice + SMS + chat routing)",
      "Workflows — trigger-based automation across channels",
      "Marketing Hub for campaign management",
      "Message scheduling with queue management",
    ],
  },
];
