// src/components/layout/Sidebar.tsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
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
  LogOut,
  Menu,
  ChevronLeft,
  ChevronDown,
  X,
  Shield,
  ClipboardList,
  GraduationCap,
  Lock,
  Mail,
  FileCheck,
  Workflow,
  ShieldCheck,
  Calculator,
  Trophy,
  Wallet,
  Store,
  LifeBuoy,
  Megaphone,
  Briefcase,
  PhoneCall,
  Network,
  Sparkles,
} from "lucide-react";
import { CloseCrmIcon } from "@/components/icons/CloseCrmIcon";
import { SupportDialog } from "./SupportDialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePermissionCheck, useUserRoles } from "@/hooks/permissions";
import { useAuthorizationStatus } from "@/hooks/admin";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSubscription,
  type FeatureKey,
  useOwnerDownlineAccess,
  isOwnerDownlineGrantedFeature,
  THE_STANDARD_AGENCY_ID,
} from "@/hooks/subscription";
import type { PermissionCode } from "@/types/permissions.types";
import type { RoleName } from "@/types/permissions.types";
import { NotificationDropdown } from "@/components/notifications";
import { toast } from "sonner";
import { useImo } from "@/contexts/ImoContext";
import { useTemporaryAccessCheck } from "@/hooks/subscription";
import { useUnderwritingFeatureFlag } from "@/features/underwriting";
import { useLicensingWorkspaceAccess } from "@/features/the-standard-team";

// ─── Types ───────────────────────────────────────────────────────

interface NavigationItem {
  icon: React.ElementType;
  label: string;
  href: string;
  permission?: PermissionCode;
  public?: boolean;
  subscriptionFeature?: FeatureKey;
  subscriptionFeatures?: FeatureKey[];
  superAdminOnly?: boolean;
  allowedEmails?: string[];
  allowedAgencyId?: string;
}

interface NavigationActionItem {
  icon: React.ElementType;
  label: string;
  type: "action";
  onClick?: () => void;
  colorClass?: string;
  permission?: PermissionCode;
  subscriptionFeature?: FeatureKey;
  subscriptionFeatures?: FeatureKey[];
  superAdminOnly?: boolean;
  allowedEmails?: string[];
  allowedAgencyId?: string;
  public?: boolean;
}

type NavItem = NavigationItem | NavigationActionItem;

interface NavigationGroup {
  id: string;
  label: string;
  items: NavItem[];
  defaultCollapsed?: boolean;
  separatorAfter?: boolean;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
}

// ─── Static data ─────────────────────────────────────────────────

const footerNavItems: NavigationItem[] = [
  { icon: Wallet, label: "Billing", href: "/billing", public: true },
  { icon: Settings, label: "Settings", href: "/settings", public: true },
];

// ─── Component ───────────────────────────────────────────────────

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  userName = "Nick Neessen",
  userEmail = "nickneessen@thestandardhq.com",
  onLogout,
}: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const { can, isLoading } = usePermissionCheck();
  const { isPending, isLoading: _authStatusLoading } = useAuthorizationStatus();
  const { supabaseUser } = useAuth();
  const {
    subscription,
    isLoading: subLoading,
    isActive: isSubscriptionActive,
  } = useSubscription();
  const { isDirectDownlineOfOwner, isLoading: downlineLoading } =
    useOwnerDownlineAccess();
  const { data: userRoles } = useUserRoles();
  const { imo, agency, loading: imoLoading, error: imoError } = useImo();
  const { isEnabled: isUnderwritingEnabled, isLoading: isUnderwritingLoading } =
    useUnderwritingFeatureFlag();
  const { shouldGrantTemporaryAccess, isLoading: tempAccessLoading } =
    useTemporaryAccessCheck();
  const licensingWorkspaceAccess = useLicensingWorkspaceAccess();
  const location = useLocation();

  // Section collapse state persisted to localStorage
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem("sidebar-sections");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleSection = (groupId: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      localStorage.setItem("sidebar-sections", JSON.stringify(next));
      return next;
    });
  };

  // ─── Auth / permission helpers ───────────────────────────────

  const ADMIN_EMAILS = ["nickneessen@thestandardhq.com"];
  const isAdmin =
    supabaseUser?.email && ADMIN_EMAILS.includes(supabaseUser.email);

  const SUPER_ADMIN_EMAIL = "nickneessen@thestandardhq.com";
  const isSuperAdmin =
    supabaseUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const hasFeature = (feature: FeatureKey | undefined): boolean => {
    if (!feature) return true;
    if (isAdmin) return true;
    if (subLoading || downlineLoading || tempAccessLoading) return false;
    const features = subscription?.plan?.features;
    if (isSubscriptionActive && features?.[feature]) return true;
    if (isDirectDownlineOfOwner && isOwnerDownlineGrantedFeature(feature))
      return true;
    if (shouldGrantTemporaryAccess(feature, supabaseUser?.email)) return true;
    return false;
  };

  const hasRole = (role: RoleName) => userRoles?.includes(role) || false;
  const isRecruit = hasRole("recruit" as RoleName);
  const isTrainerOnly =
    !isSuperAdmin &&
    (hasRole("trainer" as RoleName) ||
      hasRole("contracting_manager" as RoleName)) &&
    !hasRole("agent" as RoleName) &&
    !hasRole("admin" as RoleName);

  const currentUserEmail = supabaseUser?.email?.toLowerCase();
  const isEmailAllowed = (allowedEmails?: string[]) => {
    if (!allowedEmails || allowedEmails.length === 0) return true;
    if (!currentUserEmail) return false;
    return allowedEmails.some(
      (email) => email.toLowerCase() === currentUserEmail,
    );
  };
  const isAgencyAllowed = (allowedAgencyId?: string) => {
    if (!allowedAgencyId) return true;
    if (isSuperAdmin) return true;
    return agency?.id === allowedAgencyId;
  };

  // ─── Navigation group definitions ────────────────────────────

  const regularGroups: NavigationGroup[] = [
    {
      id: "main",
      label: "Main",
      items: [
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
          icon: Users,
          label: "Licensing/Writing #'s",
          href: "/the-standard-team",
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
        // UW Wizard — gated behind underwriting feature flag
        ...(!isUnderwritingLoading && isUnderwritingEnabled
          ? [
              {
                icon: ShieldCheck,
                label: "UW Wizard",
                href: "/underwriting/wizard",
                public: true,
              } as NavItem,
            ]
          : []),
        // Quick Quote — free for all users
        {
          icon: Calculator,
          label: "Quick Quote",
          href: "/underwriting/quick-quote",
          public: true,
        },
        // Chat Bot — restricted to The Standard agency
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
        // Close KPIs — gated by close_kpi feature flag.
        // All plan-tier flags are false (see migration
        // 20260407200329_restrict_close_kpi_to_owner_team.sql), so the only
        // paths to access are (1) isAdmin short-circuit for Nick, and
        // (2) isDirectDownlineOfOwner + OWNER_DOWNLINE_GRANTED_FEATURES for
        // agents in Nick's downline hierarchy — both handled inside hasFeature().
        {
          icon: CloseCrmIcon,
          label: "Close KPIs",
          href: "/close-kpi",
          subscriptionFeature: "close_kpi",
        },
        // AI Template Builder — gated by close_ai_builder feature flag
        // (Team plan + Nick's downlines via OWNER_DOWNLINE_GRANTED_FEATURES)
        {
          icon: Sparkles,
          label: "AI Template Builder",
          href: "/close-ai-builder",
          subscriptionFeature: "close_ai_builder",
        },
        // Business Tools — restricted to The Standard agency
        {
          icon: Briefcase,
          label: "Business Tools",
          href: "/business-tools",
          public: true,
          allowedAgencyId: THE_STANDARD_AGENCY_ID,
        },
      ] as NavItem[],
    },
    {
      id: "training",
      label: "Training",
      items: [
        {
          icon: GraduationCap,
          label: "My Training",
          href: "/my-training",
          subscriptionFeature: "training",
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

  const staffGroups: NavigationGroup[] = [
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
      id: "staff-work",
      label: "Work",
      items: [
        {
          icon: GraduationCap,
          label: "Training Hub",
          href: "/training-hub",
          public: true,
        },
        {
          icon: UserPlus,
          label: "Recruiting",
          href: "/recruiting",
          public: true,
        },
        {
          icon: FileCheck,
          label: "Contracting",
          href: "/contracting",
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

  const recruitGroups: NavigationGroup[] = [
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

  // ─── Item filtering ──────────────────────────────────────────

  const filterRegularItem = (item: NavItem): boolean => {
    // Super-admin only check applies regardless of pending status
    if ("superAdminOnly" in item && item.superAdminOnly && !isSuperAdmin)
      return false;

    // Agency/email restrictions apply regardless of pending status
    // (team-restricted items should be hidden from users outside the team)
    const itemAsNav = item as NavigationItem;
    if (
      itemAsNav.allowedAgencyId &&
      !isAgencyAllowed(itemAsNav.allowedAgencyId)
    )
      return false;
    if (itemAsNav.allowedEmails && !isEmailAllowed(itemAsNav.allowedEmails))
      return false;

    // Licensing/Writing workspace is premium after a 7-day free trial,
    // but the free carrier contract toggles remain in Settings > Profile.
    if ("href" in item && item.href === "/the-standard-team") {
      if (licensingWorkspaceAccess.isLoading) return true;
      if (!licensingWorkspaceAccess.hasAccess) return false;
    }

    // Pending users see remaining items (rendered as locked)
    if (isPending) return true;

    // Action items
    if ("type" in item && item.type === "action") {
      const actionItem = item as NavigationActionItem;
      if (actionItem.allowedEmails && !isEmailAllowed(actionItem.allowedEmails))
        return false;
      if (actionItem.permission) {
        if (isLoading) return false;
        if (!can(actionItem.permission)) return false;
      }
      return true;
    }

    // Link items
    const navItem = item as NavigationItem;
    if (navItem.public) return true;
    // Items need at least one access gate; if none, hide by default
    if (
      !navItem.permission &&
      !navItem.subscriptionFeature &&
      !navItem.subscriptionFeatures
    )
      return false;
    if (isLoading) return false;
    // Permission gate (if present)
    if (navItem.permission && !can(navItem.permission)) return false;
    // Subscription feature gate (if present)
    if (navItem.subscriptionFeature && !hasFeature(navItem.subscriptionFeature))
      return false;
    if (
      navItem.subscriptionFeatures &&
      !navItem.subscriptionFeatures.some((f) => hasFeature(f))
    )
      return false;
    return true;
  };

  const filterStaffItem = (item: NavItem): boolean => {
    if ("type" in item && item.type === "action") return false;
    const navItem = item as NavigationItem;
    if (navItem.public) return true;
    if (navItem.allowedEmails) return isEmailAllowed(navItem.allowedEmails);
    // Items need at least one access gate; if none, hide by default
    if (
      !navItem.permission &&
      !navItem.subscriptionFeature &&
      !navItem.subscriptionFeatures
    )
      return false;
    if (isLoading) return false;
    // Permission gate (if present)
    if (navItem.permission && !can(navItem.permission)) return false;
    // Subscription feature gate (if present)
    if (navItem.subscriptionFeature && !hasFeature(navItem.subscriptionFeature))
      return false;
    if (
      navItem.subscriptionFeatures &&
      !navItem.subscriptionFeatures.some((f) => hasFeature(f))
    )
      return false;
    return true;
  };

  // Build visible groups based on user type
  const sourceGroups = isRecruit
    ? recruitGroups
    : isTrainerOnly
      ? staffGroups
      : regularGroups;

  const filterFn = isRecruit
    ? () => true
    : isTrainerOnly
      ? filterStaffItem
      : filterRegularItem;

  const visibleGroups = sourceGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(filterFn),
    }))
    .filter((group) => group.items.length > 0);

  // ─── Auto-expand active section on route change ──────────────

  useEffect(() => {
    for (const group of visibleGroups) {
      const hasActiveRoute = group.items.some(
        (item) =>
          "href" in item &&
          location.pathname.startsWith((item as NavigationItem).href),
      );
      if (hasActiveRoute && collapsedSections[group.id]) {
        setCollapsedSections((prev) => {
          const next = { ...prev };
          delete next[group.id];
          localStorage.setItem("sidebar-sections", JSON.stringify(next));
          return next;
        });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ─── Mobile handling ─────────────────────────────────────────

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setIsMobileOpen(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);
  const closeMobile = () => setIsMobileOpen(false);

  const handleLockedNavClick = () => {
    toast.error(
      "Your account is pending approval. Please wait for administrator approval to access this feature.",
    );
  };

  // ─── Render helper ───────────────────────────────────────────

  const renderNavItem = (item: NavItem, key: string) => {
    const Icon = item.icon;
    const isAction = "type" in item && item.type === "action";
    const isLocked = isPending && !item.public && !isAction;

    // ── Locked item (pending users) ──
    if (isLocked) {
      const lockedEl = (
        <div
          className={cn(
            "relative flex items-center h-9 rounded-md cursor-not-allowed opacity-50 mb-0.5",
            isCollapsed ? "w-9 justify-center mx-auto" : "w-full gap-2.5 px-3",
          )}
          onClick={handleLockedNavClick}
        >
          <Icon size={16} className="text-muted-foreground flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-sm blur-[0.5px] text-muted-foreground truncate">
              {item.label}
            </span>
          )}
          <Lock
            size={10}
            className={cn(
              "absolute text-muted-foreground/70",
              isCollapsed
                ? "bottom-0.5 right-0.5"
                : "right-2 top-1/2 -translate-y-1/2",
            )}
          />
        </div>
      );

      if (isCollapsed) {
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <div>{lockedEl}</div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label} (Locked)
            </TooltipContent>
          </Tooltip>
        );
      }
      return <React.Fragment key={key}>{lockedEl}</React.Fragment>;
    }

    // ── Action item (UW Wizard, Quick Quote) ──
    if (isAction) {
      const actionItem = item as NavigationActionItem;
      const actionEl = (
        <button
          className={cn(
            "relative flex items-center h-9 rounded-md text-sm transition-colors mb-0.5",
            isCollapsed ? "w-9 justify-center mx-auto" : "w-full gap-2.5 px-3",
            actionItem.colorClass || "text-muted-foreground",
            "hover:bg-accent/40",
          )}
          onClick={() => {
            actionItem.onClick?.();
            if (isMobile) closeMobile();
          }}
        >
          <Icon size={16} className="flex-shrink-0" />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </button>
      );

      if (isCollapsed) {
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <div>{actionEl}</div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      }
      return <React.Fragment key={key}>{actionEl}</React.Fragment>;
    }

    // ── Regular link item ──
    const navItem = item as NavigationItem;
    const linkEl = (
      <Link
        to={navItem.href}
        onClick={() => {
          if (isMobile) closeMobile();
        }}
      >
        {({ isActive }) => (
          <div
            className={cn(
              "relative flex items-center h-9 rounded-md text-sm transition-colors mb-0.5",
              isCollapsed
                ? "w-9 justify-center mx-auto"
                : "w-full gap-2.5 px-3",
              isActive
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/70",
            )}
            data-active={isActive}
          >
            {isActive && (
              <span className="absolute left-0 top-0.5 bottom-0.5 w-1 rounded-full bg-info" />
            )}
            <Icon
              size={16}
              className={cn("flex-shrink-0", isActive && "text-info")}
            />
            {!isCollapsed && <span className="truncate">{navItem.label}</span>}
          </div>
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <div>{linkEl}</div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {navItem.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return <React.Fragment key={key}>{linkEl}</React.Fragment>;
  };

  // ─── JSX ─────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <Button
          variant="secondary"
          size="icon"
          className="fixed top-3 left-3 z-[101] h-9 w-9"
          onClick={toggleMobile}
        >
          <Menu size={18} />
        </Button>
      )}

      {/* Mobile Overlay */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 bg-background/90 backdrop-blur-sm z-[99] transition-all duration-300",
            isMobileOpen ? "opacity-100 visible" : "opacity-0 invisible",
          )}
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-[100] transition-all duration-200",
          isCollapsed ? "w-[72px]" : "w-[220px]",
          isMobile && (isMobileOpen ? "translate-x-0" : "-translate-x-full"),
          isMobile && !isCollapsed && "w-[280px]",
        )}
      >
        {/* Header */}
        <div className="p-3 border-b border-border bg-card/80">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-secondary text-secondary-foreground rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 border border-border shadow-sm">
                  {userName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground truncate tracking-tight">
                    {userName}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {userEmail}
                  </div>
                  {imoLoading ? (
                    <div className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
                      Loading...
                    </div>
                  ) : imoError ? (
                    <div className="text-[10px] text-red-400/70 truncate mt-0.5">
                      Organization unavailable
                    </div>
                  ) : imo || agency ? (
                    <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5 flex items-center gap-1">
                      {imo && (
                        <span
                          className="font-medium"
                          style={{
                            color: imo.primary_color || undefined,
                          }}
                        >
                          {imo.code}
                        </span>
                      )}
                      {imo && agency && (
                        <span className="opacity-50">&bull;</span>
                      )}
                      {agency && <span>{agency.code}</span>}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isRecruit && <NotificationDropdown isCollapsed={false} />}
                {isMobile ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={closeMobile}
                  >
                    <X size={16} />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onToggleCollapse}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleCollapse}
              >
                <Menu size={16} />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <TooltipProvider delayDuration={0}>
          <nav className="sidebar-nav flex-1 p-2 overflow-y-auto">
            {/* Notification bell at top when collapsed */}
            {isCollapsed && !isRecruit && (
              <div className="flex justify-center mb-1">
                <NotificationDropdown isCollapsed={true} />
              </div>
            )}

            {/* Navigation Groups */}
            {visibleGroups.map((group, groupIdx) => {
              const isSectionCollapsed = collapsedSections[group.id];

              return (
                <div key={group.id}>
                  {/* Separator between sections (expanded only) */}
                  {!isCollapsed && groupIdx > 0 && (
                    <div className="my-1.5 mx-3 border-t border-border" />
                  )}
                  {/* Section header (expanded only) */}
                  {!isCollapsed && (
                    <div
                      className={cn(
                        "mb-1 px-2 flex items-center justify-between cursor-pointer group",
                        groupIdx > 0 ? "mt-2" : "mt-1",
                      )}
                      onClick={() => toggleSection(group.id)}
                    >
                      <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider select-none">
                        {group.label}
                      </span>
                      <ChevronDown
                        size={12}
                        className={cn(
                          "text-muted-foreground/60 transition-transform duration-200 group-hover:text-muted-foreground",
                          isSectionCollapsed && "-rotate-90",
                        )}
                      />
                    </div>
                  )}

                  {/* Items (hidden if section collapsed in expanded mode) */}
                  {(!isSectionCollapsed || isCollapsed) &&
                    group.items.map((item) =>
                      renderNavItem(
                        item,
                        "href" in item ? item.href : item.label,
                      ),
                    )}

                  {/* Thin separator between groups when collapsed */}
                  {isCollapsed && group.separatorAfter && (
                    <div className="my-1.5 mx-2 border-t border-border/50" />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-2 border-t border-border bg-card/80">
            {/* Footer nav items (Billing, Settings) */}
            {footerNavItems.map((item) => renderNavItem(item, item.href))}

            {/* Contact Support button */}
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="relative flex items-center h-9 w-9 justify-center mx-auto rounded-md text-sm transition-colors mb-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                    onClick={() => setSupportOpen(true)}
                  >
                    <LifeBuoy size={16} className="flex-shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Contact Support
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                className="relative flex items-center h-9 w-full gap-2.5 px-3 rounded-md text-sm transition-colors mb-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                onClick={() => setSupportOpen(true)}
              >
                <LifeBuoy size={16} className="flex-shrink-0" />
                <span className="truncate">Contact Support</span>
              </button>
            )}

            {/* Separator */}
            <div className="my-1.5 mx-1 border-t border-border/50" />

            {/* Theme toggle + Logout */}
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                <ThemeToggle />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="h-9 w-9 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={onLogout}
                    >
                      <LogOut size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    Logout
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  className="flex-1 flex items-center gap-2.5 h-9 px-3 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={onLogout}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </TooltipProvider>
      </div>

      {/* Support dialog */}
      <SupportDialog
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        userName={userName}
      />

      {/* Main content margin helper */}
      <style>{`
        .main-content {
          margin-left: ${isCollapsed ? "72px" : "220px"};
          transition: margin-left 0.2s ease;
        }
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
          }
        }
      `}</style>
    </>
  );
}
