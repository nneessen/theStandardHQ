import {
  BarChart3,
  Flame,
  LayoutDashboard,
  Mail,
  MessageSquare,
  ShieldAlert,
  UserPlus,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

interface ToolMeta {
  /** Friendly label shown on the choreographed tool chip. */
  label: string;
  icon: LucideIcon;
}

/** Maps the 8 orchestrator tools to a chip icon + readable label. */
const TOOL_META: Record<string, ToolMeta> = {
  getDailyBriefingData: { label: "Daily briefing", icon: LayoutDashboard },
  getTeamProductionSummary: { label: "Team production", icon: BarChart3 },
  getPolicyRiskAlerts: { label: "Policy risk", icon: ShieldAlert },
  getLeadPriorities: { label: "Lead priorities", icon: Flame },
  getRecruitingSnapshot: { label: "Recruiting", icon: UserPlus },
  getClientSnapshot: { label: "Clients", icon: Users },
  draftEmailMessage: { label: "Email draft", icon: Mail },
  draftSmsMessage: { label: "SMS draft", icon: MessageSquare },
};

export function toolMeta(name: string): ToolMeta {
  return TOOL_META[name] ?? { label: name, icon: Wrench };
}
