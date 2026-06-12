// src/features/call-reviews/components/scripts/ScriptsLibraryPage.tsx
// The Sales Scripts library: one AI-generated master script per call type.
// All approved agents view; IMO admins / super-admins generate + regenerate.
// Call types are the primary axis so a type with no script still offers Generate
// (admins) or is hidden (agents). Rows poll while a generation is in flight.

import { Link } from "@tanstack/react-router";
import {
  ScrollText,
  Headphones,
  Sparkles,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useKpiIdentity, useActiveCallTypes } from "@/features/kpi";
import { useImo } from "@/contexts/ImoContext";
import {
  useGeneratedScripts,
  useGenerateCallScript,
} from "../../hooks/useCallScriptsLibrary";
import { isScriptSettling, type GeneratedScriptRow } from "../../types";

const ROW_GRID =
  "grid grid-cols-[1fr_130px_84px_120px_128px] gap-2 items-center";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export function ScriptsLibraryPage() {
  const { imoId } = useKpiIdentity();
  const { isImoAdmin, isSuperAdmin } = useImo();
  const canGenerate = isImoAdmin || isSuperAdmin;

  const { callTypes, isLoading: typesLoading } = useActiveCallTypes(
    imoId ?? undefined,
  );
  const { data: scripts = [], isLoading: scriptsLoading } = useGeneratedScripts(
    imoId ?? undefined,
  );
  const generate = useGenerateCallScript();

  const byType = new Map<string, GeneratedScriptRow>();
  for (const s of scripts) byType.set(s.call_type_id, s);

  // Agents only see call types that actually have a generated script; admins see
  // every active type so they can generate the missing ones.
  const rows = callTypes
    .map((ct) => ({ ct, script: byType.get(ct.id) ?? null }))
    .filter(({ script }) => canGenerate || script?.script_body != null);

  const loading = typesLoading || scriptsLoading;

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-v2-ink-subtle" />
          <div>
            <h1 className="text-sm font-semibold text-v2-ink">Sales Scripts</h1>
            <p className="text-[11px] text-v2-ink-muted">
              AI-built master scripts, synthesized from your winning (sold)
              calls — one per call type.
            </p>
          </div>
        </div>
        <Link
          to="/call-reviews"
          className="inline-flex items-center gap-1 text-[11px] text-v2-ink-muted hover:text-v2-ink"
        >
          <Headphones className="h-3.5 w-3.5" />
          Call Reviews
        </Link>
      </div>

      <div className="rounded-xl border border-v2-ring bg-v2-card shadow-sm overflow-hidden">
        {/* Column header */}
        <div
          className={`${ROW_GRID} px-3 py-2 border-b border-v2-ring bg-v2-canvas/40 text-[10px] uppercase tracking-wide text-v2-ink-subtle`}
        >
          <span>Call type</span>
          <span>Last generated</span>
          <span className="text-right">Source</span>
          <span>Status</span>
          <span className="text-right">{canGenerate ? "Action" : ""}</span>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <ScrollText className="h-6 w-6 text-v2-ink-subtle" />
            <p className="text-xs text-v2-ink-muted max-w-sm">
              {callTypes.length === 0
                ? "No call types yet. Add call types in Settings, then generate a script for each."
                : canGenerate
                  ? "No scripts yet. Generate one for a call type once it has at least 3 analyzed sold calls."
                  : "No master scripts have been generated yet. Check back soon."}
            </p>
          </div>
        ) : (
          rows.map(({ ct, script }) => {
            const settling = isScriptSettling(script);
            const hasBody = script?.script_body != null;
            return (
              <div
                key={ct.id}
                className={`${ROW_GRID} px-3 py-2 border-b border-v2-ring/60 last:border-0 hover:bg-v2-canvas/40`}
              >
                {/* Call type (link when a body exists) */}
                {hasBody ? (
                  <Link
                    to="/call-reviews/scripts/$callTypeId"
                    params={{ callTypeId: ct.id }}
                    className="flex items-center gap-1 text-xs font-medium text-v2-ink hover:underline truncate"
                  >
                    {ct.name}
                    <ChevronRight className="h-3 w-3 text-v2-ink-subtle shrink-0" />
                  </Link>
                ) : (
                  <span className="text-xs font-medium text-v2-ink truncate">
                    {ct.name}
                  </span>
                )}

                <span className="text-[11px] text-v2-ink-muted tabular-nums">
                  {formatDate(script?.generated_at ?? null)}
                </span>
                <span className="text-[11px] text-v2-ink-muted text-right tabular-nums">
                  {script?.source_call_count ? script.source_call_count : "—"}
                </span>

                {/* Status */}
                <span className="text-[11px]">
                  <StatusBadge script={script} settling={settling} />
                </span>

                {/* Action */}
                <span className="text-right">
                  {canGenerate && (
                    <Button
                      size="sm"
                      variant={hasBody ? "ghost" : "default"}
                      className="h-7 text-[11px]"
                      disabled={settling || generate.isPending}
                      onClick={() => generate.mutate(ct.id)}
                    >
                      {settling ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      {hasBody ? "Regenerate" : "Generate"}
                    </Button>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  script,
  settling,
}: {
  script: GeneratedScriptRow | null;
  settling: boolean;
}) {
  if (settling) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Generating…
      </span>
    );
  }
  if (!script) {
    return <span className="text-v2-ink-subtle">No script</span>;
  }
  if (script.status === "failed") {
    return (
      <Badge
        variant="outline"
        className="text-[9px] px-1 py-0 text-rose-600 border-rose-300"
        title={script.generation_error ?? undefined}
      >
        {script.script_body ? "Refresh failed" : "Failed"}
      </Badge>
    );
  }
  if (script.script_body) {
    return (
      <Badge
        variant="outline"
        className="text-[9px] px-1 py-0 text-emerald-600 border-emerald-300"
      >
        Ready
      </Badge>
    );
  }
  return <span className="text-v2-ink-subtle">No script</span>;
}
