// src/features/hierarchy/components/OverrideDashboard.tsx

import React, { useState } from "react";
import { DollarSign, Clock, TrendingUp, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMyOverrides, useMyOverrideSummary } from "@/hooks";
import type { OverrideFilters } from "@/types/hierarchy.types";

interface OverrideDashboardProps {
  className?: string;
}

/**
 * Status badge for override commissions
 */
function OverrideStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string }> = {
    pending: { label: "Pending" },
    earned: { label: "Earned" },
    paid: { label: "Paid" },
    chargedback: { label: "Chargedback" },
  };

  const config = variants[status] || variants.pending;

  return <Badge variant="outline">{config.label}</Badge>;
}

/**
 * OverrideDashboard - Displays override commission table with filters and summary cards
 * Shows all override earnings from downline agents writing policies
 */
export function OverrideDashboard({ className }: OverrideDashboardProps) {
  const [filters] = useState<OverrideFilters | undefined>(undefined);

  const { data: overrides, isLoading } = useMyOverrides({ filters });
  const { data: summary } = useMyOverrideSummary();

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Stats - Consolidated Single Box */}
      <div className="rounded-lg p-4 bg-gradient-to-br from-blue-50/50 to-violet-50/50 shadow-sm">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Override Summary
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-info" />
              Total Override Amount
            </span>
            <span className="text-lg font-bold font-mono">
              {formatCurrency(summary?.total_override_amount || 0)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-warning" />
              Pending
            </span>
            <span className="text-lg font-bold font-mono">
              {formatCurrency(summary?.pending_amount || 0)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              Earned
            </span>
            <span className="text-lg font-bold font-mono">
              {formatCurrency(summary?.earned_amount || 0)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-info" />
              Paid
            </span>
            <span className="text-lg font-bold font-mono">
              {formatCurrency(summary?.paid_amount || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Overrides Table */}
      <Card>
        <CardHeader>
          <CardTitle>Override Commissions</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Override earnings from your downline agents
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Loading overrides...</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : !overrides || overrides.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No override commissions yet</EmptyTitle>
                <EmptyDescription>
                  Override commissions are automatically created when your
                  downline agents write policies
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Downline Agent</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">
                      Base Commission
                    </TableHead>
                    <TableHead className="text-right">
                      Override Amount
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.map((override) => (
                    <TableRow key={override.id}>
                      <TableCell className="font-medium">
                        {formatDate(override.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {override.base_agent_email || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Hierarchy Level {override.hierarchy_depth}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">
                          {override.policy_number || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          Level {override.hierarchy_depth}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(override.base_commission_amount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(override.override_commission_amount)}
                      </TableCell>
                      <TableCell>
                        <OverrideStatusBadge status={override.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
