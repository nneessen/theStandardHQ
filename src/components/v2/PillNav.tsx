import React from "react";
import { cn } from "@/lib/utils";

export interface PillNavItem {
  label: string;
  value: string;
  onClick?: () => void;
}

interface PillNavProps {
  items: PillNavItem[];
  activeValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Centered horizontal pill nav cluster (Crextio-style top bar).
 * The active item gets a black pill with white text; inactive items
 * are inline ghost buttons. Useful as a top tabbar inside a card or
 * as a public-facing nav.
 */
export const PillNav: React.FC<PillNavProps> = ({
  items,
  activeValue,
  onChange,
  className,
  size = "md",
}) => {
  const sizeCls = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  return (
    <nav
      className={cn(
        "inline-flex items-center gap-1 rounded-v2-pill bg-v2-card border border-v2-ring p-1 shadow-v2-soft",
        className,
      )}
      aria-label="Section navigation"
    >
      {items.map((item) => {
        const isActive = item.value === activeValue;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              item.onClick?.();
              onChange?.(item.value);
            }}
            className={cn(
              "rounded-v2-pill font-semibold transition-colors",
              sizeCls,
              isActive
                ? "bg-v2-ink text-white"
                : "text-v2-ink-muted hover:text-v2-ink hover:bg-v2-accent-soft",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};
