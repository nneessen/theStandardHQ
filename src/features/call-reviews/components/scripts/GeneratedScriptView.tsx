// src/features/call-reviews/components/scripts/GeneratedScriptView.tsx
// Pure renderer of a generated master script (kpi_call_scripts.script_body).
//
// This is a read-ALOUD artifact an agent follows LIVE on a call, so:
//   • the "Say" language is the hero — large, high-contrast, one clean column;
//   • a "Call mode / Full detail" toggle folds the coaching-meta (why-it-works,
//     delivery notes, tonality, word-track chips) so the screen isn't a wall of
//     text mid-call, while keeping the live-critical bits (objection rebuttals,
//     pause cues) always visible;
//   • each section gets a distinct background so phases/steps are scannable.
// Folded meta is still emitted to the DOM as `hidden print:block` so printing a
// script always yields the full coaching version regardless of the live toggle.
// Every annotation the model is billed to produce is rendered in Full detail —
// dropping one means paying for hidden output (see plan: under-rendering risk).

import { useState } from "react";
import {
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

// Color-coded by intent so an agent can scan say-vs-ask-vs-do instantly.
// Each carries an explicit dark-mode variant (plain Tailwind palette colors do
// not auto-adapt to the dark theme).
const KIND_STYLE: Record<string, string> = {
  say: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  ask: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  do: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  transition:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
};

export function GeneratedScriptView({
  script,
  wordTrackMap,
}: GeneratedScriptViewProps) {
  // Default to Call mode: the primary use is following the script live, where
  // the coaching annotations are clutter. Full detail is for prep / print.
  const [detail, setDetail] = useState(false);

  const phases = Array.isArray(script.phases) ? script.phases : [];
  const principles = script.key_principles ?? [];
  const placeholders = script.placeholders_used ?? [];

  return (
    <div className="space-y-5">
      {/* Mode toggle — Call mode = clean lines only; Full detail = coaching */}
      <div className="flex items-center justify-end gap-2 print:hidden">
        <div className="inline-flex rounded-lg border border-v2-ring bg-v2-card p-0.5 text-sm font-medium">
          <button
            type="button"
            onClick={() => setDetail(false)}
            className={`rounded-md px-3 py-1 transition-colors ${
              !detail
                ? "bg-v2-accent text-white"
                : "text-v2-ink-muted hover:text-v2-ink"
            }`}
          >
            Call mode
          </button>
          <button
            type="button"
            onClick={() => setDetail(true)}
            className={`rounded-md px-3 py-1 transition-colors ${
              detail
                ? "bg-v2-accent text-white"
                : "text-v2-ink-muted hover:text-v2-ink"
            }`}
          >
            Full detail
          </button>
        </div>
      </div>

      {script.summary && (
        <div className="rounded-xl border border-v2-ring bg-v2-card px-5 py-4 shadow-v2-soft">
          <p className="text-base text-v2-ink leading-relaxed">
            {script.summary}
          </p>
        </div>
      )}

      {principles.length > 0 && (
        <div className="rounded-xl border border-v2-ring bg-v2-card-tinted px-5 py-4">
          <div className="flex items-center gap-2 mb-3 text-v2-accent">
            <Lightbulb className="h-4 w-4" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              Key principles
            </h4>
          </div>
          <ul className="space-y-2">
            {principles.map((p, i) => (
              <li
                key={i}
                className="text-sm text-v2-ink flex gap-2.5 leading-relaxed"
              >
                <span className="text-v2-accent font-bold mt-px">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-5">
        {phases.map((phase, i) => (
          <PhaseCard
            key={i}
            phase={phase}
            index={i}
            wordTrackMap={wordTrackMap}
            detail={detail}
          />
        ))}
      </div>

      {placeholders.length > 0 && (
        <div className="rounded-xl border border-v2-ring bg-v2-card-tinted px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-v2-ink-muted mb-2">
            Fill in the blanks
          </p>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((ph, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-xs px-2 py-0.5 font-mono text-v2-ink-muted bg-v2-card"
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
  detail,
}: {
  phase: ScriptPhase;
  index: number;
  wordTrackMap: Map<string, string>;
  detail: boolean;
}) {
  const steps = Array.isArray(phase.steps) ? phase.steps : [];
  const meta: string[] = [];
  // Treat 0 as "unknown" — a "~0 min" / "0%" header is meaningless noise.
  if (phase.est_minutes != null && phase.est_minutes > 0)
    meta.push(`~${phase.est_minutes} min`);
  if (phase.call_pct != null && phase.call_pct > 0)
    meta.push(`${phase.call_pct}%`);

  // Folded coaching-meta still prints (hidden on screen in Call mode only).
  const foldCls = detail ? "" : "hidden print:block";

  return (
    <div className="rounded-xl border border-v2-ring-strong bg-v2-card overflow-hidden shadow-v2-soft">
      {/* Accent header band — strong visual break between phases */}
      <div className="border-b border-v2-ring bg-v2-accent-soft px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-v2-accent text-white text-sm font-bold tabular-nums">
            {index + 1}
          </span>
          <h3 className="text-lg font-bold text-v2-ink leading-tight">
            {phase.title}
          </h3>
          {meta.length > 0 && (
            <span className="text-xs font-mono tabular-nums text-v2-ink-muted ml-auto">
              {meta.join(" · ")}
            </span>
          )}
        </div>
        {phase.goal && (
          <p className="text-sm text-v2-ink-muted mt-1.5 leading-relaxed">
            {phase.goal}
          </p>
        )}
        {phase.tonality && (
          <p
            className={`text-xs text-v2-ink-muted mt-1.5 flex items-center gap-1.5 font-medium ${foldCls}`}
          >
            <Volume2 className="h-3.5 w-3.5 text-v2-accent" />
            {phase.tonality}
          </p>
        )}
      </div>
      {/* Tinted body so the white step cards visibly "lift" off it */}
      <div className="bg-v2-card-tinted/60 p-3 space-y-3">
        {steps.map((step, i) => (
          <StepCard
            key={i}
            step={step}
            wordTrackMap={wordTrackMap}
            detail={detail}
          />
        ))}
      </div>
    </div>
  );
}

function StepCard({
  step,
  wordTrackMap,
  detail,
}: {
  step: ScriptStep;
  wordTrackMap: Map<string, string>;
  detail: boolean;
}) {
  const kindLabel = KIND_LABEL[step.kind] ?? "Say";
  const kindStyle = KIND_STYLE[step.kind] ?? KIND_STYLE.say;
  const mainText = step.kind === "do" ? step.do : step.say;
  const extraDo = step.kind !== "do" && step.do ? step.do : "";
  const chips = (step.word_track_ids ?? [])
    .map((id) => wordTrackMap.get(id))
    .filter((label): label is string => !!label);
  const objections = step.objections ?? [];

  // Folded coaching-meta still prints (hidden on screen in Call mode only).
  const foldCls = detail ? "" : "hidden print:block";

  return (
    <div className="rounded-lg border border-v2-ring bg-v2-card p-4 space-y-2.5 shadow-v2-soft">
      <div className="flex items-start gap-3">
        <Badge
          variant="outline"
          className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 mt-0.5 shrink-0 ${kindStyle}`}
        >
          {kindLabel}
        </Badge>
        {/* HERO: the language the agent actually reads aloud */}
        <p className="text-base text-v2-ink leading-relaxed flex-1 font-medium">
          {mainText}
        </p>
      </div>

      {/* delivery note — coaching-meta, folded in Call mode */}
      {step.delivery_note && (
        <p
          className={`text-sm italic text-v2-ink-muted leading-relaxed ${foldCls}`}
        >
          {step.delivery_note}
        </p>
      )}

      {/* pause cue is live-critical (always shown); tonality is coaching-meta */}
      {(step.pause_cue || (step.tonality && detail)) && (
        <div className="flex flex-wrap items-center gap-2 print:flex">
          {step.tonality && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs text-v2-ink-muted font-medium ${foldCls}`}
            >
              <Volume2 className="h-3.5 w-3.5 text-v2-accent" />
              {step.tonality}
            </span>
          )}
          {step.pause_cue && (
            <Badge
              variant="outline"
              className="text-[11px] px-1.5 py-0.5 text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30 inline-flex items-center gap-1 font-medium"
            >
              <Pause className="h-3 w-3" />
              {step.pause_cue}
            </Badge>
          )}
        </div>
      )}

      {/* supplementary "do" on a say/ask step — coaching-meta */}
      {extraDo && (
        <p className={`text-sm text-v2-ink-muted leading-relaxed ${foldCls}`}>
          <span className="uppercase text-[11px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-300 mr-1.5">
            Do
          </span>
          {extraDo}
        </p>
      )}

      {/* word-track chips — coaching-meta */}
      {chips.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${foldCls}`}>
          {chips.map((label, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-[11px] px-1.5 py-0.5 inline-flex items-center gap-1 text-v2-accent bg-v2-accent-soft border-v2-accent/30"
            >
              <Tag className="h-3 w-3" />
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* why it works — coaching-meta */}
      {step.why_it_works && (
        <p
          className={`text-xs text-v2-ink-muted leading-relaxed bg-v2-card-tinted/50 rounded-md px-2.5 py-1.5 ${foldCls}`}
        >
          <span className="font-semibold text-v2-ink-muted">
            Why it works:{" "}
          </span>
          {step.why_it_works}
        </p>
      )}

      {/* objections — LIVE-CRITICAL, always shown */}
      {objections.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <MessageSquareWarning className="h-3.5 w-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              If they push back
            </span>
          </div>
          {objections.map((o, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-start gap-1.5 flex-wrap">
                <span className="text-sm text-v2-ink italic font-medium">
                  “{o.objection}”
                </span>
                {o.type && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 capitalize bg-v2-card text-v2-ink-muted"
                  >
                    {o.type.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-v2-ink leading-relaxed pl-3 border-l-2 border-emerald-400 dark:border-emerald-500/50">
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold mr-1">
                  →
                </span>
                {o.rebuttal}
              </p>
              {o.tonality && (
                <p
                  className={`text-xs text-v2-ink-muted italic pl-3 ${foldCls}`}
                >
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
