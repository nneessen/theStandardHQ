// src/features/messages/components/unified/atoms/FeedChip.tsx
// `.chips` — feed filter chip. Active = blue text + blue tint bg + blue border.
// Optional leading dot (blue=Email, violet=Instagram) and trailing mono count.

import { T } from "@/components/board/tokens";
import { tint } from "./tint";

interface FeedChipProps {
  children: React.ReactNode;
  active?: boolean;
  count?: number;
  dot?: "blue" | "violet";
  onClick?: () => void;
}

export function FeedChip({
  children,
  active = false,
  count,
  dot,
  onClick,
}: FeedChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        font: `700 12.5px ${T.data}`,
        color: active ? T.blue : T.mut,
        background: active ? tint("blue", 0.14) : T.surface2,
        border: `1px solid ${active ? tint("blue", 0.4) : T.line}`,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "color .12s, background .12s, border-color .12s",
      }}
    >
      {dot && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 99,
            background: dot === "blue" ? T.blue : T.violet,
            flexShrink: 0,
          }}
        />
      )}
      {children}
      {count != null && (
        <span
          style={{
            font: `700 10px ${T.mono}`,
            color: active ? T.blue : T.mut2,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
