// src/features/kpi/components/dashboard/SectionCap.tsx
// A Board section header: mono Cap title + one-line "what this tells you"
// subtitle, with an optional right-aligned slot (e.g. a "best window" Pill or a
// provenance count). Keeps every dashboard band's heading consistent.

import React from "react";
import { Cap, T } from "@/components/board";

interface SectionCapProps {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}

export function SectionCap({ title, subtitle, right }: SectionCapProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div>
        <Cap>{title}</Cap>
        <div
          style={{
            font: `500 12.5px ${T.data}`,
            color: T.mut,
            marginTop: 5,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      </div>
      {right != null && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}
