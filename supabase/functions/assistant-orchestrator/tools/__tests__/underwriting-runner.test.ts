// Seam tests for the concrete UnderwritingRunner. This file imports the authoritative
// edge engine (and its src/ underwriting graph, which carries the documented baseline
// type errors), so it runs under `deno test --no-check` — see scripts/test-assistant-edge.sh.
// It covers the two things the type-checked tool test cannot: (1) the flat-model-args ->
// raw-payload assembly mapping to the EXACT transformer facts, and (2) the runner driving
// the REAL engine to an honest empty result with no network/writes.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import type { Database } from "../../../../src/types/database.types.ts";
import {
  buildUnderwritingPayload,
  createUnderwritingRunner,
} from "../underwritingRunner.ts";
import { parseHealthSnapshot } from "../../../_shared/underwriting/payload.ts";
import { transformConditionResponses } from "../../../../../src/services/underwriting/core/conditionResponseTransformer.ts";

Deno.test(
  "buildUnderwritingPayload maps controlled-HBP args into the EXACT facts the curated Standard rule needs",
  () => {
    const payload = buildUnderwritingPayload({
      age: 55,
      gender: "female",
      state: "TX",
      heightInches: 66,
      weightLbs: 150,
      conditions: [
        {
          code: "high_blood_pressure",
          controlStatus: "Yes, consistently normal",
          medicationCount: "1",
          bloodPressureReading: "120/78",
        },
      ],
    });
    assert(payload !== null);
    const parsed = parseHealthSnapshot(payload!.healthResponses);
    assertEquals(parsed.conditions.length, 1);
    const facts = transformConditionResponses(
      parsed.conditions,
      payload!.clientAge,
    );
    const hbp = facts.high_blood_pressure as Record<string, unknown>;
    // The three clauses the seeded AmAm "Standard" rule ANDs together.
    assertEquals(hbp.well_controlled, true);
    assertEquals(hbp.is_stage2_or_higher, false);
    assertEquals(hbp.medication_count, 1);
  },
);

Deno.test(
  "buildUnderwritingPayload routes non-HBP follow-ups through `details` into transformer facts",
  () => {
    const payload = buildUnderwritingPayload({
      age: 50,
      gender: "male",
      conditions: [
        {
          code: "diabetes",
          details: { a1c_level: 6.4, treatment: "Oral medication only" },
        },
      ],
    });
    assert(payload !== null);
    const facts = transformConditionResponses(
      parseHealthSnapshot(payload!.healthResponses).conditions,
      payload!.clientAge,
    );
    const diabetes = facts.diabetes as Record<string, unknown>;
    assertEquals(diabetes.a1c_level, 6.4); // a1c 6.4 < 7.5 threshold
    assertEquals(diabetes.good_control, true);
    assertEquals(diabetes.insulin_use, false); // "Oral medication only"
  },
);

Deno.test("buildUnderwritingPayload returns null when age is missing", () => {
  assertEquals(
    buildUnderwritingPayload({ gender: "female", conditions: [] }),
    null,
  );
});

// Chainable query stub: every builder method returns `this`, awaiting yields
// { data: [], error: null }. Satisfies the engine's .from(x).select()...eq()... chains.
function emptyQuery(): unknown {
  const result = { data: [] as unknown[], error: null };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: typeof result) => unknown) => resolve(result);
      }
      return () => proxy;
    },
  };
  const proxy: unknown = new Proxy({}, handler);
  return proxy;
}

const emptyClient = {
  rpc() {
    return Promise.resolve({ data: [], error: null });
  },
  from() {
    return emptyQuery();
  },
} as unknown as SupabaseClient<Database>;

Deno.test(
  "createUnderwritingRunner drives the REAL engine to an honest empty result (no products configured)",
  async () => {
    const runner = createUnderwritingRunner(emptyClient);
    const result = await runner.run(
      {
        age: 55,
        gender: "female",
        state: "TX",
        conditions: [
          {
            code: "high_blood_pressure",
            controlStatus: "Yes, consistently normal",
            medicationCount: "1",
            bloodPressureReading: "120/78",
          },
        ],
      },
      "imo_1",
      "req_1",
    );
    assert(result !== null);
    assertEquals(result!.products.length, 0);
    assertEquals(result!.totalProductsEvaluated, 0);
    // height/weight omitted => build not assessed.
    assertEquals(result!.buildProvided, false);
    assertEquals(result!.conditionsReported, ["high_blood_pressure"]);
  },
);

Deno.test(
  "createUnderwritingRunner returns null when args lack required facts",
  async () => {
    const runner = createUnderwritingRunner(emptyClient);
    assertEquals(
      await runner.run({ gender: "female" }, "imo_1", "req_1"),
      null,
    );
  },
);
