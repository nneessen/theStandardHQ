import React from "react";
import { cn } from "@/lib/utils";

export interface BoardListHeaderProps {
  /**
   * Page title, rendered in the Archivo board display face (uppercase, bold) but
   * at a COMPACT size — the "light chrome" treatment for dense working pages
   * (Policies, Expenses, Overrides…) where the full 40px BoardPageHeader would
   * cost too much vertical density. Pair with the page's existing compact metric
   * strip (passed via `stats`) rather than riveted panels.
   */
  title: React.ReactNode;
  /** Optional leading icon (e.g. a lucide glyph). */
  icon?: React.ReactNode;
  /** Compact inline metric strip kept dense — chips, not riveted panels. */
  stats?: React.ReactNode;
  /** Right-aligned actions (buttons, dropdowns). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Compact departure-board page header for dense list/table pages. Gives the
 * signature Archivo-uppercase board title + a slot for the page's existing
 * compact metric chips and actions, without the density cost of the full
 * BoardPageHeader hero. Table headers (Space Mono) and SoftCard panels already
 * carry the rest of the board language.
 */
export function BoardListHeader({
  title,
  icon,
  stats,
  actions,
  className,
}: BoardListHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 flex-wrap",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {icon}
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight leading-none text-foreground">
            {title}
          </h1>
        </div>
        {stats}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
