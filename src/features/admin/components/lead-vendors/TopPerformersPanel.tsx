// src/features/admin/components/lead-vendors/TopPerformersPanel.tsx

import { useMemo } from "react";
import { Trophy, Award, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent, formatNumber } from "@/lib/format";
import type { LeadPackRow } from "@/types/lead-purchase.types";
import type { VendorIntelligenceRow } from "./LeadIntelligenceDashboard";

interface TopPerformersPanelProps {
  filteredPacks: LeadPackRow[];
  vendorIntelligenceRows: VendorIntelligenceRow[];
}

const roiColor = (roi: number) =>
  roi > 0 ? "text-success" : roi < 0 ? "text-destructive" : "text-v2-ink-muted";

export function TopPerformersPanel({
  filteredPacks,
  vendorIntelligenceRows,
}: TopPerformersPanelProps) {
  // Best converting vendor
  const bestVendor = useMemo(() => {
    const candidates = vendorIntelligenceRows.filter((v) => v.totalLeads > 0);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, v) =>
      v.conversionRate > best.conversionRate ? v : best,
    );
  }, [vendorIntelligenceRows]);

  // Top agents by policies sold
  const topAgents = useMemo(() => {
    const agentMap = new Map<
      string,
      { name: string; policies: number; leads: number }
    >();
    for (const p of filteredPacks) {
      let entry = agentMap.get(p.agentId);
      if (!entry) {
        entry = { name: p.agentName, policies: 0, leads: 0 };
        agentMap.set(p.agentId, entry);
      }
      entry.policies += p.policiesSold;
      entry.leads += p.leadCount;
    }
    return Array.from(agentMap.values())
      .filter((a) => a.policies > 0)
      .sort((a, b) => b.policies - a.policies)
      .slice(0, 5)
      .map((a) => ({
        ...a,
        convRate: a.leads > 0 ? (a.policies / a.leads) * 100 : 0,
      }));
  }, [filteredPacks]);

  // Top vendors by ROI
  const topVendors = useMemo(() => {
    return vendorIntelligenceRows
      .filter((v) => v.totalPolicies > 0)
      .sort((a, b) => b.avgRoi - a.avgRoi)
      .slice(0, 5);
  }, [vendorIntelligenceRows]);

  // Top packs by ROI
  const topPacks = useMemo(() => {
    return filteredPacks
      .filter((p) => p.policiesSold > 0)
      .sort((a, b) => b.roiPercentage - a.roiPercentage)
      .slice(0, 5);
  }, [filteredPacks]);

  const hasData =
    topAgents.length > 0 || topVendors.length > 0 || topPacks.length > 0;

  if (!hasData) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="flex items-center justify-center h-[100px] text-[11px] text-v2-ink-subtle">
          No performance data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      {/* Best Converting Vendor Callout */}
      {bestVendor && (
        <div className="mb-3 rounded-md bg-success/10 border border-success/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Trophy className="h-3 w-3 text-success" />
            <span className="text-[9px] uppercase text-success font-semibold tracking-wider">
              Best Converting Vendor
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-v2-ink">
              {bestVendor.vendorName}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-success">
                {formatPercent(bestVendor.conversionRate)} conv
              </span>
              <span className="text-[10px] text-v2-ink-subtle">
                {formatNumber(bestVendor.totalPolicies)}/
                {formatNumber(bestVendor.totalLeads)} leads
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3-column ranked lists */}
      <div className="grid grid-cols-3 gap-3">
        {/* Top Agents */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <Award className="h-3 w-3 text-info" />
            <span className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider">
              Top Agents
            </span>
          </div>
          {topAgents.length === 0 ? (
            <div className="text-[10px] text-v2-ink-subtle py-2">No data</div>
          ) : (
            <div className="space-y-1">
              {topAgents.map((agent, i) => (
                <RankedItem
                  key={agent.name}
                  rank={i + 1}
                  name={agent.name}
                  primary={`${formatNumber(agent.policies)} policies`}
                  secondary={`${formatPercent(agent.convRate)} conv`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Top Vendors by ROI */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <Star className="h-3 w-3 text-warning" />
            <span className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider">
              Top Vendors (ROI)
            </span>
          </div>
          {topVendors.length === 0 ? (
            <div className="text-[10px] text-v2-ink-subtle py-2">No data</div>
          ) : (
            <div className="space-y-1">
              {topVendors.map((vendor, i) => (
                <RankedItem
                  key={vendor.vendorId}
                  rank={i + 1}
                  name={vendor.vendorName}
                  primary={formatPercent(vendor.avgRoi) + " ROI"}
                  primaryColor={roiColor(vendor.avgRoi)}
                  secondary={`${formatNumber(vendor.totalPolicies)} policies`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Top Packs by ROI */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <Star className="h-3 w-3 text-info" />
            <span className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider">
              Top Packs (ROI)
            </span>
          </div>
          {topPacks.length === 0 ? (
            <div className="text-[10px] text-v2-ink-subtle py-2">No data</div>
          ) : (
            <div className="space-y-1">
              {topPacks.map((pack, i) => (
                <RankedItem
                  key={pack.packId}
                  rank={i + 1}
                  name={`${pack.vendorName}${pack.purchaseName ? ` \u2022 ${pack.purchaseName}` : ""}`}
                  primary={formatPercent(pack.roiPercentage) + " ROI"}
                  primaryColor={roiColor(pack.roiPercentage)}
                  secondary={`${formatNumber(pack.policiesSold)} policies`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RankedItem({
  rank,
  name,
  primary,
  primaryColor,
  secondary,
}: {
  rank: number;
  name: string;
  primary: string;
  primaryColor?: string;
  secondary: string;
}) {
  return (
    <div className="flex items-start gap-1.5 py-0.5">
      <span className="text-[10px] font-semibold text-v2-ink-subtle w-3 flex-shrink-0 text-right">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-subtle truncate">
            {name}
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold flex-shrink-0",
              primaryColor || "text-v2-ink-muted",
            )}
          >
            {primary}
          </span>
        </div>
        <span className="text-[9px] text-v2-ink-subtle">{secondary}</span>
      </div>
    </div>
  );
}
