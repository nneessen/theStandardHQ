// src/features/messages/components/unified/atoms/ReadReceipt.tsx
// `.rcpt` — last outbound delivery status. Inbound-latest threads render nothing.
// States per the handoff: sent · delivered · opened · clicked · replied.

import {
  Check,
  CheckCheck,
  CornerUpLeft,
  MousePointerClick,
} from "lucide-react";
import { T } from "@/components/board/tokens";

export type Receipt =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | null;

const MAP = {
  sent: { Icon: Check, color: T.mut2, word: "Sent" },
  delivered: { Icon: CheckCheck, color: T.mut, word: "Delivered" },
  opened: { Icon: CheckCheck, color: T.blue, word: "Opened" },
  clicked: { Icon: MousePointerClick, color: T.green, word: "Clicked" },
  replied: { Icon: CornerUpLeft, color: T.mut, word: "Replied" },
} as const;

export function ReadReceipt({ state }: { state: Receipt }) {
  if (!state) return null;
  const { Icon, color, word } = MAP[state];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color,
        font: `700 10px ${T.mono}`,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      <Icon size={12} strokeWidth={2.4} />
      {word}
    </span>
  );
}
