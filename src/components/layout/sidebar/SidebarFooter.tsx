// src/components/layout/sidebar/SidebarFooter.tsx
// Presentational footer for support/settings/billing/theme/logout controls.

import React from "react";
import { LifeBuoy, LogOut } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SidebarNavItem } from "./SidebarNavItem";
import type { ResolvedSidebarNavigationItem } from "./types";

interface SidebarFooterProps {
  footerItems: ResolvedSidebarNavigationItem[];
  isCollapsed: boolean;
  isMobile: boolean;
  onCloseMobile: () => void;
  onLockedClick: () => void;
  onLogout?: () => void;
  onSupportOpen: () => void;
}

export function SidebarFooter({
  footerItems,
  isCollapsed,
  isMobile,
  onCloseMobile,
  onLockedClick,
  onLogout,
  onSupportOpen,
}: SidebarFooterProps) {
  return (
    <div className="p-2 border-t border-v2-ring bg-v2-card/60">
      {footerItems.map((item) => (
        <SidebarNavItem
          key={item.href}
          item={item}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          onCloseMobile={onCloseMobile}
          onLockedClick={onLockedClick}
        />
      ))}

      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="relative flex items-center h-9 w-9 justify-center mx-auto rounded-v2-pill text-sm transition-colors mb-0.5 text-v2-ink-muted hover:text-v2-ink hover:bg-v2-accent-soft"
              onClick={onSupportOpen}
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
          className="relative flex items-center h-9 w-full gap-2.5 px-3 rounded-v2-pill text-sm transition-colors mb-0.5 text-v2-ink-muted hover:text-v2-ink hover:bg-v2-accent-soft"
          onClick={onSupportOpen}
        >
          <LifeBuoy size={16} className="flex-shrink-0" />
          <span className="truncate">Contact Support</span>
        </button>
      )}

      <div className="my-1.5 mx-1 border-t border-v2-ring/60" />

      {isCollapsed ? (
        <div className="flex flex-col items-center gap-1">
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="h-9 w-9 flex items-center justify-center rounded-v2-pill text-destructive hover:bg-destructive/10 transition-colors"
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
            className="flex-1 flex items-center gap-2.5 h-9 px-3 rounded-v2-pill text-sm text-destructive hover:bg-destructive/10 transition-colors"
            onClick={onLogout}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}
