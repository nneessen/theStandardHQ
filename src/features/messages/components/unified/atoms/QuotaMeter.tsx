// src/features/messages/components/unified/atoms/QuotaMeter.tsx
// `.qm` — send-pace track. Solid blue fill = sent/cap, 45° striped segment =
// scheduled/cap. Fill flips to amber when within 10% of the cap (near-limit warn).

import { T } from "@/components/board/tokens";
import { tint } from "./tint";

interface QuotaMeterProps {
  sent: number;
  cap: number;
  scheduled?: number;
  height?: number;
}

export function QuotaMeter({
  sent,
  cap,
  scheduled = 0,
  height = 7,
}: QuotaMeterProps) {
  const fillPct = cap > 0 ? Math.min(100, (sent / cap) * 100) : 0;
  const schedPct =
    cap > 0 ? Math.min(Math.max(0, 100 - fillPct), (scheduled / cap) * 100) : 0;
  const nearLimit = cap > 0 && sent / cap >= 0.9;

  return (
    <div
      style={{
        height,
        borderRadius: 99,
        background: "rgba(255,255,255,0.08)",
        display: "flex",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          width: `${fillPct}%`,
          background: nearLimit
            ? `linear-gradient(90deg, ${T.amber}, #f7c869)`
            : `linear-gradient(90deg, ${T.blue}, #7cb0ff)`,
        }}
      />
      <div
        style={{
          width: `${schedPct}%`,
          backgroundImage: `repeating-linear-gradient(45deg, ${tint(
            "blue",
            0.55,
          )} 0 4px, ${tint("blue", 0.12)} 4px 8px)`,
        }}
      />
    </div>
  );
}
