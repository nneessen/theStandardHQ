// Offline tests for getUnderwritingRecommendation. These run through the REAL edge
// engine (computeAuthoritativeUnderwritingRun) with a chainable fake supabase client
// that resolves every query to empty — so the engine produces an honest "no
// recommendations" result with NO network and NO writes. The two abstention guards
// (no IMO, insufficient client facts) short-circuit before the engine is touched.
//
// NOTE: this file pulls the engine (and its src/ imports) into the type-check graph.
// If `deno test` (with check) on the orchestrator dir starts failing on engine type
// errors, this file should move behind a --no-check runner like the engine suite —
// see scripts/test-assistant-edge.sh. As of writing the suite stays green.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { AssistantToolContext, ToolDbClient } from "../types.ts";
import {
  buildPayload,
  getUnderwritingRecommendation,
} from "../getUnderwritingRecommendation.ts";
import { parseHealthSnapshot } from "../../../_shared/underwriting/payload.ts";
import { transformConditionResponses } from "../../../../../src/services/underwriting/core/conditionResponseTransformer.ts";

// A db that fails loudly on any write path — the tool is read-only.
const writeTrap = () => {
  throw new Error("getUnderwritingRecommendation must not write");
};

// Chainable query stub: every builder method returns `this`, and awaiting it (or
// calling a terminal) yields { data: [], error: null }. This satisfies the arbitrary
// .from(x).select(y).eq(...).in(...) chains the engine's fetch helpers build.
function emptyQuery(): unknown {
  const result = { data: [] as unknown[], error: null };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: typeof result) => unknown) => resolve(result);
      }
      // Any builder method (select/eq/in/order/limit/single/maybeSingle/...) →
      // keep chaining on the same proxy.
      return () => proxy;
    },
  };
  const proxy: unknown = new Proxy({}, handler);
  return proxy;
}

function makeReadDb(): ToolDbClient {
  return {
    rpc() {
      return Promise.resolve({ data: [], error: null });
    },
    // The engine calls client.from(...).select(...)...; route it through the stub.
    from() {
      return emptyQuery() as ReturnType<ToolDbClient["from"]>;
    },
    insert: writeTrap,
    update: writeTrap,
    upsert: writeTrap,
    delete: writeTrap,
  } as unknown as ToolDbClient;
}

function makeCtx(imoId: string | null): AssistantToolContext {
  return {
    db: makeReadDb(),
    userId: "user_1",
    imoId,
    conversationId: "conv_1",
    firstName: "Nick",
    close: { getClient: () => Promise.resolve(null) },
  };
}

Deno.test(
  "abstains (no engine call) when the user has no IMO scope",
  async () => {
    const out = (await getUnderwritingRecommendation.run(
      { age: 55, gender: "female", conditions: [] },
      makeCtx(null),
    )) as { available: boolean; reason?: string };
    assertEquals(out.available, false);
    assertEquals(out.reason, "no_imo_scope");
  },
);

Deno.test(
  "abstains when required client facts are missing (no age)",
  async () => {
    const out = (await getUnderwritingRecommendation.run(
      { gender: "female", conditions: [] },
      makeCtx("imo_1"),
    )) as { available: boolean; reason?: string };
    assertEquals(out.available, false);
    assertEquals(out.reason, "insufficient_client_facts");
  },
);

Deno.test(
  "runs the engine and returns an honest empty result when no products are configured",
  async () => {
    const out = (await getUnderwritingRecommendation.run(
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
      makeCtx("imo_1"),
    )) as {
      available: boolean;
      reason?: string;
      data?: {
        dataWarning?: string;
        note?: string;
        totalProductsEvaluated?: number;
      };
    };
    // Empty product set => no recommendation can be made. Honest, not fabricated.
    assertEquals(out.available, false);
    assertEquals(out.reason, "no_recommendations");
    // The honest note + the real engine count must be present (guards against a
    // field-swap, e.g. surfacing filtered.ineligible as the total).
    assert(
      typeof out.data?.note === "string" && out.data.note.length > 0,
      "expected an honest note",
    );
    assertEquals(out.data?.totalProductsEvaluated, 0);
    // Build (height/weight) was omitted, so the result must disclose that build
    // was not assessed — never let a build-blind class read as final.
    assert(
      typeof out.data?.dataWarning === "string" &&
        out.data.dataWarning.length > 0,
      "expected a build dataWarning when height/weight are missing",
    );
  },
);

Deno.test(
  "abstains as evaluation_failed (not a throw) when the engine errors",
  async () => {
    // A db whose every query throws — the engine's fetch helpers re-throw, the
    // tool must catch and degrade to an honest available:false, never crash.
    const throwingDb = {
      rpc() {
        throw new Error("DB unavailable");
      },
      from() {
        throw new Error("DB unavailable");
      },
    } as unknown as ToolDbClient;
    const ctx: AssistantToolContext = {
      db: throwingDb,
      userId: "user_1",
      imoId: "imo_1",
      conversationId: "conv_1",
      firstName: "Nick",
      close: { getClient: () => Promise.resolve(null) },
    };
    const out = (await getUnderwritingRecommendation.run(
      {
        age: 55,
        gender: "female",
        conditions: [{ code: "high_blood_pressure" }],
      },
      ctx,
    )) as { available: boolean; reason?: string };
    assertEquals(out.available, false);
    assertEquals(out.reason, "evaluation_failed");
  },
);

Deno.test(
  "buildPayload routes non-HBP follow-ups through `details` into the right transformer facts",
  () => {
    // The pass-through path every non-HBP condition uses. A regression in the
    // details value-filtering would silently strip these and force an abstain.
    const payload = buildPayload({
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
    // a1c 6.4 < 7.5 threshold => controlled; "Oral medication only" => no insulin.
    assertEquals(diabetes.a1c_level, 6.4);
    assertEquals(diabetes.good_control, true);
    assertEquals(diabetes.insulin_use, false);
  },
);

Deno.test(
  "buildPayload maps controlled-HBP model args into the EXACT transformer facts the curated Standard rule needs",
  () => {
    // The seam curated-rules.test.ts does not cover: flat model args -> version-2
    // healthResponses -> parseHealthSnapshot -> transformConditionResponses. A typo
    // here (controlStatus->controlled, bloodPressureReading->current_reading, the
    // version:2/conditionsByCode shape) would silently abstain on prod, not error.
    const payload = buildPayload({
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
    // version-2 snapshot parses back to the one condition.
    const parsed = parseHealthSnapshot(payload!.healthResponses);
    assertEquals(parsed.conditions.length, 1);
    assertEquals(parsed.conditions[0].conditionCode, "high_blood_pressure");

    // And the transformer derives the THREE gating facts the seeded Standard rule
    // ANDs together: well_controlled=true, is_stage2_or_higher=false, med_count<=2.
    const facts = transformConditionResponses(
      parsed.conditions,
      payload!.clientAge,
    );
    const hbp = facts.high_blood_pressure as Record<string, unknown>;
    assertEquals(hbp.well_controlled, true);
    assertEquals(hbp.is_stage2_or_higher, false);
    assertEquals(hbp.medication_count, 1);
  },
);

Deno.test(
  "buildPayload: a male client with no conditions yields an empty, valid snapshot",
  () => {
    const payload = buildPayload({ age: 40, gender: "male", conditions: [] });
    assert(payload !== null);
    assertEquals(payload!.clientGender, "male");
    assertEquals(
      parseHealthSnapshot(payload!.healthResponses).conditions.length,
      0,
    );
  },
);

Deno.test(
  "input schema exposes the condition enum incl. atrial_fibrillation",
  () => {
    const schema = getUnderwritingRecommendation.inputSchema as Record<
      string,
      unknown
    >;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const items = (props.conditions.items as Record<string, unknown>)
      .properties as Record<string, Record<string, unknown>>;
    const codeEnum = items.code.enum as string[];
    assert(codeEnum.includes("high_blood_pressure"));
    assert(codeEnum.includes("atrial_fibrillation"));
    // HBP control vocabulary must be enum-locked to the transformer's exact strings.
    const controlEnum = items.controlStatus.enum as string[];
    assert(controlEnum.includes("Yes, consistently normal"));
  },
);
