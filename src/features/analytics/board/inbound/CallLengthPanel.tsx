// src/features/analytics/board/inbound/CallLengthPanel.tsx
// Call-length distribution: how calls spread across duration buckets and how
// each bucket converts. Bar = share of calls in the bucket.
import { useKpiCallAnalytics } from "@/features/kpi";
import { CallBoard, BarRow, BarStack } from "./shared";
import { closingTone, useInboundCallRange } from "./utils";

export function CallLengthPanel() {
  const range = useInboundCallRange();
  const { data, isLoading } = useKpiCallAnalytics(range);
  const buckets = data?.byLengthBucket ?? [];
  const totalWithDuration = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <CallBoard
      eyebrow="Call Length"
      title="Call length"
      subtitle="Duration mix & conversion"
      isLoading={isLoading}
      isEmpty={totalWithDuration === 0}
    >
      <BarStack>
        {buckets.map((b) => (
          <BarRow
            key={b.label}
            label={b.label}
            valueText={`${b.count} · ${b.closingRate.toFixed(0)}%`}
            pct={totalWithDuration > 0 ? b.count / totalWithDuration : 0}
            tone={closingTone(b.closingRate)}
          />
        ))}
      </BarStack>
    </CallBoard>
  );
}
