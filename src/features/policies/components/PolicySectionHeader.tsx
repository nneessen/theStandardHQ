// src/features/policies/components/PolicySectionHeader.tsx

import React from "react";
import type { LucideIcon } from "lucide-react";

interface PolicySectionHeaderProps {
  /** Lucide icon rendered inside the tinted tile. */
  icon: LucideIcon;
  /** Mono uppercase group label (e.g. "Client", "Premium & Payment"). */
  label: string;
  /**
   * Tile tint. Defaults to the app accent (blue). Use "success" for the
   * money/financial-summary group so it reads as the computed (not editable)
   * region.
   */
  tone?: "accent" | "success";
}

/**
 * Section header for the Add/Edit Policy form (Direction B redesign).
 *
 * The reused scanning pattern across the form: a 30px tinted icon tile + a
 * Space-Mono uppercase label + a thin rule filling the rest of the row. This is
 * what makes the single scrolling column effortless to scan instead of reading
 * as one dense slab. Theme-aware — all colors come from semantic tokens.
 */
export const PolicySectionHeader: React.FC<PolicySectionHeaderProps> = ({
  icon: Icon,
  label,
  tone = "accent",
}) => {
  const tile =
    tone === "success"
      ? "bg-success/10 text-success"
      : "bg-accent/10 text-accent";

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg ${tile}`}
        aria-hidden="true"
      >
        <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
      </span>
      <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  );
};
