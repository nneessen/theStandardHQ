// src/features/call-reviews/lib/__tests__/wordTrackScriptUsage.test.ts
import { describe, it, expect } from "vitest";
import { buildWordTrackScriptUsage } from "../wordTrackScriptUsage";
import type { GeneratedScriptRow } from "../../types";

// Minimal GeneratedScriptRow factory — only the fields buildWordTrackScriptUsage
// reads (script_body.phases[].steps[].word_track_ids) need to be real.
function script(
  id: string,
  stepWordTrackIds: string[][],
  bodyOverride?: Partial<GeneratedScriptRow["script_body"]>,
): GeneratedScriptRow {
  return {
    id,
    script_body:
      bodyOverride !== undefined && bodyOverride === null
        ? null
        : {
            phases: [
              {
                title: "P1",
                goal: "",
                est_minutes: null,
                call_pct: null,
                tonality: null,
                steps: stepWordTrackIds.map((ids) => ({
                  kind: "say" as const,
                  say: "",
                  delivery_note: null,
                  tonality: null,
                  pause_cue: null,
                  do: "",
                  word_track_ids: ids,
                  why_it_works: null,
                  objections: [],
                })),
              },
            ],
          },
  } as unknown as GeneratedScriptRow;
}

describe("buildWordTrackScriptUsage", () => {
  it("returns an empty map for no scripts", () => {
    expect(buildWordTrackScriptUsage([]).size).toBe(0);
  });

  it("counts a track once per script even if it appears in multiple steps", () => {
    const usage = buildWordTrackScriptUsage([
      script("s1", [["wt-a"], ["wt-a"], ["wt-b"]]),
    ]);
    expect(usage.get("wt-a")).toBe(1); // de-duped within the script
    expect(usage.get("wt-b")).toBe(1);
  });

  it("tallies a track across multiple scripts", () => {
    const usage = buildWordTrackScriptUsage([
      script("s1", [["wt-a", "wt-b"]]),
      script("s2", [["wt-a"]]),
      script("s3", [["wt-c"]]),
    ]);
    expect(usage.get("wt-a")).toBe(2);
    expect(usage.get("wt-b")).toBe(1);
    expect(usage.get("wt-c")).toBe(1);
  });

  it("ignores scripts with no generated body", () => {
    const withBody = script("s1", [["wt-a"]]);
    const noBody = {
      id: "s2",
      script_body: null,
    } as unknown as GeneratedScriptRow;
    const usage = buildWordTrackScriptUsage([withBody, noBody]);
    expect(usage.get("wt-a")).toBe(1);
    expect(usage.size).toBe(1);
  });

  it("tolerates empty/absent word_track_ids without throwing", () => {
    const usage = buildWordTrackScriptUsage([script("s1", [[]])]);
    expect(usage.size).toBe(0);
  });
});
