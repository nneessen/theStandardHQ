// src/features/hierarchy/components/OverrideDashboard.tsx
// Re-skinned to "The Board" charcoal design system: dashboard-canvas shell +
// departure-board header + FlapTile hero on the real override summary +
// the overrides table re-hosted in a <Board> panel. Data logic unchanged.

import { useState } from "react";
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
import { TINT } from "@/components/ui/StatusBadge";
import { SectionShell } from "@/components/v2";
import { Board, Cap, FlapTile, Num, T } from "@/components/board";
import { useMyOverrides, useMyOverrideSummary } from "@/hooks";
import type { OverrideFilters } from "@/types/hierarchy.types";

interface OverrideDashboardProps {
  className?: string;
}

/**
 * Status badge for override commissions
 */
const OVERRIDE_STATUS_TINT: Record<string, string> = {
  pending: TINT.amber,
  earned: TINT.emerald,
  paid: TINT.emerald,
  chargedback: TINT.rose,
};

const OVERRIDE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  earned: "Earned",
  paid: "Paid",
  chargedback: "Chargedback",
};

function OverrideStatusBadge({ status }: { status: string }) {
  const tone = OVERRIDE_STATUS_TINT[status] ?? TINT.slate;
  const label = OVERRIDE_STATUS_LABEL[status] ?? status;
  return (
    <Badge variant="outline" className={`text-[11px] px-1.5 py-0.5 ${tone}`}>
      {label}
    </Badge>
  );
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
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className={cn("flex flex-col gap-4", className)}>
          {/* Departure-board header */}
          <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
              Override Commissions
            </h1>
          </header>

          {/* Hero band — override summary (real data) */}
          <Board
            pad={20}
            rivets
            style={{
              background: `radial-gradient(130% 180% at 0% 0%, rgba(107,151,255,0.12), rgba(107,151,255,0.01)), ${T.panelGradient}`,
              border: "1px solid rgba(107,151,255,0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <Cap>TOTAL OVERRIDE</Cap>
                <div style={{ marginTop: 4 }}>
                  <Num
                    text={formatCurrency(summary?.total_override_amount || 0)}
                    size="xl"
                    lit
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
                  gap: 10,
                  flex: 1,
                  minWidth: 240,
                }}
              >
                <FlapTile
                  label="Pending"
                  value={formatCurrency(summary?.pending_amount || 0)}
                  tone="amber"
                />
                <FlapTile
                  label="Earned"
                  value={formatCurrency(summary?.earned_amount || 0)}
                  tone="green"
                />
                <FlapTile
                  label="Paid"
                  value={formatCurrency(summary?.paid_amount || 0)}
                  tone="blue"
                />
              </div>
            </div>
          </Board>

          {/* Overrides Table */}
          <Board pad={20}>
            <div style={{ marginBottom: 12 }}>
              <Cap>OVERRIDE COMMISSIONS</Cap>
              <p
                style={{
                  font: `500 12px ${T.data}`,
                  color: T.mut,
                  marginTop: 4,
                }}
              >
                Override earnings from your downline agents
              </p>
            </div>
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
              <div className="rounded-lg overflow-hidden">
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
                            <span className="text-[13px] text-muted-foreground">
                              Hierarchy Level {override.hierarchy_depth}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-[13px] font-mono">
                            {override.policy_number || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[11px] px-1.5 py-0.5 ${TINT.slate}`}
                          >
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
          </Board>
        </div>
      </div>
    </SectionShell>
  );
}
