// src/features/call-reviews/lib/wordTrackScriptUsage.ts
// Counts, for each word track, how many generated master scripts reference it.
// A script's steps cite word_track_ids; we de-dupe within a script (a track used
// in three steps of one script still counts as one script) and tally across the
// IMO's scripts. Powers the "used in N scripts" badge in the Word Tracks library.

import type { GeneratedScriptRow } from "../types";

/** Map of word_track_id → number of generated scripts that reference it. */
export function buildWordTrackScriptUsage(
  scripts: GeneratedScriptRow[],
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const script of scripts) {
    const body = script.script_body;
    if (!body) continue;
    const idsInScript = new Set<string>();
    for (const phase of body.phases ?? []) {
      for (const step of phase.steps ?? []) {
        for (const id of step.word_track_ids ?? []) {
          if (id) idsInScript.add(id);
        }
      }
    }
    for (const id of idsInScript) {
      usage.set(id, (usage.get(id) ?? 0) + 1);
    }
  }
  return usage;
}
