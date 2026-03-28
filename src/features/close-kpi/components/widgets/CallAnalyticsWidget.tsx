// src/features/close-kpi/components/widgets/CallAnalyticsWidget.tsx

import React from "react";
import { Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import type { CallAnalyticsResult } from "../../types/close-kpi.types";

interface CallAnalyticsWidgetProps {
  data: CallAnalyticsResult;
}

export const CallAnalyticsWidget: React.FC<CallAnalyticsWidgetProps> = ({
  data,
}) => {
  const {
    total,
    answered,
    voicemail,
    missed,
    inbound,
    outbound,
    connectRate,
    totalDurationMin,
    avgDurationMin,
  } = data;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Primary stat */}
      <div className="flex items-baseline gap-2">
        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-2xl font-bold text-foreground">
          {total.toLocaleString()}
        </span>
        <span className="text-[10px] text-muted-foreground">calls</span>
      </div>

      {/* Disposition breakdown */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Answered
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {answered}
          </p>
        </div>
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Voicemail
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {voicemail}
          </p>
        </div>
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Missed
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {missed}
          </p>
        </div>
      </div>

      {/* Direction + rate */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <PhoneOutgoing className="h-2.5 w-2.5" />
          {outbound} out
        </span>
        <span className="flex items-center gap-0.5">
          <PhoneIncoming className="h-2.5 w-2.5" />
          {inbound} in
        </span>
        <span className="ml-auto font-mono font-semibold text-foreground">
          {connectRate}% connect
        </span>
      </div>

      {/* Duration */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>{totalDurationMin.toLocaleString()} min total</span>
        <span>{avgDurationMin} min avg</span>
      </div>

      {data.isTruncated && (
        <p className="text-[9px] text-muted-foreground/60">
          Data limited to first 2,000 calls
        </p>
      )}
    </div>
  );
};
