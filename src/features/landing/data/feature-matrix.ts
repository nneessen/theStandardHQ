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
  Shield,
} from "lucide-react";

export type FeatureRow = {
  name: string;
  benefit: string;
};

export type FeatureCategory = {
  id: string;
  icon: LucideIcon;
  title: string;
  features: FeatureRow[];
};

export const FEATURE_MATRIX: FeatureCategory[] = [
  {
    id: "sales-lead",
    icon: Sparkles,
    title: "Sales & Lead Generation",
    features: [
      {
        name: "Close KPI Dashboard",
        benefit: "Real-time sales analytics on top of your Close CRM data.",
      },
      {
        name: "AI Lead Heat Index",
        benefit:
          "Every lead scored 0–100 with 17 signals + AI portfolio analysis.",
      },
      {
        name: "AI Hot 100",
        benefit:
          "The only call list you need — your hottest 100 leads, ranked.",
      },
      {
        name: "Lead Heat Status Config",
        benefit:
          "Per-user status filtering with hybrid heuristic + DEFAULT DENY.",
      },
      {
        name: "Close AI Builder",
        benefit: "Generate Close emails, SMS, and full sequences with Claude.",
      },
      {
        name: "Close Lead Drop",
        benefit:
          "Bulk transfer leads between Close accounts with mapping and dedupe.",
      },
      {
        name: "Lifecycle Velocity Analytics",
        benefit:
          "See how fast leads move through (or get stuck in) each stage.",
      },
      {
        name: "Speed-to-Lead Tracking",
        benefit:
          "Measure time-to-first-touch and the conversion lift it produces.",
      },
      {
        name: "Cadence Analysis",
        benefit:
          "Identify the optimal interval between touches for your audience.",
      },
      {
        name: "Best-Time-to-Call",
        benefit: "Data-driven hour-of-day scoring per lead segment.",
      },
    ],
  },
  {
    id: "voice-phone",
    icon: Phone,
    title: "Voice & Phone",
    features: [
      {
        name: "Retell Voice Agent",
        benefit:
          "AI voice agent that answers inbound calls in your cloned voice.",
      },
      {
        name: "Voice Cloning",
        benefit: "Your AI sounds exactly like you — same tone, same pacing.",
      },
      {
        name: "Custom LLM Personality",
        benefit: "Define how your agent speaks, what to ask, when to escalate.",
      },
      {
        name: "Multi-Number Management",
        benefit:
          "Purchase, route, and manage multiple phone numbers per agent.",
      },
      {
        name: "Inbound Call Routing",
        benefit: "Skill, time-of-day, and availability-based routing.",
      },
      {
        name: "Outbound Calling",
        benefit:
          "AI-driven outbound calls with custom scripts and qualification logic.",
      },
      {
        name: "SMS Auto-Responder",
        benefit: "Conditional-logic SMS replies that capture leads to Close.",
      },
      {
        name: "Call Transcript Storage",
        benefit: "Searchable transcripts auto-attached to Close lead records.",
      },
      {
        name: "Business-Hours Voice Schedule",
        benefit: "Cloned voice during business hours, stock voice after-hours.",
      },
    ],
  },
  {
    id: "recruiting",
    icon: Users,
    title: "Recruiting & Onboarding",
    features: [
      {
        name: "Drag-and-Drop Pipeline",
        benefit: "Custom kanban phases for the recruiting funnel.",
      },
      {
        name: "Interactive Checklists",
        benefit: "Videos, quizzes, signatures, document uploads per phase.",
      },
      {
        name: "Branded Landing Pages",
        benefit: "Per-recruiter custom domain, theme, copy, and video embeds.",
      },
      {
        name: "Appointment Scheduling",
        benefit: "Calendar-synced booking embedded on landing pages.",
      },
      {
        name: "Document Collection",
        benefit: "DocuSeal-powered signature flows during onboarding.",
      },
      {
        name: "Phase-Transition Emails",
        benefit: "Automated emails fire when a recruit advances or stalls.",
      },
      {
        name: "Slack Recruit Alerts",
        benefit: "New recruits and phase changes posted to Slack channels.",
      },
      {
        name: "Appointment Request Forms",
        benefit: "Embedded forms on landing pages capture interested recruits.",
      },
    ],
  },
  {
    id: "training",
    icon: GraduationCap,
    title: "Training & Certification",
    features: [
      {
        name: "Gamified Training Modules",
        benefit:
          "XP, badges, streaks, leaderboards — training that actually gets done.",
      },
      {
        name: "Rich Content Block Editor",
        benefit: "Text, video, code, callouts, image galleries in any lesson.",
      },
      {
        name: "Quiz Builder",
        benefit:
          "Multi-question, multi-option quizzes with scoring and feedback.",
      },
      {
        name: "Training Hub",
        benefit:
          "Document browser with category filtering and role-based access.",
      },
      {
        name: "Agent Roadmap",
        benefit:
          "Customizable development roadmap with milestones and progress tracking.",
      },
      {
        name: "Daily Challenges",
        benefit: "Periodic challenges with point bonuses keep agents engaged.",
      },
      {
        name: "Completion Certificates",
        benefit: "Auto-generated certificates for finished modules.",
      },
      {
        name: "Trainer Dashboard",
        benefit: "Assign materials, track completions, manage content blocks.",
      },
    ],
  },
  {
    id: "underwriting",
    icon: Stethoscope,
    title: "Underwriting & Carrier Tools",
    features: [
      {
        name: "AI Underwriting Wizard",
        benefit:
          "Health intake → tier classification → carrier recommendation in 3 minutes.",
      },
      {
        name: "Underwriting Guides Library",
        benefit:
          "Upload carrier PDFs; PaddleOCR + Claude extract conditions and rates.",
      },
      {
        name: "Coverage Audit",
        benefit:
          "AI review of existing client policies for optimization opportunities.",
      },
      {
        name: "Carrier Acceptance Rules",
        benefit: "Dual rule engine: v1 quoting + v2 Coverage Builder.",
      },
      {
        name: "Health Condition Database",
        benefit:
          "Conditions and medications mapped to carrier-specific outcomes.",
      },
      {
        name: "Comp Guide Rate Matrix",
        benefit: "Carrier × product × contract-level commission lookup.",
      },
      {
        name: "Carrier Contracts & Writing Numbers",
        benefit: "Per-carrier appointments and writing-number management.",
      },
      {
        name: "Contract Document Storage",
        benefit: "Versioned storage in Supabase Storage with access controls.",
      },
    ],
  },
  {
    id: "commissions",
    icon: DollarSign,
    title: "Commissions & Finance",
    features: [
      {
        name: "Auto-Commission Calculation",
        benefit: "Premiums in, commissions out. No spreadsheets.",
      },
      {
        name: "Advance Tracking",
        benefit:
          "Monthly, semi-annual, and annual earning schedules tracked automatically.",
      },
      {
        name: "Chargeback Handling",
        benefit: "Policy lapse triggers proportional chargeback calculation.",
      },
      {
        name: "Persistency Calculations",
        benefit:
          "% of policies still in force across configurable time windows.",
      },
      {
        name: "Override Distribution",
        benefit: "Hierarchy roll-ups distribute overrides up your upline.",
      },
      {
        name: "Policy Management",
        benefit: "Intake, status workflow, batch import, CSV export.",
      },
      {
        name: "Expenses & Budget Tracking",
        benefit: "Category-level budget vs. actual with trend visualization.",
      },
      {
        name: "Business Tools (Paddle Parser)",
        benefit:
          "Financial statement analysis for agency underwriting decisions.",
      },
    ],
  },
  {
    id: "dashboards",
    icon: BarChart3,
    title: "Dashboards & Reporting",
    features: [
      {
        name: "Main Dashboard",
        benefit:
          "Pace, commission, leaderboard, activity feed — all in one view.",
      },
      {
        name: "Analytics Dashboard",
        benefit:
          "Trend charts, breakdowns by product / carrier / geo / client segment.",
      },
      {
        name: "Game Plan AI Coach",
        benefit: "Daily target tracking with carrier/product recommendations.",
      },
      {
        name: "Reports Dashboard",
        benefit:
          "Executive, agency, IMO, recruiting, team, downline templates.",
      },
      {
        name: "Hierarchy / Org Chart",
        benefit: "Drag-and-drop upline assignments and team structure.",
      },
      {
        name: "Team & Downline Reports",
        benefit: "Aggregate performance views for managers and uplines.",
      },
      {
        name: "Targets Module",
        benefit: "Monthly goal setting with daily pace tracking.",
      },
      {
        name: "Slack Daily Leaderboard",
        benefit:
          "Auto-posted leaderboard with reaction-based activity logging.",
      },
      {
        name: "Custom Alert Rules",
        benefit: "Pace warnings, inactivity flags, target shortfall alerts.",
      },
      {
        name: "Audit Trail",
        benefit: "90-day searchable activity log for sensitive operations.",
      },
    ],
  },
  {
    id: "comms",
    icon: MessageSquare,
    title: "Communications & Messaging",
    features: [
      {
        name: "Email Hub",
        benefit: "Compose, send, track email threads with Resend delivery.",
      },
      {
        name: "Email Template Builder",
        benefit: "Drag-and-drop blocks with variable substitution and preview.",
      },
      {
        name: "Slack Two-Way Integration",
        benefit: "Leaderboards post out, reactions come back as activity logs.",
      },
      {
        name: "Instagram DM Management",
        benefit: "Inbox, bulk send, scheduled DMs, template library.",
      },
      {
        name: "Channel Orchestration Rules",
        benefit: "Route inbound voice / SMS / chat by custom conditions.",
      },
      {
        name: "Workflows",
        benefit: "Trigger-based automation that fires across channels.",
      },
      {
        name: "Marketing Hub",
        benefit: "Campaign management surface for outbound initiatives.",
      },
      {
        name: "Message Scheduling",
        benefit: "Queue messages for future delivery with conflict detection.",
      },
    ],
  },
  {
    id: "team",
    icon: Users,
    title: "Team, Documents & Legal",
    features: [
      {
        name: "The Standard Team",
        benefit: "Public team showcase with bios, roles, and contact info.",
      },
      {
        name: "Documents",
        benefit: "Centralized document storage with role-based access.",
      },
      {
        name: "Legal",
        benefit: "Terms, privacy, compliance documents managed in-app.",
      },
      {
        name: "Settings",
        benefit:
          "Per-user preferences, notification rules, integration tokens.",
      },
    ],
  },
  {
    id: "platform",
    icon: Shield,
    title: "Platform & Admin",
    features: [
      {
        name: "Role-Based Access Control",
        benefit: "Granular permissions per feature and per data scope.",
      },
      {
        name: "User Management",
        benefit:
          "Invite, edit, role-assign, password reset, feature flag toggles.",
      },
      {
        name: "Stripe Billing",
        benefit:
          "Self-service portal, invoice history, voice add-on purchasing.",
      },
      {
        name: "Feature Flags",
        benefit: "Roll out experiments per user or org without redeploy.",
      },
      {
        name: "Multi-Factor Auth",
        benefit:
          "Supabase Auth with email verification, password reset, email change.",
      },
      {
        name: "Custom Domain & White-Label",
        benefit:
          "Recruiting landing pages on your own domain with your own brand.",
      },
      {
        name: "Public Landing Page Editor",
        benefit: "Self-edit hero copy, stats, testimonials, FAQ — no code.",
      },
      {
        name: "Admin Dashboard",
        benefit:
          "Single pane for users, roles, agencies, feature flags, system config.",
      },
    ],
  },
];

export const TOTAL_FEATURE_COUNT = FEATURE_MATRIX.reduce(
  (sum, cat) => sum + cat.features.length,
  0,
);
