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
      {!isCollapsed && (
        <div
          className={cn(
            "mb-1.5 px-3 flex items-center gap-2 cursor-pointer group",
            groupIdx > 0 ? "mt-4" : "mt-1.5",
          )}
          onClick={() => onToggleSection(group.id)}
        >
          {/* amber split-flap indicator — departure-board section marker */}
          <span className="h-2.5 w-[3px] rounded-full bg-board-amber/80 flex-shrink-0 transition-colors duration-200 group-hover:bg-board-amber" />
          <span className="font-mono text-[12px] font-bold uppercase text-board-cream/90 tracking-[0.18em] select-none whitespace-nowrap transition-colors duration-200 group-hover:text-board-cream">
            {group.label}
          </span>
          {/* hairline track running off to the right — departure-board look */}
          <div className="flex-1 h-px bg-board-line" />
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
