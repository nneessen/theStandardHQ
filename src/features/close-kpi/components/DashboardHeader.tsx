// src/features/close-kpi/components/DashboardHeader.tsx

import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddWidgetDropdown } from "./AddWidgetDropdown";
import type { WidgetType } from "../types/close-kpi.types";

interface DashboardHeaderProps {
  onAddWidget: (widgetType: WidgetType) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: string | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onAddWidget,
  onRefresh,
  isRefreshing,
  lastUpdated,
}) => {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <h1 className="text-sm font-semibold text-foreground">CRM KPIs</h1>
        {lastUpdated && (
          <p className="text-[10px] text-muted-foreground">
            Last updated {formatTimeAgo(lastUpdated)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px]"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`mr-1 h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        <AddWidgetDropdown onAdd={onAddWidget} />
      </div>
    </div>
  );
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
