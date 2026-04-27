// src/features/settings/SettingsDashboard.tsx
//
// Settings page — grouped left-side nav with plain-English labels,
// category groupings, and section descriptions for non-technical users.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  User,
  Settings,
  Building2,
  Package,
  Percent,
  Building,
  Crown,
  ClipboardCheck,
  UserPlus,
  Bell,
  History,
  Link2,
  Stethoscope,
  Globe,
} from "lucide-react";
import { UserProfile } from "./components/UserProfile";
import { CarriersManagement } from "./carriers/CarriersManagement";
import { ProductsManagement } from "./products/ProductsManagement";
import { CommissionRatesManagement } from "./commission-rates/CommissionRatesManagement";
import { ConstantsManagement } from "./ConstantsManagement";
import { ImoManagement } from "./imo";
import { AgencyManagement } from "./agency";
import { AgencyRequestPage } from "./agency-request";
import { JoinRequestPage } from "./join-request";
import { NotificationsSettingsPage } from "./notifications";
import { IntegrationsTab } from "./integrations";
import { AuditTrailPage } from "@/features/audit";
import { UnderwritingSettingsTab } from "@/features/underwriting";
import { LandingPageSettingsTab } from "./landing-page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SoftCard } from "@/components/v2";
import { usePermissionCheck } from "@/hooks/permissions";
import { useImo } from "@/hooks/imo";
import { usePendingAgencyRequestCount } from "@/hooks/agency-request";
import { usePendingJoinApprovalCount } from "@/hooks/join-request";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports -- Legacy import, needs refactor to use hooks
import { supabase } from "@/services/base/supabase";
import { cn } from "@/lib/utils";
import type { RoleName } from "@/types/permissions.types";

interface SettingsDashboardProps {
  initialTab?: string;
}

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  visible: boolean;
  badge?: number;
  Component: React.ComponentType;
}

interface SettingsGroup {
  label: string;
  items: SettingsItem[];
}

export function SettingsDashboard({ initialTab }: SettingsDashboardProps) {
  const navigate = useNavigate();
  const { can } = usePermissionCheck();
  const { isSuperAdmin, isImoAdmin } = useImo();
  const { user } = useAuth();
  const { data: pendingAgencyRequestCount = 0 } =
    usePendingAgencyRequestCount();
  const { data: pendingJoinRequestCount = 0 } = usePendingJoinApprovalCount();

  // Check user roles to determine if they are staff-only
  const { data: userProfile } = useQuery({
    queryKey: ["settings-user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("roles, is_admin")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as { roles: RoleName[]; is_admin: boolean | null };
    },
    enabled: !!user?.id,
  });

  const hasRole = (role: RoleName) =>
    userProfile?.roles?.includes(role) || false;

  // Staff-only: has trainer/contracting_manager but NOT agent/admin
  const isStaffOnly =
    (hasRole("trainer" as RoleName) ||
      hasRole("contracting_manager" as RoleName)) &&
    !hasRole("agent" as RoleName) &&
    !hasRole("admin" as RoleName) &&
    !userProfile?.is_admin;

  const canManageCarriers = can("carriers.manage");
  const canManageImos = isSuperAdmin;
  const canManageAgencies = isImoAdmin || isSuperAdmin;
  const canViewAuditTrail = isImoAdmin || isSuperAdmin;
  const canManageLanding = isImoAdmin || isSuperAdmin;

  // ── Groups + items ──────────────────────────────────────────────
  const groups: SettingsGroup[] = useMemo(
    () => [
      {
        label: "You",
        items: [
          {
            id: "agents",
            label: "Profile",
            description: "Your account, photo, recruiting URL, and branding.",
            icon: User,
            visible: true,
            Component: UserProfile,
          },
          {
            id: "notifications",
            label: "Alerts",
            description:
              "Choose which events notify you and tune custom alert rules.",
            icon: Bell,
            visible: true,
            Component: NotificationsSettingsPage,
          },
          {
            id: "integrations",
            label: "Integrations",
            description:
              "Connect Slack, calendars, email, and other outside tools.",
            icon: Link2,
            visible: true,
            Component: IntegrationsTab,
          },
        ],
      },
      {
        label: "Organization",
        items: [
          {
            id: "agency-request",
            label: "Agency requests",
            description:
              "Apply to become an agency, or review pending agency applications.",
            icon: ClipboardCheck,
            visible: !isStaffOnly,
            badge: pendingAgencyRequestCount,
            Component: AgencyRequestPage,
          },
          {
            id: "join-request",
            label: "Join requests",
            description:
              "Request to join an organization, or approve people who want to join yours.",
            icon: UserPlus,
            visible: !isStaffOnly,
            badge: pendingJoinRequestCount,
            Component: JoinRequestPage,
          },
          {
            id: "agencies",
            label: "Agencies",
            description: "Manage agencies in your IMO.",
            icon: Building,
            visible: canManageAgencies,
            Component: AgencyManagement,
          },
          {
            id: "imos",
            label: "IMOs",
            description: "Super-admin only — manage every IMO in the system.",
            icon: Crown,
            visible: canManageImos,
            Component: ImoManagement,
          },
        ],
      },
      {
        label: "Insurance",
        items: [
          {
            id: "carriers",
            label: "Carriers",
            description:
              "Insurance carriers your agents can work with, and their rating tables.",
            icon: Building2,
            visible: canManageCarriers,
            Component: CarriersManagement,
          },
          {
            id: "products",
            label: "Products",
            description:
              "Insurance products available for each carrier (Term, Whole, IUL, etc.).",
            icon: Package,
            visible: canManageCarriers,
            Component: ProductsManagement,
          },
          {
            id: "rates",
            label: "Commission rates",
            description:
              "What percentage your agents earn for each product, by contract level.",
            icon: Percent,
            visible: canManageCarriers,
            Component: CommissionRatesManagement,
          },
          {
            id: "underwriting",
            label: "Underwriting",
            description:
              "AI underwriting wizard: criteria, acceptance rules, and guides.",
            icon: Stethoscope,
            visible: canManageCarriers,
            Component: UnderwritingSettingsTab,
          },
        ],
      },
      {
        label: "System",
        items: [
          {
            id: "landing-page",
            label: "Public landing page",
            description:
              "Customize the public-facing recruiting page (hero, FAQ, theme).",
            icon: Globe,
            visible: canManageLanding,
            Component: LandingPageSettingsTab,
          },
          {
            id: "constants",
            label: "System defaults",
            description:
              "Average annual premium and other system-wide calculation defaults.",
            icon: Settings,
            visible: canManageCarriers,
            Component: ConstantsManagement,
          },
          {
            id: "audit-trail",
            label: "Activity log",
            description:
              "Audit history of changes across the system (admin only).",
            icon: History,
            visible: canViewAuditTrail,
            Component: AuditTrailPage,
          },
        ],
      },
    ],
    [
      isStaffOnly,
      pendingAgencyRequestCount,
      pendingJoinRequestCount,
      canManageAgencies,
      canManageImos,
      canManageCarriers,
      canManageLanding,
      canViewAuditTrail,
    ],
  );

  // Flatten visible items
  const visibleItems = useMemo(
    () => groups.flatMap((g) => g.items.filter((i) => i.visible)),
    [groups],
  );

  // Resolve active tab — URL-supplied, fall back to first visible item
  const activeId = useMemo(() => {
    if (initialTab && visibleItems.some((i) => i.id === initialTab)) {
      return initialTab;
    }
    return visibleItems[0]?.id ?? "agents";
  }, [initialTab, visibleItems]);

  const activeItem = visibleItems.find((i) => i.id === activeId);

  const setActiveTab = (id: string) => {
    navigate({
      to: "/settings",
      search: { tab: id },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Compact header */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-v2-ink" />
          <h1 className="text-base font-semibold tracking-tight text-v2-ink">
            Settings
          </h1>
        </div>
        <p className="text-[11px] text-v2-ink-muted">
          {canManageCarriers
            ? "Configure your account, organization, and insurance setup."
            : "Manage your account, alerts, and integrations."}
        </p>
      </header>

      {/* Mobile: dropdown selector */}
      <div className="lg:hidden">
        <Select value={activeId} onValueChange={setActiveTab}>
          <SelectTrigger className="h-9 bg-v2-card border-v2-ring rounded-v2-pill text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => {
              const groupItems = g.items.filter((i) => i.visible);
              if (groupItems.length === 0) return null;
              return (
                <div key={g.label}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-v2-ink-subtle">
                    {g.label}
                  </div>
                  {groupItems.map((i) => (
                    <SelectItem key={i.id} value={i.id} className="text-sm">
                      {i.label}
                      {i.badge && i.badge > 0 ? ` (${i.badge})` : ""}
                    </SelectItem>
                  ))}
                </div>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: side nav + panel */}
      <div className="hidden lg:grid lg:grid-cols-[240px_1fr] gap-4 items-start">
        <SoftCard padding="md" className="sticky top-3 self-start">
          <nav className="flex flex-col gap-4">
            {groups.map((g) => {
              const groupItems = g.items.filter((i) => i.visible);
              if (groupItems.length === 0) return null;
              return (
                <div key={g.label} className="flex flex-col gap-1">
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-v2-ink-subtle">
                    {g.label}
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {groupItems.map((i) => {
                      const Icon = i.icon;
                      const isActive = i.id === activeId;
                      return (
                        <li key={i.id}>
                          <button
                            type="button"
                            onClick={() => setActiveTab(i.id)}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "w-full flex items-center gap-2 h-8 px-2.5 rounded-v2-pill text-[12px] font-medium transition-colors",
                              isActive
                                ? "bg-v2-ink text-v2-canvas shadow-v2-soft"
                                : "text-v2-ink-muted hover:text-v2-ink hover:bg-v2-accent-soft",
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5 flex-shrink-0",
                                isActive && "text-v2-accent",
                              )}
                            />
                            <span className="truncate flex-1 text-left">
                              {i.label}
                            </span>
                            {i.badge && i.badge > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-v2-pill bg-v2-accent text-v2-ink text-[10px] font-bold">
                                {i.badge}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        </SoftCard>

        <div className="flex flex-col gap-3 min-w-0">
          {activeItem && (
            <SoftCard padding="md">
              <div className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-v2-pill bg-v2-accent-soft text-v2-ink flex-shrink-0">
                  <activeItem.icon className="h-4 w-4" />
                </span>
                <div className="flex flex-col leading-tight min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-v2-ink">
                    {activeItem.label}
                  </h2>
                  <p className="text-[12px] text-v2-ink-muted">
                    {activeItem.description}
                  </p>
                </div>
              </div>
            </SoftCard>
          )}

          <div className="min-w-0">
            {activeItem && <activeItem.Component />}
          </div>
        </div>
      </div>

      {/* Mobile: panel content */}
      <div className="lg:hidden flex flex-col gap-3">
        {activeItem && (
          <SoftCard padding="md">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-v2-pill bg-v2-accent-soft text-v2-ink flex-shrink-0">
                <activeItem.icon className="h-4 w-4" />
              </span>
              <div className="flex flex-col leading-tight min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-v2-ink">
                  {activeItem.label}
                </h2>
                <p className="text-[12px] text-v2-ink-muted">
                  {activeItem.description}
                </p>
              </div>
            </div>
          </SoftCard>
        )}
        <div className="min-w-0">{activeItem && <activeItem.Component />}</div>
      </div>
    </div>
  );
}
