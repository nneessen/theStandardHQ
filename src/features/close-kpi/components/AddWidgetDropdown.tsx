// src/features/close-kpi/components/AddWidgetDropdown.tsx

import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WIDGET_REGISTRY, WIDGET_CATEGORIES } from "../config/widget-registry";
import type { WidgetType } from "../types/close-kpi.types";

interface AddWidgetDropdownProps {
  onAdd: (widgetType: WidgetType) => void;
}

export const AddWidgetDropdown: React.FC<AddWidgetDropdownProps> = ({
  onAdd,
}) => {
  const widgetsByCategory = WIDGET_CATEGORIES.map((cat) => ({
    ...cat,
    widgets: Object.values(WIDGET_REGISTRY).filter(
      (w) => w.category === cat.id && !w.comingSoon,
    ),
  }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="text-[11px]">
          <Plus className="mr-1 h-3 w-3" />
          Add Widget
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {widgetsByCategory.map((cat, i) => (
          <React.Fragment key={cat.id}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-400">
                {cat.label}
              </DropdownMenuLabel>
              {cat.widgets.map((widget) => (
                <DropdownMenuItem
                  key={widget.type}
                  onClick={() => onAdd(widget.type)}
                  className="cursor-pointer text-[11px]"
                >
                  <div>
                    <div className="font-medium">{widget.label}</div>
                    <div className="text-[10px] text-zinc-500">
                      {widget.description}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
