// src/features/hierarchy/OrgChartPage.tsx
// Phase 12A: Org Chart Page - Interactive organizational hierarchy visualization
// Re-skinned to "The Board" charcoal design system (shell + departure header);
// the OrgChartVisualization and data logic are preserved verbatim.

import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOrgChart } from "@/hooks/hierarchy";
import { OrgChartVisualization } from "./components/OrgChartVisualization";
import { AlertCircle, RefreshCw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Board } from "@/components/board";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import type { OrgChartNode, OrgChartScope } from "@/types/hierarchy.types";

/** Charcoal page shell shared by every render state. */
function OrgChartShell({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </SectionShell>
  );
}

/** Departure-board header shared by every render state. */
function OrgChartHeader({
  subtitle,
  right,
}: {
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Cap>AGENCY HIERARCHY</Cap>
        <h1
          style={{
            font: `800 26px ${T.disp}`,
            color: T.ink,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          Organization Chart
        </h1>
        {subtitle && (
          <span style={{ font: `500 12px ${T.data}`, color: T.mut }}>
            {subtitle}
          </span>
        )}
      </div>
      {right}
    </header>
  );
}

export const OrgChartPage: React.FC = () => {
  const navigate = useNavigate();
  const [scope, setScope] = useState<OrgChartScope>("auto");

  const {
    data: orgChartData,
    isLoading,
    error,
    refetch,
  } = useOrgChart({
    scope,
    includeMetrics: true,
    maxDepth: 10,
  });

  // Handle node click - show detail or navigate
  const handleNodeClick = (node: OrgChartNode) => {
    // If agent, navigate to agent detail page
    if (node.type === "agent") {
      navigate({
        to: "/hierarchy/agent/$agentId",
        params: { agentId: node.id },
      });
    }
  };

  // Handle drill-down - update focused view
  const handleDrillDown = (node: OrgChartNode) => {
    // Could update URL params for shareable links
    console.log("Drill down to:", node.name);
  };

  // Loading state
  if (isLoading) {
    return (
      <OrgChartShell>
        <OrgChartHeader subtitle="Loading organizational structure..." />
        <Board pad={0}>
          <div className="py-16 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mb-4" />
            <p className="text-sm text-v2-ink-muted">
              Loading org chart data...
            </p>
          </div>
        </Board>
      </OrgChartShell>
    );
  }

  // Error state
  if (error) {
    return (
      <OrgChartShell>
        <OrgChartHeader />
        <Board pad={0}>
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="font-medium text-destructive mb-1">
              Failed to load org chart
            </h3>
            <p className="text-sm text-v2-ink-muted mb-4 max-w-md">
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred"}
            </p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </Board>
      </OrgChartShell>
    );
  }

  // Empty state
  if (!orgChartData) {
    return (
      <OrgChartShell>
        <OrgChartHeader />
        <Board pad={0}>
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Building2 className="h-12 w-12 text-v2-ink-muted/50 mb-3" />
            <h3 className="font-medium text-v2-ink mb-1">
              No Organization Data
            </h3>
            <p className="text-sm text-v2-ink-muted max-w-md">
              You don't have access to any organizational hierarchy data yet.
              This could be because you're not assigned to an IMO or agency.
            </p>
          </div>
        </Board>
      </OrgChartShell>
    );
  }

  return (
    <OrgChartShell>
      <OrgChartHeader
        subtitle="Interactive view of your organizational hierarchy with performance metrics"
        right={
          <div className="flex items-center gap-2">
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as OrgChartScope)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="View scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="imo">IMO View</SelectItem>
                <SelectItem value="agency">Agency View</SelectItem>
                <SelectItem value="agent">My Team</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Org Chart Visualization */}
      <OrgChartVisualization
        data={orgChartData}
        onNodeClick={handleNodeClick}
        onDrillDown={handleDrillDown}
        showMetrics={true}
      />
    </OrgChartShell>
  );
};

export default OrgChartPage;
