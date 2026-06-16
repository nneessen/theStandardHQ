// src/features/call-reviews/components/SpeakerRoleEditor.tsx
// Per-speaker role editor. Diarization assigns numbered speakers; the automatic
// "first speaker = agent" guess is often wrong on inbound calls (an automated
// IVR/hold message frequently speaks first). This lets the reviewer assign EACH
// detected speaker to Agent / Client / Other, with a sample line so they can tell
// the voices apart. "Other" (automated/hold) is omitted from the saved map, so it
// defaults to unknown and is excluded from talk-time + word-track analysis.
// Persisting re-runs analysis so objections/word-tracks/talk-time follow the fix.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, ArrowLeftRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  roleOfSpeaker,
  type DiarizedSegment,
  type SpeakerRole,
} from "../types";

const ROLE_OPTIONS: { value: SpeakerRole; label: string }[] = [
  { value: "agent", label: "Agent" },
  { value: "client", label: "Client" },
  { value: "unknown", label: "Other / automated" },
];

interface SpeakerInfo {
  speaker: number;
  sample: string;
  lineCount: number;
}

interface Props {
  segments: DiarizedSegment[];
  roleMap: Record<string, SpeakerRole>;
  onSave: (map: Record<string, "agent" | "client">) => void;
  saving: boolean;
  onRedetect: () => void;
  redetecting: boolean;
  /** Whether the viewer may run the AI re-detect pass. When false the
   *  "Auto-detect (AI)" button is hidden (it would 403); manual role assignment +
   *  Swap stay available. */
  canUseAi?: boolean;
}

export function SpeakerRoleEditor({
  segments,
  roleMap,
  onSave,
  saving,
  onRedetect,
  redetecting,
  canUseAi = true,
}: Props) {
  const speakers = useMemo<SpeakerInfo[]>(() => {
    const byId = new Map<number, SpeakerInfo>();
    for (const s of segments) {
      if (s.speaker == null) continue;
      const existing = byId.get(s.speaker);
      if (existing) {
        existing.lineCount += 1;
        if (!existing.sample && s.text) existing.sample = s.text;
      } else {
        byId.set(s.speaker, {
          speaker: s.speaker,
          sample: s.text ?? "",
          lineCount: 1,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.speaker - b.speaker);
  }, [segments]);

  // Draft starts from the stored map (component is mounted on demand, so this
  // captures the current roles each time the editor is opened).
  const [draft, setDraft] = useState<Record<string, SpeakerRole>>(() => {
    const d: Record<string, SpeakerRole> = {};
    for (const sp of speakers)
      d[String(sp.speaker)] = roleOfSpeaker(sp.speaker, roleMap);
    return d;
  });

  // Re-sync the draft when the STORED map changes — e.g. after "Auto-detect (AI)"
  // rewrites speaker_role_map and the recording query refetches — so the dropdowns
  // reflect the new roles. A local dropdown change doesn't touch the stored map, so
  // the storedKey is unchanged and an in-progress manual edit is never clobbered.
  const storedKey = speakers
    .map((sp) => `${sp.speaker}:${roleOfSpeaker(sp.speaker, roleMap)}`)
    .join("|");
  useEffect(() => {
    const d: Record<string, SpeakerRole> = {};
    for (const sp of speakers)
      d[String(sp.speaker)] = roleOfSpeaker(sp.speaker, roleMap);
    setDraft(d);
    // storedKey captures the stored roleMap × speakers; re-deriving from it is the
    // intended sync. (speakers/roleMap are covered by storedKey.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  const setRole = (speaker: number, role: SpeakerRole) =>
    setDraft((d) => ({ ...d, [String(speaker)]: role }));

  const swap = () =>
    setDraft((d) => {
      const out: Record<string, SpeakerRole> = {};
      for (const [k, v] of Object.entries(d))
        out[k] = v === "agent" ? "client" : v === "client" ? "agent" : v;
      return out;
    });

  const save = () => {
    const clean: Record<string, "agent" | "client"> = {};
    for (const [k, v] of Object.entries(draft))
      if (v === "agent" || v === "client") clean[k] = v;
    onSave(clean);
  };

  if (speakers.length === 0) return null;

  return (
    <div className="rounded-lg border border-v2-ring bg-v2-canvas/50 p-2.5 mb-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-v2-ink">Who's who?</p>
        <div className="flex items-center gap-1">
          {canUseAi && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] text-v2-ink-muted"
              onClick={onRedetect}
              disabled={redetecting || saving}
              title="Let the AI re-classify who's the agent / client / automated from the transcript content"
            >
              {redetecting ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              Auto-detect (AI)
            </Button>
          )}
          {speakers.length === 2 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] text-v2-ink-muted"
              onClick={swap}
            >
              <ArrowLeftRight className="h-3 w-3 mr-1" /> Swap
            </Button>
          )}
          <Button
            size="sm"
            className="h-6 text-[10px]"
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save &amp; re-analyze
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-v2-ink-subtle">
        These are inbound calls — the agent is whoever gives the intro (“how can
        I help you”). Set any automated/hold voice to “Other”.
      </p>
      <div className="space-y-1.5">
        {speakers.map((sp) => (
          <div key={sp.speaker} className="flex items-center gap-2">
            <select
              value={draft[String(sp.speaker)] ?? "unknown"}
              onChange={(e) =>
                setRole(sp.speaker, e.target.value as SpeakerRole)
              }
              className="h-6 text-[10px] rounded border border-v2-ring bg-v2-card px-1.5 text-v2-ink shrink-0"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-v2-ink-subtle shrink-0 tabular-nums">
              Spk {sp.speaker} · {sp.lineCount} lines
            </span>
            <span className="text-[10px] text-v2-ink-muted truncate italic">
              “{sp.sample.slice(0, 80)}
              {sp.sample.length > 80 ? "…" : ""}”
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
