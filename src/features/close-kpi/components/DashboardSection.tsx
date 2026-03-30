// src/features/close-kpi/components/DashboardSection.tsx
// Reusable section container for the pre-built dashboard layout.

import React from "react";
import { Flame, Users, Phone, DollarSign, type LucideIcon } from "lucide-react";
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
  children: React.ReactNode;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  description,
  icon,
  tooltipKey,
  gridClass,
  children,
}) => {
  const IconComponent = ICON_MAP[icon] ?? Flame;
  const tooltip = SECTION_TOOLTIPS[tooltipKey];

  return (
    <div className="space-y-2">
      {/* Section Header */}
      <div className="flex items-start gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 mt-0.5">
          <IconComponent className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h2 className="text-xs font-semibold text-foreground">{title}</h2>
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
