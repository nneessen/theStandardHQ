// src/components/layout/Sidebar.tsx
import { useState, useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { SupportDialog } from "./SupportDialog";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NotificationDropdown } from "@/components/notifications";
import { toast } from "sonner";
import { useImo, useAllActiveImos } from "@/hooks/imo";
import { useIsMobile, usePersistentSectionCollapse } from "@/hooks/ui";
import { useSidebarNavigation } from "@/hooks/navigation";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { SidebarNavSection } from "./sidebar/SidebarNavSection";
import { SidebarFooter } from "./sidebar/SidebarFooter";

// ─── Types ───────────────────────────────────────────────────────

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
}

// ─── Component ───────────────────────────────────────────────────
export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  userName = "User",
  userEmail = "",
  onLogout,
}: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const isMobile = useIsMobile();
  const {
    imo,
    agency,
    loading: imoLoading,
    error: imoError,
    actingImoId,
    setActingImoId,
  } = useImo();
  const { visibleGroups, footerItems, isRecruit, isSuperAdmin } =
    useSidebarNavigation();
  const { data: allImos } = useAllActiveImos({
    enabled: isSuperAdmin,
  });
  const location = useLocation();

  const { collapsedSections, expandSection, toggleSection } =
    usePersistentSectionCollapse("sidebar-sections");

  // ─── Auto-expand active section on route change ──────────────

  useEffect(() => {
    for (const group of visibleGroups) {
      const hasActiveRoute = group.items.some((item) =>
        location.pathname.startsWith(item.href),
      );
      if (hasActiveRoute && collapsedSections[group.id]) {
        expandSection(group.id);
        break;
      }
    }
  }, [collapsedSections, expandSection, location.pathname, visibleGroups]);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileOpen(false);
    }
  }, [isMobile]);

  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);
  const closeMobile = () => setIsMobileOpen(false);

  const handleLockedNavClick = () => {
    toast.error(
      "Your account is pending approval. Please wait for administrator approval to access this feature.",
    );
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
          "theme-v2 fixed left-3 top-3 bottom-3 h-[calc(100vh-1.5rem)] bg-v2-card-tinted border border-v2-ring rounded-v2-lg shadow-v2-lift flex flex-col z-[100] transition-all duration-200 font-display overflow-hidden",
          isCollapsed ? "w-[72px]" : "w-[220px]",
          isMobile && (isMobileOpen ? "translate-x-0" : "-translate-x-[110%]"),
          isMobile && !isCollapsed && "w-[280px]",
        )}
      >
        <SidebarHeader
          actingImoId={actingImoId}
          agency={agency}
          allImos={allImos}
          imo={imo}
          imoError={imoError}
          imoLoading={imoLoading}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          isRecruit={isRecruit}
          isSuperAdmin={isSuperAdmin}
          onCloseMobile={closeMobile}
          onToggleCollapse={onToggleCollapse}
          setActingImoId={setActingImoId}
          userEmail={userEmail}
          userName={userName}
        />

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
                <SidebarNavSection
                  key={group.id}
                  group={group}
                  groupIdx={groupIdx}
                  isCollapsed={isCollapsed}
                  isMobile={isMobile}
                  isSectionCollapsed={!!isSectionCollapsed}
                  onCloseMobile={closeMobile}
                  onLockedClick={handleLockedNavClick}
                  onToggleSection={toggleSection}
                />
              );
            })}
          </nav>

          <SidebarFooter
            footerItems={footerItems}
            isCollapsed={isCollapsed}
            isMobile={isMobile}
            onCloseMobile={closeMobile}
            onLockedClick={handleLockedNavClick}
            onLogout={onLogout}
            onSupportOpen={() => setSupportOpen(true)}
          />
        </TooltipProvider>
      </div>

      {/* Support dialog */}
      <SupportDialog
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        userName={userName}
      />
    </>
  );
}
