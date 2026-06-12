// src/features/call-reviews/components/scripts/GeneratedScriptView.tsx
// Pure renderer of a generated master script (kpi_call_scripts.script_body).
// Mirrors CallAnalysisPanel's Section/card styling. Every annotation the model
// is billed to produce is rendered here — dropping one means paying for hidden
// output (see plan: under-rendering risk).

import {
  BookOpen,
  Lightbulb,
  MessageSquareWarning,
  Pause,
  Tag,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GeneratedScript, ScriptPhase, ScriptStep } from "../../types";

interface GeneratedScriptViewProps {
  script: GeneratedScript;
  /** id → label for the IMO word-track library (chips resolve via this). */
  wordTrackMap: Map<string, string>;
}

const KIND_LABEL: Record<string, string> = {
  say: "Say",
  ask: "Ask",
  do: "Do",
  transition: "Next",
};

export function GeneratedScriptView({
  script,
  wordTrackMap,
}: GeneratedScriptViewProps) {
  const phases = Array.isArray(script.phases) ? script.phases : [];
  const principles = script.key_principles ?? [];
  const placeholders = script.placeholders_used ?? [];

  return (
    <div className="space-y-4">
      {script.summary && (
        <div className="rounded-lg border border-v2-ring bg-v2-canvas/60 p-3">
          <p className="text-xs text-v2-ink leading-relaxed">
            {script.summary}
          </p>
        </div>
      )}

      {principles.length > 0 && (
        <div className="rounded-lg border border-v2-ring bg-v2-card p-3">
          <div className="flex items-center gap-1.5 mb-1.5 text-v2-ink-muted">
            <Lightbulb className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-semibold uppercase tracking-wide">
              Key principles
            </h4>
          </div>
          <ul className="space-y-1">
            {principles.map((p, i) => (
              <li key={i} className="text-[11px] text-v2-ink flex gap-1.5">
                <span className="text-v2-ink-subtle">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {phases.map((phase, i) => (
          <PhaseCard
            key={i}
            phase={phase}
            index={i}
            wordTrackMap={wordTrackMap}
          />
        ))}
      </div>

      {placeholders.length > 0 && (
        <div className="rounded-lg border border-v2-ring bg-v2-canvas/60 p-3">
          <p className="text-[10px] uppercase tracking-wide text-v2-ink-subtle mb-1.5">
            Fill in the blanks
          </p>
          <div className="flex flex-wrap gap-1">
            {placeholders.map((ph, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-mono text-v2-ink-muted"
              >
                {ph}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseCard({
  phase,
  index,
  wordTrackMap,
}: {
  phase: ScriptPhase;
  index: number;
  wordTrackMap: Map<string, string>;
}) {
  const steps = Array.isArray(phase.steps) ? phase.steps : [];
  const meta: string[] = [];
  // Treat 0 as "unknown" — a "~0 min" / "0%" header is meaningless noise.
  if (phase.est_minutes != null && phase.est_minutes > 0)
    meta.push(`~${phase.est_minutes} min`);
  if (phase.call_pct != null && phase.call_pct > 0)
    meta.push(`${phase.call_pct}%`);

  return (
    <div className="rounded-xl border border-v2-ring bg-v2-card overflow-hidden">
      <div className="border-b border-v2-ring bg-v2-canvas/40 px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <BookOpen className="h-3.5 w-3.5 text-v2-ink-subtle" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink">
            {index + 1}. {phase.title}
          </span>
          {meta.length > 0 && (
            <span className="text-[10px] font-mono tabular-nums text-v2-ink-subtle">
              {meta.join(" · ")}
            </span>
          )}
        </div>
        {phase.goal && (
          <p className="text-[11px] text-v2-ink-muted italic mt-0.5">
            {phase.goal}
          </p>
        )}
        {phase.tonality && (
          <p className="text-[10px] text-v2-ink-subtle mt-0.5 flex items-center gap-1">
            <Volume2 className="h-3 w-3" />
            {phase.tonality}
          </p>
        )}
      </div>
      <div className="p-2.5 space-y-2">
        {steps.map((step, i) => (
          <StepCard key={i} step={step} wordTrackMap={wordTrackMap} />
        ))}
      </div>
    </div>
  );
}

function StepCard({
  step,
  wordTrackMap,
}: {
  step: ScriptStep;
  wordTrackMap: Map<string, string>;
}) {
  const kindLabel = KIND_LABEL[step.kind] ?? "Say";
  const mainText = step.kind === "do" ? step.do : step.say;
  const extraDo = step.kind !== "do" && step.do ? step.do : "";
  const chips = (step.word_track_ids ?? [])
    .map((id) => wordTrackMap.get(id))
    .filter((label): label is string => !!label);
  const objections = step.objections ?? [];

  return (
    <div className="rounded-lg border border-v2-ring bg-v2-canvas/60 p-3 space-y-1.5">
      <div className="flex items-start gap-2">
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 mt-0.5 shrink-0 uppercase"
        >
          {kindLabel}
        </Badge>
        <p className="text-xs text-v2-ink leading-relaxed flex-1">{mainText}</p>
      </div>

      {step.delivery_note && (
        <p className="text-[11px] italic text-v2-ink-muted pl-0.5">
          {step.delivery_note}
        </p>
      )}

      {(step.tonality || step.pause_cue) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {step.tonality && (
            <span className="inline-flex items-center gap-1 text-[10px] text-v2-ink-subtle">
              <Volume2 className="h-3 w-3" />
              {step.tonality}
            </span>
          )}
          {step.pause_cue && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 text-amber-600 border-amber-300 inline-flex items-center gap-0.5"
            >
              <Pause className="h-2.5 w-2.5" />
              {step.pause_cue}
            </Badge>
          )}
        </div>
      )}

      {extraDo && (
        <p className="text-[11px] text-v2-ink-muted">
          <span className="uppercase text-[9px] tracking-wide text-v2-ink-subtle mr-1">
            Do
          </span>
          {extraDo}
        </p>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((label, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-[9px] px-1 py-0 inline-flex items-center gap-0.5 text-v2-ink-muted"
            >
              <Tag className="h-2.5 w-2.5" />
              {label}
            </Badge>
          ))}
        </div>
      )}

      {step.why_it_works && (
        <p className="text-[10px] text-v2-ink-muted">
          <span className="font-medium text-v2-ink-subtle">Why it works: </span>
          {step.why_it_works}
        </p>
      )}

      {objections.length > 0 && (
        <div className="border-t border-v2-ring/60 pt-1.5 space-y-1.5">
          {objections.map((o, i) => (
            <div key={i}>
              <div className="flex items-start gap-1 flex-wrap">
                <MessageSquareWarning className="h-3 w-3 mt-0.5 text-amber-600 shrink-0" />
                <span className="text-[11px] text-v2-ink italic">
                  “{o.objection}”
                </span>
                {o.type && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 capitalize"
                  >
                    {o.type.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-v2-ink-muted mt-0.5 pl-4">
                → {o.rebuttal}
              </p>
              {o.tonality && (
                <p className="text-[10px] text-v2-ink-subtle italic pl-4">
                  {o.tonality}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
