// Phase 1.1 — Condition ontology ⇄ transformer CONTRACT test.
//
// The ontology seed (supabase/migrations/...seed_underwriting_condition_ontology.sql)
// is only useful if the option strings + field ids it collects flow through
// `transformConditionResponses` and `buildFactMap` into the OUTPUT facts that
// rule predicates reference. The dangerous failure is silent: an option string
// the transformer doesn't recognize (e.g. "Oral meds" vs the seeded "Oral
// medication only") leaves `diabetes.insulin_use` undefined and abstains.
//
// WHAT THIS TEST GUARANTEES (and what it does NOT):
// - It feeds, for EVERY seeded condition, an intake response built from the
//   EXACT option strings authored in the migration, and asserts the transformer
//   derives the expected fact. So a seeded option the transformer can't parse
//   surfaces here as a missing/wrong fact — IF this test's strings are kept in
//   sync with the migration (they are hand-copied; treat that as a maintenance
//   rule, not an automatic link).
// - It does NOT read the migration file or the seeded DB rows, so it does not
//   auto-detect a future edit that changes the migration WITHOUT updating this
//   test. The migration↔transformer match across all 11 conditions is upheld by
//   authoring-against-the-transformer + this coverage + review, not by an
//   automatic file-drift guard (the transformer uses substring matching, so a
//   pure string-equality guard would be misleading anyway).
import { describe, it, expect } from "vitest";

import { transformConditionResponses } from "../core/conditionResponseTransformer";
import { buildFactMap } from "../core/ruleEvaluator";
import type { ConditionResponse } from "@/features/underwriting/types/underwriting.types";

// A date roughly `years` ago, as YYYY-MM-DD (the transformer parses date strings
// and computes elapsed years against "now").
function yearsAgoISO(years: number): string {
  const d = new Date(Date.now() - years * 365.25 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

describe("condition ontology → transformer → factmap contract", () => {
  it("55F demo (diabetes on metformin / MI 3y ago / AFib) derives the rule-facing facts", () => {
    const clientAge = 55;

    // Built with the EXACT option strings seeded in the ontology migration.
    const conditions: ConditionResponse[] = [
      {
        conditionCode: "diabetes",
        conditionName: "Diabetes",
        responses: {
          type: "Type 2",
          treatment: "Oral medication only", // metformin, no insulin
          a1c_level: 6.8,
          diagnosis_age: 50,
          complications: ["None"],
        },
      },
      {
        conditionCode: "heart_attack",
        conditionName: "Heart Attack (Myocardial Infarction)",
        responses: {
          date_of_event: yearsAgoISO(3),
          number_of_events: "1",
          treatment: ["Angioplasty/Stent"],
          full_recovery: "Yes",
        },
      },
      {
        conditionCode: "atrial_fibrillation",
        conditionName: "Atrial Fibrillation (AFib)",
        responses: {
          type: "Permanent",
          rate_controlled: "Yes",
          anticoagulated: "Yes",
        },
      },
    ];

    const transformed = transformConditionResponses(conditions, clientAge);
    const facts = buildFactMap(
      { age: clientAge, gender: "female", tobacco: false },
      conditions.map((c) => c.conditionCode),
      transformed,
    );

    // diabetes: "Oral medication only" MUST derive insulin_use=false (the owner's
    // north-star example). A1C 6.8 < 7.5 → good_control. dx age 50, now 55 → 5y.
    expect(facts["diabetes.insulin_use"]).toBe(false);
    expect(facts["diabetes.good_control"]).toBe(true);
    expect(facts["diabetes.a1c_level"]).toBe(6.8);
    expect(facts["diabetes.years_since_diagnosis"]).toBe(5);

    // heart_attack: date_of_event → years_since_event (~3); stent treatment.
    expect(facts["heart_attack.years_since_event"]).toBeGreaterThanOrEqual(2.5);
    expect(facts["heart_attack.years_since_event"]).toBeLessThanOrEqual(3.6);
    expect(facts["heart_attack.had_stent"]).toBe(true);

    // atrial_fibrillation has NO transformer → pass-through: the raw option
    // value IS the fact (rule predicates must match it verbatim).
    expect(facts["atrial_fibrillation.rate_controlled"]).toBe("Yes");
    expect(facts["atrial_fibrillation.anticoagulated"]).toBe("Yes");
    expect(facts["atrial_fibrillation.type"]).toBe("Permanent");
  });

  it("insulin treatment option flips insulin_use true (guards the map both ways)", () => {
    const transformed = transformConditionResponses(
      [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: { treatment: "Insulin only", a1c_level: 8.2 },
        },
      ],
      45,
    );
    const facts = buildFactMap(
      { age: 45, gender: "male", tobacco: false },
      ["diabetes"],
      transformed,
    );

    expect(facts["diabetes.insulin_use"]).toBe(true);
    // A1C 8.2 ≥ 7.5 → not good control.
    expect(facts["diabetes.good_control"]).toBe(false);
  });

  // One representative derived fact per remaining seeded condition, each built
  // from an EXACT option string in the migration. Guards the silent
  // option-string trap across all 11 conditions (not just the demo path).
  const cases: Array<{
    code: string;
    responses: Record<string, string | number | string[]>;
    factKey: string;
    expected: unknown;
  }> = [
    {
      code: "heart_disease",
      responses: { procedures: ["Bypass Surgery (CABG)"] },
      factKey: "heart_disease.has_bypass",
      expected: true,
    },
    {
      code: "stroke",
      responses: { cause_identified: "Atrial fibrillation (AFib)" },
      factKey: "stroke.cause_is_afib",
      expected: true,
    },
    {
      code: "high_blood_pressure",
      responses: { controlled: "Yes, consistently normal" },
      factKey: "high_blood_pressure.well_controlled",
      expected: true,
    },
    {
      code: "cancer",
      responses: {
        stage_at_diagnosis: "Stage I",
        current_status: "In remission",
      },
      factKey: "cancer.in_remission",
      expected: true,
    },
    {
      code: "copd",
      responses: { oxygen_use: "Continuously" },
      factKey: "copd.continuous_oxygen",
      expected: true,
    },
    {
      code: "depression",
      responses: { suicide_attempt: "Yes" },
      factKey: "depression.suicide_history",
      expected: true,
    },
    {
      code: "anxiety",
      responses: { panic_attacks: "Weekly" },
      factKey: "anxiety.frequent_panic_attacks",
      expected: true,
    },
    {
      code: "bipolar",
      responses: { type: "Bipolar II", current_state: "Stable" },
      factKey: "bipolar.is_stable",
      expected: true,
    },
  ];

  it.each(cases)(
    "$code: seeded option strings derive $factKey",
    ({ code, responses, factKey, expected }) => {
      const transformed = transformConditionResponses(
        [{ conditionCode: code, conditionName: code, responses }],
        50,
      );
      const facts = buildFactMap(
        { age: 50, gender: "male", tobacco: false },
        [code],
        transformed,
      );
      expect((facts as unknown as Record<string, unknown>)[factKey]).toBe(
        expected,
      );
    },
  );
});
