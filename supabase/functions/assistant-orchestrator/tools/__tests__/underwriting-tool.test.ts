// Tool-level tests for getUnderwritingRecommendation. The tool no longer imports the
// engine — it depends on the injected UnderwritingRunner (ctx.underwriting) — so this
// file is fully TYPE-CHECKED (no --no-check) and can drive every branch by handing the
// tool a fake runner. The engine/payload seam itself is covered in
// underwriting-runner.test.ts (which runs --no-check because it imports the engine).

import { assert, assertEquals } from "jsr:@std/assert@1";
import type {
  AssistantToolContext,
  ToolDbClient,
  UnderwritingProductResult,
  UnderwritingRunner,
  UnderwritingRunResult,
} from "../types.ts";
import { getUnderwritingRecommendation } from "../getUnderwritingRecommendation.ts";

// A db that fails loudly — the tool must never touch Postgres directly anymore.
const noDb = {
  rpc() {
    throw new Error("the underwriting tool must not touch the db directly");
  },
  from() {
    throw new Error("the underwriting tool must not touch the db directly");
  },
} as unknown as ToolDbClient;

function makeCtx(
  imoId: string | null,
  runner: UnderwritingRunner,
): AssistantToolContext {
  return {
    db: noDb,
    userId: "user_1",
    imoId,
    conversationId: "conv_1",
    firstName: "Nick",
    close: { getClient: () => Promise.resolve(null) },
    underwriting: runner,
  };
}

/** A runner that fails the test if it is ever called. */
const neverCalledRunner: UnderwritingRunner = {
  run() {
    throw new Error("runner must not be called");
  },
};

/** A runner returning a fixed result (or null / throwing) for branch testing. */
function fixedRunner(result: UnderwritingRunResult | null): UnderwritingRunner {
  return { run: () => Promise.resolve(result) };
}

const assessableProduct: UnderwritingProductResult = {
  assessable: true,
  carrierName: "American Amicable",
  productName: "Term Made Simple",
  productType: "term_life",
  healthClass: "standard",
  approvalLikelihood: 0.92,
  eligibilityStatus: "eligible",
  eligibilityReasons: [],
  concerns: [],
  conditionDecisions: [],
};

const nonAssessableProduct: UnderwritingProductResult = {
  assessable: false,
  carrierName: "Some Carrier",
  productName: "Some Product",
  productType: "term_life",
  eligibilityReasons: ["Insufficient data to assess this condition"],
};

function resultWith(
  products: UnderwritingProductResult[],
  overrides: Partial<UnderwritingRunResult> = {},
): UnderwritingRunResult {
  return {
    totalProductsEvaluated: products.length,
    ineligibleProducts: 0,
    conditionsReported: ["high_blood_pressure"],
    buildProvided: true,
    products,
    ...overrides,
  };
}

Deno.test(
  "abstains (runner NOT called) when the user has no IMO scope",
  async () => {
    const out = (await getUnderwritingRecommendation.run(
      { age: 55, gender: "female", conditions: [] },
      makeCtx(null, neverCalledRunner),
    )) as { available: boolean; reason?: string };
    assertEquals(out.available, false);
    assertEquals(out.reason, "no_imo_scope");
  },
);

Deno.test(
  "insufficient_client_facts when the runner returns null",
  async () => {
    const out = (await getUnderwritingRecommendation.run(
      { gender: "female", conditions: [] },
      makeCtx("imo_1", fixedRunner(null)),
    )) as { available: boolean; reason?: string };
    assertEquals(out.available, false);
    assertEquals(out.reason, "insufficient_client_facts");
  },
);

Deno.test(
  "evaluation_failed (not a throw) when the runner throws",
  async () => {
    const throwingRunner: UnderwritingRunner = {
      run: () => Promise.reject(new Error("engine/DB error")),
    };
    const out = (await getUnderwritingRecommendation.run(
      { age: 55, gender: "female", conditions: [] },
      makeCtx("imo_1", throwingRunner),
    )) as { available: boolean; reason?: string };
    assertEquals(out.available, false);
    assertEquals(out.reason, "evaluation_failed");
  },
);

Deno.test(
  "no_recommendations surfaces the honest note + counts, and discloses missing build",
  async () => {
    const out = (await getUnderwritingRecommendation.run(
      { age: 55, gender: "female", conditions: [] },
      makeCtx(
        "imo_1",
        fixedRunner(
          resultWith([], {
            totalProductsEvaluated: 3,
            ineligibleProducts: 3,
            buildProvided: false,
          }),
        ),
      ),
    )) as {
      available: boolean;
      reason?: string;
      data?: {
        note?: string;
        totalProductsEvaluated?: number;
        ineligibleProducts?: number;
        dataWarning?: string;
      };
    };
    assertEquals(out.available, false);
    assertEquals(out.reason, "no_recommendations");
    assert(typeof out.data?.note === "string" && out.data.note.length > 0);
    assertEquals(out.data?.totalProductsEvaluated, 3);
    assertEquals(out.data?.ineligibleProducts, 3);
    // Build omitted => must disclose it.
    assert(
      typeof out.data?.dataWarning === "string" &&
        out.data.dataWarning.length > 0,
    );
  },
);

Deno.test(
  "insufficient_data_to_assess when every product is non-assessable (no fabricated odds)",
  async () => {
    const out = (await getUnderwritingRecommendation.run(
      { age: 55, gender: "female", conditions: [] },
      makeCtx("imo_1", fixedRunner(resultWith([nonAssessableProduct]))),
    )) as {
      available: boolean;
      reason?: string;
      data?: {
        summary?: { assessableCount?: number; abstainedCount?: number };
        products?: UnderwritingProductResult[];
      };
    };
    assertEquals(out.available, false);
    assertEquals(out.reason, "insufficient_data_to_assess");
    assertEquals(out.data?.summary?.assessableCount, 0);
    assertEquals(out.data?.summary?.abstainedCount, 1);
    // The non-assessable product carries NO approval signal — the discriminated
    // union has no such field on this branch, so it can't leak.
    const p = out.data?.products?.[0];
    assert(p !== undefined && p.assessable === false);
    assert(!("approvalLikelihood" in p));
    assert(!("eligibilityStatus" in p));
  },
);

Deno.test(
  "available:true when at least one product is assessable; abstainers stay field-suppressed",
  async () => {
    const out = (await getUnderwritingRecommendation.run(
      { age: 55, gender: "female", conditions: [] },
      makeCtx(
        "imo_1",
        fixedRunner(resultWith([assessableProduct, nonAssessableProduct])),
      ),
    )) as {
      available: boolean;
      data?: {
        summary?: { assessableCount?: number };
        products?: UnderwritingProductResult[];
        dataWarning?: string;
      };
    };
    assertEquals(out.available, true);
    assertEquals(out.data?.summary?.assessableCount, 1);
    // buildProvided true => no warning.
    assertEquals(out.data?.dataWarning, undefined);
    const assessable = out.data?.products?.find((p) => p.assessable);
    const abstainer = out.data?.products?.find((p) => !p.assessable);
    assert(assessable?.assessable === true);
    assertEquals(assessable.approvalLikelihood, 0.92);
    assert(abstainer?.assessable === false);
    assert(!("approvalLikelihood" in abstainer));
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
