// src/features/close-kpi/components/widgets/ContactCadenceWidget.tsx

import React from "react";
import { Repeat, Phone, Mail, MessageSquare } from "lucide-react";
import type { ContactCadenceResult } from "../../types/close-kpi.types";

interface ContactCadenceWidgetProps {
  data: ContactCadenceResult;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

export const ContactCadenceWidget: React.FC<ContactCadenceWidgetProps> = ({
  data,
}) => {
  const {
    avgGapHours,
    medianGapHours,
    totalLeads,
    leadsMultiTouch,
    totalTouches,
    avgTouchesPerLead,
    touchDistribution,
    channelMix,
  } = data;

  const maxTouchDist = Math.max(...touchDistribution.map((d) => d.leads), 1);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Contact Cadence
          </span>
        </div>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Avg Gap
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {formatHours(avgGapHours)}
          </p>
        </div>
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Median Gap
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {formatHours(medianGapHours)}
          </p>
        </div>
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Avg Touches
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {avgTouchesPerLead}
          </p>
        </div>
      </div>

      {/* Touch distribution */}
      <div className="flex-1 space-y-0.5">
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Touches per Lead
        </p>
        {touchDistribution.map((d) => (
          <div key={d.touches} className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              {d.touches}×
            </span>
            <div className="flex-1">
              <div
                className="h-3 rounded-sm bg-foreground/60"
                style={{
                  width: `${(d.leads / maxTouchDist) * 100}%`,
                  minWidth: d.leads > 0 ? "2px" : "0",
                }}
              />
            </div>
            <span className="w-10 text-right font-mono text-[10px] text-foreground">
              {d.leads} leads
            </span>
          </div>
        ))}
      </div>

      {/* Channel mix */}
      {channelMix && channelMix.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border/40 pt-1">
          <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mix
          </span>
          {channelMix.map((ch) => {
            const icon =
              ch.channel === "call" ? (
                <Phone className="h-2.5 w-2.5" />
              ) : ch.channel === "email" ? (
                <Mail className="h-2.5 w-2.5" />
              ) : (
                <MessageSquare className="h-2.5 w-2.5" />
              );
            return (
              <span
                key={ch.channel}
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
              >
                {icon}
                <span className="font-mono font-semibold text-foreground">
                  {ch.count}
                </span>
                <span className="text-[9px]">({ch.pct}%)</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>{totalLeads} leads</span>
        <span>{leadsMultiTouch} multi-touch</span>
        <span>{totalTouches} touches</span>
      </div>
    </div>
  );
};
