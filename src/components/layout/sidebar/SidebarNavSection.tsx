// src/components/layout/sidebar/SidebarNavSection.tsx
// Presentational section renderer for grouped sidebar navigation.

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNavItem } from "./SidebarNavItem";
import type { ResolvedSidebarNavigationGroup } from "./types";

interface SidebarNavSectionProps {
  group: ResolvedSidebarNavigationGroup;
  groupIdx: number;
  isCollapsed: boolean;
  isMobile: boolean;
  isSectionCollapsed: boolean;
  onCloseMobile: () => void;
  onLockedClick: () => void;
  onToggleSection: (groupId: string) => void;
}

export function SidebarNavSection({
  group,
  groupIdx,
  isCollapsed,
  isMobile,
  isSectionCollapsed,
  onCloseMobile,
  onLockedClick,
  onToggleSection,
}: SidebarNavSectionProps) {
  return (
    <div>
      {!isCollapsed && groupIdx > 0 && (
        <div className="my-1.5 mx-3 border-t border-v2-ring" />
      )}

      {!isCollapsed && (
        <div
          className={cn(
            "mb-1 px-3 flex items-center justify-between cursor-pointer group",
            groupIdx > 0 ? "mt-2" : "mt-1",
          )}
          onClick={() => onToggleSection(group.id)}
        >
          <span className="text-[10px] font-semibold uppercase text-v2-ink-subtle tracking-[0.14em] select-none">
            {group.label}
          </span>
          <ChevronDown
            size={12}
            className={cn(
              "text-v2-ink-subtle transition-transform duration-200 group-hover:text-v2-ink-muted",
              isSectionCollapsed && "-rotate-90",
            )}
          />
        </div>
      )}

      {(!isSectionCollapsed || isCollapsed) &&
        group.items.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            isMobile={isMobile}
            onCloseMobile={onCloseMobile}
            onLockedClick={onLockedClick}
          />
        ))}

      {isCollapsed && group.separatorAfter && (
        <div className="my-1.5 mx-2 border-t border-v2-ring/60" />
      )}
    </div>
  );
}
