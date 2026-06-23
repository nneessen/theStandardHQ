// src/features/analytics/tabs/CoachingTab.tsx
// Script coaching: which phrases lift close rate, plus the Word Tracks library
// that feeds the AI-generated Sales Scripts. Each track is badged with how many
// master scripts cite it, and links run both ways (here → Scripts, Scripts →
// here) so the phrase library and the scripts that use it feel like one tool.

import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import {
  WordTrackForm,
  WordTrackLibrary,
  useKpiIdentity,
} from "@/features/kpi";
import {
  useGeneratedScripts,
  buildWordTrackScriptUsage,
} from "@/features/call-reviews";
import { ROW_1 } from "./grid";
import { WordTrackEffectivenessPanel, PlainCell } from "./panels";

export function CoachingTab() {
  const { imoId } = useKpiIdentity();
  const { data: scripts = [] } = useGeneratedScripts(imoId ?? undefined);
  const scriptUsage = useMemo(
    () => buildWordTrackScriptUsage(scripts),
    [scripts],
  );

  return (
    <>
      {/* Word-track effectiveness — lift vs baseline, from analyzed recordings */}
      <div className={ROW_1}>
        <PlainCell minHeight={240}>
          <WordTrackEffectivenessPanel />
        </PlainCell>
      </div>

      {/* Word Tracks library — the phrases the AI scripts are built from */}
      <div className="rounded-xl border border-v2-ring bg-v2-card p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-v2-ink">Word Tracks</h2>
            <p className="text-[11px] text-v2-ink-muted">
              The phrases your team tracks on calls. Sales Scripts are built
              from these — each row shows how many scripts use it.
            </p>
          </div>
          <Link
            to="/call-reviews/scripts"
            className="inline-flex flex-shrink-0 items-center gap-1.5 text-[11px] font-medium text-v2-ink-muted hover:text-v2-ink"
          >
            <ScrollText className="h-3.5 w-3.5" />
            Open Sales Scripts →
          </Link>
        </div>
        <div className="space-y-3">
          <WordTrackForm />
          <WordTrackLibrary scriptUsage={scriptUsage} />
        </div>
      </div>
    </>
  );
}
