// src/features/hierarchy/OrgChartPage.tsx
// Phase 12A: Org Chart Page - Interactive organizational hierarchy visualization

import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOrgChart } from "@/hooks/hierarchy";
import { OrgChartVisualization } from "./components/OrgChartVisualization";
import { AlertCircle, RefreshCw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgChartNode, OrgChartScope } from "@/types/hierarchy.types";

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
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Chart
            </h1>
            <p className="text-sm text-muted-foreground">
              Loading organizational structure...
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Loading org chart data...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Chart
            </h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-10 w-10 text-destructive mb-3" />
              <h3 className="font-medium text-destructive mb-1">
                Failed to load org chart
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (!orgChartData) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Chart
            </h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="font-medium text-foreground mb-1">
                No Organization Data
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                You don't have access to any organizational hierarchy data yet.
                This could be because you're not assigned to an IMO or agency.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Chart
          </h1>
          <p className="text-sm text-muted-foreground">
            Interactive view of your organizational hierarchy with performance
            metrics
          </p>
        </div>

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
      </div>

      {/* Org Chart Visualization */}
      <OrgChartVisualization
        data={orgChartData}
        onNodeClick={handleNodeClick}
        onDrillDown={handleDrillDown}
        showMetrics={true}
      />
    </div>
  );
};

export default OrgChartPage;
