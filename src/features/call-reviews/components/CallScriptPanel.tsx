// src/features/call-reviews/components/CallScriptPanel.tsx
// Read-only reference of the team/IMO word-track "scripts" agents should study,
// grouped by category, shown beside the transcript on the review page.

import { Loader2, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  WORD_TRACK_CATEGORY_OPTIONS,
  WORD_TRACK_TIMING_OPTIONS,
  type WordTrackRow,
} from "@/features/kpi";

interface CallScriptPanelProps {
  scripts: WordTrackRow[];
  isLoading: boolean;
}

const CATEGORY_LABEL = new Map<string, string>(
  WORD_TRACK_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);
const TIMING_LABEL = new Map<string, string>(
  WORD_TRACK_TIMING_OPTIONS.map((o) => [o.value, o.label]),
);

export function CallScriptPanel({ scripts, isLoading }: CallScriptPanelProps) {
  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }
  if (scripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <ScrollText className="h-6 w-6 text-v2-ink-subtle mb-2" />
        <p className="text-xs text-v2-ink-muted max-w-sm">
          No shared scripts yet. Team/IMO word tracks added in Call KPIs appear
          here as a study reference next to the transcript.
        </p>
      </div>
    );
  }

  // Group by category, preserving the canonical category order.
  const byCategory = new Map<string, WordTrackRow[]>();
  for (const s of scripts) {
    const arr = byCategory.get(s.category) ?? [];
    arr.push(s);
    byCategory.set(s.category, arr);
  }
  const orderedCategories = WORD_TRACK_CATEGORY_OPTIONS.map(
    (o) => o.value,
  ).filter((c) => byCategory.has(c));

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
      {orderedCategories.map((cat) => (
        <div key={cat}>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted mb-1.5">
            {CATEGORY_LABEL.get(cat) ?? cat}
          </h4>
          <div className="space-y-1.5">
            {(byCategory.get(cat) ?? []).map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-v2-ring bg-v2-card px-2.5 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-v2-ink flex-1">
                    {s.label}
                  </p>
                  {s.expected_timing && s.expected_timing !== "any" && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {TIMING_LABEL.get(s.expected_timing) ?? s.expected_timing}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-v2-ink-muted mt-0.5 leading-relaxed">
                  {s.phrase}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
