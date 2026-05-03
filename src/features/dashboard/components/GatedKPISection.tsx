// src/features/dashboard/components/GatedKPISection.tsx
// Component to display a gated KPI section with blur overlay when user lacks access

import React from "react";
import { Lock, Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GatedKPISectionProps {
  /** Whether the user has access to this section */
  hasAccess: boolean;
  /** Section title */
  title: string;
  /** The actual content to display when unlocked */
  children: React.ReactNode;
  /** Required tier name for display */
  requiredTier?: string;
  /** Additional className for the container */
  className?: string;
}

/**
 * GatedKPISection - Wraps a KPI section with blur overlay when user lacks access
 *
 * When locked:
 * - Content is blurred
 * - Overlay with lock icon and upgrade CTA
 *
 * When unlocked:
 * - Normal content display
 */
export const GatedKPISection: React.FC<GatedKPISectionProps> = ({
  hasAccess,
  title,
  children,
  requiredTier = "Pro",
  className,
}) => {
  if (hasAccess) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-v2-card/80 rounded-lg">
        <div className="flex flex-col items-center gap-2 p-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-v2-card-tinted dark:bg-v2-card-tinted">
            <Lock className="h-4 w-4 text-v2-ink-muted dark:text-v2-ink-subtle" />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink-muted">
              {title}
            </p>
            <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mt-0.5">
              Upgrade to {requiredTier} to unlock
            </p>
          </div>
          <Link to="/billing">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] mt-1"
            >
              <Crown className="h-3 w-3 mr-1 text-warning" />
              View Plans
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
