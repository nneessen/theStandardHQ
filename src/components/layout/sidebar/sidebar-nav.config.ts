// src/components/layout/sidebar/sidebar-nav.config.ts
// Declarative sidebar navigation config. No hook calls or access logic here.

import {
  Home,
  TrendingUp,
  Target,
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
  Calculator,
  Trophy,
  Wallet,
  Store,
  Megaphone,
  GraduationCap,
  Headphones,
  PhoneCall,
  PhoneIncoming,
  Sparkles,
  IdCard,
  FileCheck,
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
        icon: FileCheck,
        label: "Contracting",
        href: "/contracting",
        // Open to every approved (non-recruit) agent: track your own carrier
        // contracting + eligibility alerts and file different-upline requests;
        // uplines manage their downline. (Route guard handles noRecruits.)
        public: true,
      },
      {
        icon: IdCard,
        label: "Licensing",
        href: "/the-standard-team",
        // Free for every agent: the hub's SureLC links + My Documents tabs are
        // always available. The paywall now lives ONLY on the Writing Numbers
        // tab (gated inside the tab via useLicensingWorkspaceAccess), so the nav
        // item itself is public and no longer requires workspace access.
        public: true,
      },
    ],
  },
  {
    id: "training",
    label: "Training",
    items: [
      {
        icon: GraduationCap,
        label: "Agent Roadmap",
        href: "/agent-roadmap",
        // The /agent-roadmap route auto-routes by role (admins → manage view,
        // agents → their checklist) and is RLS-scoped per agency/IMO, so a
        // single item is correct for everyone. Visible to all agents.
        public: true,
      },
      {
        icon: Headphones,
        label: "Call Reviews",
        href: "/call-reviews",
        // All-agents shared training library of live call recordings (diarized
        // transcript + AI analysis + markers). Open to every approved agent;
        // recruits are excluded at the route. Data is IMO-scoped via RLS.
        public: true,
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
        // Always-on for every approved agent (recruits are excluded at the
        // route via noRecruits). Previously gated by the paid "leaderboard"
        // subscription feature; made universal so all agents see it regardless
        // of billing. Leaderboard data is IMO-scoped via RLS.
        public: true,
      },
      {
        icon: Store,
        label: "Lead Vendors",
        href: "/lead-vendors",
        public: true,
        // Restricted to the two IMO-owner accounts only. NOTE: `allowedEmails`
        // has no super-admin bypass in the resolver, so ONLY these exact
        // accounts see the nav item (kept in sync with the route guard).
        allowedEmails: [
          "nickneessen@thestandardhq.com",
          "epiclife.neessen@gmail.com",
        ],
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
        icon: Calculator,
        label: "Quick Quote",
        href: "/underwriting/quick-quote",
        public: true,
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
        icon: CloseCrmIcon,
        label: "Close KPIs",
        href: "/close-kpi",
        subscriptionFeature: "close_kpi",
      },
      {
        icon: PhoneIncoming,
        label: "Call KPIs",
        href: "/kpi",
        // Limited to Epic Life during rollout (super-admins bypass). Mirrors the
        // /kpi RouteGuard requireEmailIncludes gate.
        public: true,
        requireEmailIncludes: "epiclife",
      },
      {
        icon: Sparkles,
        label: "AI Template Builder",
        href: "/close-ai-builder",
        subscriptionFeature: "close_ai_builder",
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
        // Always-on (see regularSidebarGroups Leaderboard note). Staff roles
        // already bypassed the subscription gate; kept public for consistency.
        public: true,
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
