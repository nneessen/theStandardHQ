import React from "react";
import { cn } from "@/lib/utils";

interface SectionShellProps {
  children: React.ReactNode;
  className?: string;
  fullHeight?: boolean;
}

/**
 * Wraps a page (or page region) in the design-system-v2 theme:
 * applies font-display, ink colors, and the warm canvas gradient bg.
 * Use this on any page being migrated to the v2 aesthetic.
 */
export const SectionShell: React.FC<SectionShellProps> = ({
  children,
  className,
  fullHeight = true,
}) => {
  return (
    <div
      className={cn(
        "theme-v2 v2-canvas text-v2-ink",
        fullHeight && "min-h-screen",
        className,
      )}
    >
      {children}
    </div>
  );
};
