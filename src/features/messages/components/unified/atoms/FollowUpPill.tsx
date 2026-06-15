// src/features/messages/components/unified/atoms/FollowUpPill.tsx
// `.fup` / `.fup.over` — amber when due, red when overdue. The compact variant
// (used in the rail) shows just the relative time; the full variant labels it.

import { Clock } from "lucide-react";
import { T } from "@/components/board/tokens";
import { tint, toneColor } from "./tint";

export type FollowUpState = "due" | "over";

interface FollowUpPillProps {
  state: FollowUpState;
  when?: string;
  compact?: boolean;
}

export function FollowUpPill({
  state,
  when,
  compact = false,
}: FollowUpPillProps) {
  const tone = state === "over" ? "red" : "amber";
  const text = compact
    ? (when ?? (state === "over" ? "Overdue" : "Due"))
    : state === "over"
      ? "Follow-up overdue"
      : `Follow up · ${when ?? "soon"}`;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        font: `700 10px ${T.mono}`,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: toneColor(tone),
        background: tint(tone, 0.13),
        boxShadow: `inset 0 0 0 1px ${tint(tone, 0.26)}`,
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <Clock size={11} strokeWidth={2.4} />
      {text}
    </span>
  );
}
