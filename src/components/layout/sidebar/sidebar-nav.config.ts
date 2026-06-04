// src/components/layout/sidebar/sidebar-nav.config.ts
// Declarative sidebar navigation config. No hook calls or access logic here.

import {
  Home,
  TrendingUp,
  Target,
  BarChart3,
  CreditCard,
  FileText,
  Users,
  UserPlus,
  Settings,
  Shield,
  ClipboardList,
  Mail,
  Workflow,
  ShieldCheck,
  Trophy,
  Wallet,
  Store,
  Megaphone,
  Briefcase,
  PhoneCall,
  Network,
  Sparkles,
  Zap,
  IdCard,
} from "lucide-react";
import { CloseCrmIcon } from "@/components/icons/CloseCrmIcon";
import { THE_STANDARD_AGENCY_ID } from "@/hooks/subscription";
import { NEW_SUBSCRIPTIONS_ENABLED } from "@/lib/subscription/subscription-availability";
import type { SidebarNavigationGroup, SidebarNavigationItem } from "./types";

export const footerSidebarItems: SidebarNavigationItem[] = [
  {
    icon: Wallet,
    label: "Billing",
    href: "/billing",
    public: true,
    // While self-serve sign-ups are disabled, only paid subscribers see Billing
    // (to manage/cancel). When re-enabled, it returns to all users.
    requiresPaidSubscription: !NEW_SUBSCRIPTIONS_ENABLED,
  },
  { icon: Settings, label: "Settings", href: "/settings", public: true },
];

export const regularSidebarGroups: SidebarNavigationGroup[] = [
  {
    id: "main",
    label: "Main",
    items: [
      {
        icon: Sparkles,
        label: "Command Center",
        href: "/command-center",
        public: true,
        // Limited to Epic Life during rollout (super-admins bypass). Mirrors the
        // command-center RouteGuard + the edge-function canAccessAssistant gate.
        requireEmailIncludes: "epiclife",
      },
      {
        icon: Home,
        label: "Dashboard",
        href: "/dashboard",
        permission: "nav.dashboard",
        subscriptionFeature: "dashboard",
      },
      {
        icon: TrendingUp,
        label: "Analytics",
        href: "/analytics",
        permission: "nav.dashboard",
        subscriptionFeature: "analytics",
      },
      {
        icon: Target,
        label: "Targets",
        href: "/targets",
        permission: "nav.dashboard",
        subscriptionFeature: "targets_basic",
      },
      {
        icon: BarChart3,
        label: "Reports",
        href: "/reports",
        permission: "nav.downline_reports",
        subscriptionFeature: "reports_view",
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      {
        icon: FileText,
        label: "Policies",
        href: "/policies",
        permission: "nav.policies",
      },
      {
        icon: CreditCard,
        label: "Expenses",
        href: "/expenses",
        permission: "expenses.read.own",
        subscriptionFeature: "expenses",
      },
      {
        icon: Users,
        label: "Team",
        href: "/hierarchy",
        permission: "nav.team_dashboard",
        subscriptionFeature: "hierarchy",
      },
      {
        icon: IdCard,
        label: "Licensing",
        href: "/the-standard-team",
        // `public` is required so the resolver returns the item at the
        // public branch; `requiresLicensingWorkspace` then gates it on the
        // licensing-workspace access check (7-day trial → Pro/Team).
        public: true,
        requiresLicensingWorkspace: true,
      },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      {
        icon: UserPlus,
        label: "Recruiting",
        href: "/recruiting",
        permission: "nav.recruiting_pipeline",
      },
      {
        icon: Trophy,
        label: "Leaderboard",
        href: "/leaderboard",
        subscriptionFeature: "leaderboard",
      },
      {
        icon: Store,
        label: "Lead Vendors",
        href: "/lead-vendors",
        public: true,
        superAdminOnly: true,
      },
      {
        icon: Megaphone,
        label: "Marketing",
        href: "/marketing",
        public: true,
        superAdminOnly: true,
      },
    ],
  },
  {
    id: "connect",
    label: "Connect",
    separatorAfter: true,
    items: [
      {
        icon: Mail,
        label: "Messages",
        href: "/messages",
        permission: "nav.messages",
        subscriptionFeature: "email",
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    separatorAfter: true,
    items: [
      {
        icon: ShieldCheck,
        label: "UW Wizard",
        href: "/underwriting/wizard",
        public: true,
        requiresUnderwritingEnabled: true,
      },
      {
        icon: Shield,
        label: "UW Admin",
        href: "/underwriting/admin",
        public: true,
        requiresUnderwritingManage: true,
      },
      {
        icon: CloseCrmIcon,
        label: "Chat Bot",
        href: "/chat-bot",
        public: true,
        allowedAgencyId: THE_STANDARD_AGENCY_ID,
      },
      {
        icon: PhoneCall,
        label: "AI Voice Agent",
        href: "/voice-agent",
        public: true,
        allowedAgencyId: THE_STANDARD_AGENCY_ID,
      },
      {
        icon: Network,
        label: "Orchestrator",
        href: "/channel-orchestration",
        public: true,
        allowedAgencyId: THE_STANDARD_AGENCY_ID,
      },
      {
        icon: CloseCrmIcon,
        label: "Close KPIs",
        href: "/close-kpi",
        subscriptionFeature: "close_kpi",
      },
      {
        icon: Sparkles,
        label: "AI Template Builder",
        href: "/close-ai-builder",
        subscriptionFeature: "close_ai_builder",
      },
      {
        icon: Zap,
        label: "Lead Drop",
        href: "/lead-drop",
        subscriptionFeature: "close_kpi",
      },
      {
        icon: Briefcase,
        label: "Business Tools",
        href: "/business-tools",
        public: true,
        allowedAgencyId: THE_STANDARD_AGENCY_ID,
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      {
        icon: Shield,
        label: "Admin",
        href: "/admin",
        permission: "nav.user_management",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        icon: Workflow,
        label: "Workflows",
        href: "/system/workflows",
        public: true,
        superAdminOnly: true,
      },
    ],
  },
];

export const staffSidebarGroups: SidebarNavigationGroup[] = [
  {
    id: "staff-main",
    label: "Main",
    items: [
      {
        icon: Home,
        label: "Dashboard",
        href: "/trainer-dashboard",
        public: true,
      },
      {
        icon: Trophy,
        label: "Leaderboard",
        href: "/leaderboard",
        subscriptionFeature: "leaderboard",
      },
    ],
  },
  {
    id: "staff-connect",
    label: "Connect",
    items: [
      {
        icon: Mail,
        label: "Messages",
        href: "/messages",
        public: true,
      },
    ],
  },
];

export const recruitSidebarGroups: SidebarNavigationGroup[] = [
  {
    id: "recruit",
    label: "Navigation",
    items: [
      {
        icon: ClipboardList,
        label: "My Progress",
        href: "/recruiting/my-pipeline",
        public: true,
      },
    ],
  },
];
