// src/components/layout/sidebar/SidebarNavItem.tsx
// Presentational sidebar item renderer for visible/locked nav entries.

import React from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ResolvedSidebarNavigationItem } from "./types";

interface SidebarNavItemProps {
  item: ResolvedSidebarNavigationItem;
  isCollapsed: boolean;
  isMobile: boolean;
  onCloseMobile: () => void;
  onLockedClick: () => void;
}

export function SidebarNavItem({
  item,
  isCollapsed,
  isMobile,
  onCloseMobile,
  onLockedClick,
}: SidebarNavItemProps) {
  const Icon = item.icon;
  const isLocked = item.state === "locked";

  if (isLocked) {
    const lockedEl = (
      <div
        className={cn(
          "relative flex items-center h-9 rounded-[8px] cursor-not-allowed opacity-50 mb-0.5",
          isCollapsed ? "w-9 justify-center mx-auto" : "w-full gap-2.5 px-3",
        )}
        onClick={onLockedClick}
      >
        <Icon size={16} className="text-v2-ink-muted flex-shrink-0" />
        {!isCollapsed && (
          <span className="text-sm blur-[0.5px] text-v2-ink-muted truncate">
            {item.label}
          </span>
        )}
        <Lock
          size={10}
          className={cn(
            "absolute text-v2-ink-subtle",
            isCollapsed
              ? "bottom-0.5 right-0.5"
              : "right-2 top-1/2 -translate-y-1/2",
          )}
        />
      </div>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{lockedEl}</div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label} (Locked)
          </TooltipContent>
        </Tooltip>
      );
    }

    return lockedEl;
  }

  const linkEl = (
    <Link
      to={item.href}
      onClick={() => {
        if (isMobile) onCloseMobile();
      }}
    >
      {({ isActive }) => (
        <div
          className={cn(
            // Lit departure-board track: blue-tinted bed + inset blue ring when active.
            "relative flex items-center h-9 rounded-[8px] text-sm transition-colors mb-0.5",
            isCollapsed ? "w-9 justify-center mx-auto" : "w-full gap-2.5 px-3",
            isActive
              ? "bg-board-blue/10 text-board-ink font-semibold ring-1 ring-inset ring-board-blue/35"
              : "text-v2-ink-muted hover:text-v2-ink hover:bg-v2-accent-soft",
          )}
          data-active={isActive}
        >
          <Icon
            size={16}
            className={cn("flex-shrink-0", isActive ? "text-board-blue" : "")}
          />
          {!isCollapsed && (
            <span className="truncate uppercase tracking-[0.03em]">
              {item.label}
            </span>
          )}
          {isActive && !isCollapsed && (
            <span className="ml-auto flex-shrink-0 font-mono text-[8px] font-bold tracking-[0.1em] text-board-blue">
              ● NOW
            </span>
          )}
        </div>
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{linkEl}</div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkEl;
}
