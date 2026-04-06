// src/features/close-kpi/services/__tests__/team-pipeline-signal-keys.test.ts
//
// Schema-drift guard for the get_team_pipeline_snapshot RPC.
//
// The RPC extracts engagement signals from lead_heat_scores.signals (JSONB).
// Those keys are EMITTED by supabase/functions/close-lead-heat-score/signal-extractor.ts
// (typed by LeadSignals in types.ts) and CONSUMED by the SQL migration at
// supabase/migrations/20260406105324_team_pipeline_snapshot_rpc.sql.
//
// If anyone renames a key in either place, the team metrics silently return zero.
// This test fails loudly if either side drifts.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_SIGNAL_KEYS = [
  "callsOutbound",
  "callsAnswered",
  "consecutiveNoAnswers",
  "straightToVmCount",
  "hoursSinceLastTouch",
  "hasActiveOpportunity",
  "opportunityValueUsd",
  "isPositiveStatus",
] as const;

const REPO_ROOT = resolve(__dirname, "../../../../..");
const EDGE_TYPES_PATH = resolve(
  REPO_ROOT,
  "supabase/functions/close-lead-heat-score/types.ts",
);
const MIGRATION_PATH = resolve(
  REPO_ROOT,
  "supabase/migrations/20260406105324_team_pipeline_snapshot_rpc.sql",
);

describe("get_team_pipeline_snapshot signal-key contract", () => {
  const edgeTypesSource = readFileSync(EDGE_TYPES_PATH, "utf8");
  const migrationSource = readFileSync(MIGRATION_PATH, "utf8");

  // Isolate the LeadSignals interface block so we don't false-positive on
  // other interfaces in the same file.
  const leadSignalsBlock = (() => {
    const start = edgeTypesSource.indexOf("export interface LeadSignals");
    expect(start).toBeGreaterThan(-1);
    // Find the closing brace of the interface (first '}' after the opening '{')
    const openBrace = edgeTypesSource.indexOf("{", start);
    let depth = 0;
    for (let i = openBrace; i < edgeTypesSource.length; i++) {
      if (edgeTypesSource[i] === "{") depth++;
      else if (edgeTypesSource[i] === "}") {
        depth--;
        if (depth === 0) return edgeTypesSource.slice(start, i + 1);
      }
    }
    throw new Error("LeadSignals interface block not closed");
  })();

  for (const key of REQUIRED_SIGNAL_KEYS) {
    it(`LeadSignals interface declares "${key}"`, () => {
      // Match the field declaration: `keyName:` or `keyName?:`
      const re = new RegExp(`\\b${key}\\??:`);
      expect(leadSignalsBlock).toMatch(re);
    });

    it(`team_pipeline_snapshot migration extracts signals.${key}`, () => {
      // Match either `signals->>'key'` or `signals -> 'key'`
      const re = new RegExp(`signals\\s*->>?\\s*'${key}'`);
      expect(migrationSource).toMatch(re);
    });
  }

  it("required signal key list is non-empty (sanity)", () => {
    expect(REQUIRED_SIGNAL_KEYS.length).toBeGreaterThan(0);
  });
});
