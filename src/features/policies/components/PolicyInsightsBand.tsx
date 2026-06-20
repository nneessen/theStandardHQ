// src/features/policies/components/PolicyInsightsBand.tsx
// The "insights band": four compact cards that fill the dead space ABOVE the
// Policies table. Grows/shrinks with the viewport (flex:1 1 auto, min-h-0) so
// it never steals a table row or pushes the pager off-screen. Every figure is
// derived from the same filtered dataset the table shows — the four cards
// reconcile with one another. See the Policies redesign handoff.

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { T } from "@/components/board";
import { Cap, Num } from "@/components/board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Policy } from "@/types/policy.types";
import type { Commission } from "@/types/commission.types";
import {
  computeCommissionPipeline,
  computeStatusMix,
  computeTopCarriers,
  computeMonthlyPremium,
  monthlyGrowth,
  totalPremium,
  type PolicyStatusMix,
} from "../utils/policyInsights";

interface PolicyInsightsBandProps {
  policies: Policy[];
  commissions: Commission[];
  carrierNames: Record<string, string>;
  canViewCommissions: boolean;
  className?: string;
}

/** Compact currency: $1.2k / $1.3M, full dollars under $1k. */
function compactUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  background: T.panel,
  border: `1px solid ${T.line2}`,
  borderRadius: 16,
  boxShadow: T.panelShadow,
  padding: "12px 14px",
  overflow: "hidden",
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  overflow: "hidden",
};

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={cardStyle}>
      <Cap style={{ fontSize: 11, marginBottom: 8, flexShrink: 0 }}>{label}</Cap>
      <div style={bodyStyle}>{children}</div>
    </div>
  );
}

/** Multi-segment donut. Segments draw clockwise; track fills the remainder. */
function StatusDonut({ mix, size = 76 }: { mix: PolicyStatusMix; size?: number }) {
  const thickness = 12;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const segs: Array<{ value: number; color: string }> = [
    { value: mix.active, color: T.green },
    { value: mix.pending, color: T.amber },
    { value: mix.cancelled, color: T.mut2 },
    { value: mix.incomplete, color: T.blue },
  ];
  const total = mix.total || 1;
  let offset = 0;
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
    >
      {/* stroke goes through `style` (CSS) so the var(--*) board tokens resolve —
          they would NOT resolve as a raw SVG `stroke` presentation attribute. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={thickness}
        style={{ stroke: "var(--tile-edge)" }}
      />
      {segs.map((s, i) => {
        if (s.value <= 0) return null;
        const frac = s.value / total;
        const dash = frac * c;
        const seg = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            style={{ stroke: s.color }}
          />
        );
        offset += dash;
        return seg;
      })}
    </svg>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: T.data,
        fontSize: 12,
        color: T.mut,
        lineHeight: 1.5,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <span
        style={{
          color: T.ink,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export const PolicyInsightsBand: React.FC<PolicyInsightsBandProps> = ({
  policies,
  commissions,
  carrierNames,
  canViewCommissions,
  className,
}) => {
  const pipeline = useMemo(
    () => computeCommissionPipeline(commissions),
    [commissions],
  );
  const mix = useMemo(() => computeStatusMix(policies), [policies]);
  const carriers = useMemo(
    () => computeTopCarriers(policies, carrierNames, 4),
    [policies, carrierNames],
  );
  const trend = useMemo(() => computeMonthlyPremium(policies, 6), [policies]);
  const premium = useMemo(() => totalPremium(policies), [policies]);
  const growth = useMemo(() => monthlyGrowth(trend), [trend]);

  const maxMonthly = Math.max(1, ...trend.map((t) => t.premium));
  const maxCarrier = Math.max(1, ...carriers.map((c) => c.premium));

  // Pipeline stacked-bar fractions.
  const pTotal = pipeline.total || 1;

  return (
    <div
      className={cn(
        // Stacked on mobile, 2-up on small, 4-up (fractional emphasis on the
        // pipeline card) on desktop where the band fills the freed space.
        "grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:[grid-template-columns:1.25fr_1fr_0.95fr_1fr]",
        className,
      )}
    >
      {/* 1 · Commission Pipeline — two columns (total left, breakdown right) so
          the card fits the band's min height on smaller laptops without the
          big number + bar + 3 legend rows clipping top/bottom. */}
      <Card label="Commission Pipeline">
        {canViewCommissions ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Left: total */}
            <div style={{ flexShrink: 0 }}>
              <Num text={compactUsd(pipeline.total)} size="lg" lit />
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: T.mut2,
                  marginTop: 2,
                }}
              >
                Total
              </div>
            </div>
            {/* Right: stacked bar + legend */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: 9,
                  borderRadius: 5,
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.45)",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    width: `${(pipeline.paid / pTotal) * 100}%`,
                    background: T.green,
                  }}
                />
                <span
                  style={{
                    width: `${(pipeline.earned / pTotal) * 100}%`,
                    background: "rgba(95,208,138,0.5)",
                  }}
                />
                <span
                  style={{
                    width: `${(pipeline.pending / pTotal) * 100}%`,
                    background: T.amber,
                  }}
                />
              </div>
              <LegendRow
                color={T.green}
                label="Paid"
                value={compactUsd(pipeline.paid)}
              />
              <LegendRow
                color="rgba(95,208,138,0.5)"
                label="Earned"
                value={compactUsd(pipeline.earned)}
              />
              <LegendRow
                color={T.amber}
                label="Pending"
                value={compactUsd(pipeline.pending)}
              />
            </div>
          </div>
        ) : (
          <span style={{ fontFamily: T.data, fontSize: 12, color: T.mut2 }}>
            Commission amounts unavailable on your plan.
          </span>
        )}
      </Card>

      {/* 2 · Premium Written */}
      <Card label="Premium Written">
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <Num text={compactUsd(premium)} size="lg" />
          {growth !== null && (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 11,
                fontWeight: 700,
                color: growth >= 0 ? T.green : T.red,
                whiteSpace: "nowrap",
              }}
            >
              {growth >= 0 ? "+" : ""}
              {(growth * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            flex: 1,
            minHeight: 24,
            marginTop: 12,
          }}
        >
          <TooltipProvider delayDuration={100}>
            {trend.map((m, i) => {
              const last = i === trend.length - 1;
              const monthLabel = m.month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        minWidth: 0,
                        height: "100%",
                        justifyContent: "flex-end",
                        cursor: "default",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max(4, (m.premium / maxMonthly) * 100)}%`,
                          minHeight: 4,
                          borderRadius: 3,
                          background: last ? T.blue : "rgba(255,255,255,0.16)",
                          transition: "background 0.12s",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 9,
                          color: last ? T.ink : T.mut2,
                        }}
                      >
                        {m.label}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div style={{ fontWeight: 600 }}>{monthLabel}</div>
                    <div style={{ fontVariantNumeric: "tabular-nums" }}>
                      {compactUsd(m.premium)} written
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </Card>

      {/* 3 · Policy Status */}
      <Card label="Policy Status">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StatusDonut mix={mix} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <LegendRow color={T.green} label="Active" value={mix.active} />
            <LegendRow color={T.amber} label="Pending" value={mix.pending} />
            <LegendRow
              color={T.mut2}
              label="Cancelled"
              value={mix.cancelled}
            />
            <LegendRow
              color={T.blue}
              label="Incomplete"
              value={mix.incomplete}
            />
          </div>
        </div>
      </Card>

      {/* 4 · Top Carriers · Premium */}
      <Card label="Top Carriers · Premium">
        {carriers.length === 0 ? (
          <span style={{ fontFamily: T.data, fontSize: 12, color: T.mut2 }}>
            No carrier premium yet.
          </span>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              width: "100%",
            }}
          >
            {carriers.map((c) => (
              <div key={c.carrierId} style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: T.data,
                    fontSize: 12,
                    lineHeight: 1.2,
                    color: T.mut,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "65%",
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      color: T.ink,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {compactUsd(c.premium)}
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 6,
                    borderRadius: 3,
                    background: "rgba(0,0,0,0.45)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(c.premium / maxCarrier) * 100}%`,
                      height: "100%",
                      borderRadius: 3,
                      background: T.blue,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
