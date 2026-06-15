// src/features/messages/components/unified/atoms/LabelTag.tsx
// `.lab` — Space-Mono uppercase status tag, radius 6, accent-tinted by meaning.
// Color map per the handoff: Quote/Scheduling→blue, New lead→violet,
// Underwriting→amber, Approved/Won/Servicing→green, Question/default→mut.

import { T } from "@/components/board/tokens";
import { type AccentTone, tint, toneColor } from "./tint";

const NAME_TONE: Record<string, AccentTone> = {
  quote: "blue",
  scheduling: "blue",
  "new lead": "violet",
  lead: "violet",
  underwriting: "amber",
  approved: "green",
  won: "green",
  servicing: "green",
  question: "mut",
};

/** Map a real label name to its semantic tone (defaults to muted). */
export function labelTone(name: string): AccentTone {
  return NAME_TONE[name.trim().toLowerCase()] ?? "mut";
}

interface LabelTagProps {
  children: React.ReactNode;
  tone?: AccentTone;
}

export function LabelTag({ children, tone = "mut" }: LabelTagProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        font: `700 10.5px ${T.mono}`,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: toneColor(tone),
        background: tint(tone, 0.14),
        boxShadow: `inset 0 0 0 1px ${tint(tone, 0.22)}`,
        borderRadius: 6,
        padding: "2px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
