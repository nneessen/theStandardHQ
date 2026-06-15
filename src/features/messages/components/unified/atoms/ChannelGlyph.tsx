// src/features/messages/components/unified/atoms/ChannelGlyph.tsx
// Inline channel identifier — replaces avatars across the unified feed.
// Email = blue mail glyph, Instagram = violet camera glyph. No container.

import { Instagram, Mail } from "lucide-react";
import { T } from "@/components/board/tokens";

export type Channel = "email" | "instagram";

interface ChannelGlyphProps {
  channel: Channel;
  size?: number;
}

export function ChannelGlyph({ channel, size = 15 }: ChannelGlyphProps) {
  const Icon = channel === "email" ? Mail : Instagram;
  const color = channel === "email" ? T.blue : T.violet;
  return (
    <Icon
      size={size}
      strokeWidth={2}
      style={{ color, flexShrink: 0 }}
      aria-label={channel === "email" ? "Email" : "Instagram"}
    />
  );
}
