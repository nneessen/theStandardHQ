// src/features/analytics/board/inbound/CallGeographyPanel.tsx
// Where inbound callers convert — closing rate by caller state (top 10 by
// call volume; byState is pre-ranked by closing rate).
import { useKpiCallAnalytics } from "@/features/kpi";
import { CallBoard, BarRow, BarStack } from "./shared";
import { closingTone, useInboundCallRange } from "./utils";

export function CallGeographyPanel() {
  const range = useInboundCallRange();
  const { data, isLoading } = useKpiCallAnalytics(range);
  const byState = data?.byState ?? [];
  // Top states by volume so low-n outliers don't dominate the ranked list.
  const top = [...byState].sort((a, b) => b.calls - a.calls).slice(0, 10);

  return (
    <CallBoard
      eyebrow="Geography"
      title="Caller geography"
      subtitle="Closing rate by state"
      isLoading={isLoading}
      isEmpty={byState.length === 0}
    >
      <BarStack>
        {top.map((s) => (
          <BarRow
            key={s.state}
            label={s.state}
            valueText={`${s.closingRate.toFixed(0)}% · ${s.calls}`}
            pct={s.closingRate / 100}
            tone={closingTone(s.closingRate)}
          />
        ))}
      </BarStack>
    </CallBoard>
  );
}
