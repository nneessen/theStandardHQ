// src/features/close-kpi/components/DashboardSection.tsx
// Reusable section container for the pre-built dashboard layout.
// Supports "hero" variant for the AI Lead Scoring section.

import React from "react";
import {
  Flame,
  Users,
  Phone,
  DollarSign,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { SECTION_TOOLTIPS } from "../config/prebuilt-layout";

const ICON_MAP: Record<string, LucideIcon> = {
  Flame,
  Users,
  Phone,
  DollarSign,
};

interface DashboardSectionProps {
  id: string;
  title: string;
  description: string;
  icon: string;
  tooltipKey: string;
  gridClass: string;
  variant?: "default" | "hero";
  children: React.ReactNode;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  description,
  icon,
  tooltipKey,
  gridClass,
  variant = "default",
  children,
}) => {
  const IconComponent = ICON_MAP[icon] ?? Flame;
  const tooltip = SECTION_TOOLTIPS[tooltipKey];
  const isHero = variant === "hero";

  return (
    <div
      className={
        isHero
          ? "space-y-3 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.07] p-3"
          : "space-y-2"
      }
    >
      {/* Section Header */}
      <div className="flex items-start gap-2">
        <div
          className={`flex items-center justify-center flex-shrink-0 mt-0.5 rounded-md ${
            isHero ? "w-8 h-8 bg-primary/10" : "w-6 h-6 bg-v2-ring"
          }`}
        >
          <IconComponent
            className={
              isHero ? "h-4 w-4 text-primary" : "h-3.5 w-3.5 text-v2-ink-muted"
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2
              className={
                isHero
                  ? "text-sm font-bold text-foreground"
                  : "text-xs font-semibold text-foreground"
              }
            >
              {title}
            </h2>
            {isHero && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                AI-Powered
              </span>
            )}
            {tooltip && (
              <MetricTooltip
                title={tooltip.title}
                description={tooltip.description}
                formula={tooltip.formula}
                note={tooltip.note}
              />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-1 md:line-clamp-none">
            {description}
          </p>
        </div>
      </div>

      {/* Widget Grid */}
      <div className={gridClass}>{children}</div>
    </div>
  );
};
