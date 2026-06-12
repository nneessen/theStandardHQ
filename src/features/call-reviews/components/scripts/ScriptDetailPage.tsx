// src/features/call-reviews/components/scripts/ScriptDetailPage.tsx
// One call type's AI master script. Renders the annotated phases (read-only),
// shows freshness (generated date + source-call count), and — for admins — a
// Regenerate action. A failed REFRESH that still has a prior body shows a
// non-destructive banner above the previous script (never a broken state).

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Printer,
  AlertTriangle,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImo } from "@/contexts/ImoContext";
import { useCallScripts } from "../../hooks/useCallScripts";
import {
  useGeneratedScript,
  useGenerateCallScript,
} from "../../hooks/useCallScriptsLibrary";
import { isScriptSettling, type GeneratedScript } from "../../types";
import { GeneratedScriptView } from "./GeneratedScriptView";

interface ScriptDetailPageProps {
  callTypeId: string;
}

export function ScriptDetailPage({ callTypeId }: ScriptDetailPageProps) {
  const { isImoAdmin, isSuperAdmin } = useImo();
  const canGenerate = isImoAdmin || isSuperAdmin;

  const { data: row, isLoading } = useGeneratedScript(callTypeId);
  const { data: wordTracks = [] } = useCallScripts();
  const generate = useGenerateCallScript();
  const [copied, setCopied] = useState(false);

  const wordTrackMap = useMemo(
    () => new Map(wordTracks.map((w) => [w.id, w.label])),
    [wordTracks],
  );

  const settling = isScriptSettling(row);
  const body = row?.script_body ?? null;
  const callTypeName =
    row?.call_type?.name ?? body?.call_type ?? "Sales script";
  const failedRefresh = row?.status === "failed" && body != null;

  const handleCopy = async () => {
    if (!body) return;
    try {
      await navigator.clipboard.writeText(flattenScript(callTypeName, body));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 space-y-4 print:max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <Link
            to="/call-reviews/scripts"
            className="inline-flex items-center gap-1 text-[11px] text-v2-ink-muted hover:text-v2-ink mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All scripts
          </Link>
          <h1 className="text-sm font-semibold text-v2-ink truncate">
            {callTypeName}
          </h1>
          {row && (
            <p className="text-[11px] text-v2-ink-muted">
              {row.generated_at
                ? `Generated ${new Date(row.generated_at).toLocaleDateString()}`
                : "Not generated yet"}
              {row.source_call_count != null &&
                ` · from ${row.source_call_count} sold call${
                  row.source_call_count === 1 ? "" : "s"
                }`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {body && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => window.print()}
              >
                <Printer className="h-3 w-3 mr-1" />
                Print
              </Button>
            </>
          )}
          {canGenerate && (
            <Button
              size="sm"
              variant={body ? "ghost" : "default"}
              className="h-7 text-[11px]"
              disabled={settling || generate.isPending}
              onClick={() => generate.mutate(callTypeId)}
            >
              {settling ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {body ? "Regenerate" : "Generate"}
            </Button>
          )}
        </div>
      </div>

      {/* Failed-refresh banner (prior body stays visible below) */}
      {failedRefresh && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2 print:hidden">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800">
            Last refresh failed
            {row?.generation_error ? `: ${row.generation_error}` : "."} Showing
            the previous script.
          </p>
        </div>
      )}

      {/* Body / states */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
        </div>
      ) : body ? (
        <GeneratedScriptView script={body} wordTrackMap={wordTrackMap} />
      ) : settling ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-v2-ink-subtle" />
          <p className="text-xs text-v2-ink-muted max-w-sm">
            Generating the master script from your sold calls — this can take up
            to a minute.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
          <ScrollText className="h-6 w-6 text-v2-ink-subtle" />
          <p className="text-xs text-v2-ink-muted max-w-sm">
            {row?.status === "failed"
              ? (row.generation_error ??
                "Generation failed. Try again once this type has more analyzed sold calls.")
              : canGenerate
                ? "No script yet. Generate one once this call type has at least 3 analyzed sold calls."
                : "No script has been generated for this call type yet."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Flatten a script to plain text for clipboard / paste-into-doc. */
function flattenScript(callTypeName: string, s: GeneratedScript): string {
  const out: string[] = [callTypeName.toUpperCase()];
  if (s.summary) out.push("", s.summary);
  if (s.key_principles?.length) {
    out.push("", "KEY PRINCIPLES");
    for (const p of s.key_principles) out.push(`- ${p}`);
  }
  for (const [i, phase] of (s.phases ?? []).entries()) {
    const meta = [
      phase.est_minutes != null ? `~${phase.est_minutes} min` : null,
      phase.call_pct != null ? `${phase.call_pct}%` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    out.push("", `PHASE ${i + 1}. ${phase.title}${meta ? ` (${meta})` : ""}`);
    if (phase.goal) out.push(`Goal: ${phase.goal}`);
    if (phase.tonality) out.push(`Tone: ${phase.tonality}`);
    for (const step of phase.steps ?? []) {
      const main = step.kind === "do" ? step.do : step.say;
      out.push(`  ${step.kind.toUpperCase()}: ${main}`);
      if (step.delivery_note) out.push(`    (${step.delivery_note})`);
      const cues = [
        step.tonality ? `tone: ${step.tonality}` : null,
        step.pause_cue,
      ]
        .filter(Boolean)
        .join(" · ");
      if (cues) out.push(`    [${cues}]`);
      if (step.kind !== "do" && step.do) out.push(`    DO: ${step.do}`);
      if (step.why_it_works) out.push(`    Why: ${step.why_it_works}`);
      for (const o of step.objections ?? []) {
        out.push(`    Objection: "${o.objection}" → ${o.rebuttal}`);
      }
    }
  }
  if (s.placeholders_used?.length) {
    out.push("", `Placeholders: ${s.placeholders_used.join(", ")}`);
  }
  return out.join("\n");
}
