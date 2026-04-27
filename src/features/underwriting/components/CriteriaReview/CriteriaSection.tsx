// src/features/underwriting/components/CriteriaReview/CriteriaSection.tsx

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CriteriaSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export function CriteriaSection({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
  isEmpty = false,
  emptyMessage = "No data available",
}: CriteriaSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 bg-v2-canvas dark:bg-v2-card-tinted/50 hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted rounded-md transition-colors group">
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-3 w-3 text-v2-ink-subtle" />
          ) : (
            <ChevronRight className="h-3 w-3 text-v2-ink-subtle" />
          )}
          {icon && (
            <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
              {icon}
            </span>
          )}
          <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
            {title}
          </span>
        </div>
        {badge && <div>{badge}</div>}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 py-2">
        {isEmpty ? (
          <p className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted italic">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
