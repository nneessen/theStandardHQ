import {
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  Flame,
  GraduationCap,
  Hash,
  Mail,
  Newspaper,
  ScrollText,
  ShieldAlert,
  UserPlus,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface AgentTheme {
  /** Human label shown in badges and banners. */
  label: string;
  /** Hex accent used to tint the HUD when this specialist is active. */
  accent: string;
  /** Icon representing the specialist. */
  icon: LucideIcon;
  /** Short flavor line shown in the "specialist online" banner. */
  tagline: string;
}

/** Default Jarvis cyan — used before any agent has been routed. */
export const DEFAULT_ACCENT = "#22d3ee";

/**
 * Visual identity for each of the 13 orchestrator specialists. Labels mirror the
 * AGENT_LABELS map the layout previously hard-coded. Accents are picked across the
 * Jarvis cyan→indigo→violet range with hazard colors for the risk specialists.
 */
export const AGENT_THEME: Record<string, AgentTheme> = {
  "executive-briefing": {
    label: "Executive Briefing",
    accent: "#22d3ee",
    icon: Newspaper,
    tagline: "Synthesizing your command brief",
  },
  "production-analyst": {
    label: "Production Analyst",
    accent: "#38bdf8",
    icon: BarChart3,
    tagline: "Crunching team production",
  },
  "policy-risk": {
    label: "Policy Risk",
    accent: "#f59e0b",
    icon: ShieldAlert,
    tagline: "Scanning the book for exposure",
  },
  "lead-priority": {
    label: "Lead Prioritization",
    accent: "#fb923c",
    icon: Flame,
    tagline: "Ranking your hottest leads",
  },
  crm: {
    label: "CRM",
    accent: "#818cf8",
    icon: Users,
    tagline: "Pulling client intelligence",
  },
  "sms-email-copy": {
    label: "SMS / Email Copy",
    accent: "#a78bfa",
    icon: Mail,
    tagline: "Drafting outbound copy",
  },
  compliance: {
    label: "Compliance",
    accent: "#2dd4bf",
    icon: ScrollText,
    tagline: "Checking the rulebook",
  },
  recruiting: {
    label: "Recruiting",
    accent: "#4ade80",
    icon: UserPlus,
    tagline: "Reviewing the pipeline",
  },
  coaching: {
    label: "Agent Coaching",
    accent: "#facc15",
    icon: GraduationCap,
    tagline: "Building your coaching plan",
  },
  calendar: {
    label: "Calendar",
    accent: "#60a5fa",
    icon: Calendar,
    tagline: "Reading your schedule",
  },
  slack: {
    label: "Slack",
    accent: "#c084fc",
    icon: Hash,
    tagline: "Working the channels",
  },
  workflow: {
    label: "Workflow Builder",
    accent: "#5eead4",
    icon: Workflow,
    tagline: "Assembling the workflow",
  },
  "data-quality": {
    label: "Data Quality",
    accent: "#34d399",
    icon: CheckCircle2,
    tagline: "Auditing your data",
  },
};

const FALLBACK: AgentTheme = {
  label: "Jarvis",
  accent: DEFAULT_ACCENT,
  icon: Brain,
  tagline: "Online and standing by",
};

export function agentTheme(agentKey?: string | null): AgentTheme {
  if (!agentKey) return FALLBACK;
  return AGENT_THEME[agentKey] ?? { ...FALLBACK, label: agentKey };
}
