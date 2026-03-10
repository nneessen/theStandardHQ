// src/services/underwriting/generateRulesService.ts
// Service for deterministic rule generation (knockout rules, age rules)

import { supabase } from "@/services/base/supabase";

// =============================================================================
// Types
// =============================================================================

export type GenerationStrategy =
  | "skip_if_exists"
  | "create_new_draft"
  | "upsert_draft";

export interface KnockoutCondition {
  code: string;
  name: string;
  severity: "absolute" | "conditional";
}

export interface GenerateKnockoutRulesInput {
  carrierId: string;
  imoId: string;
  userId: string;
  knockoutCodes?: string[];
  strategy?: GenerationStrategy;
}

export interface GenerateAgeRulesInput {
  carrierId: string;
  imoId: string;
  userId: string;
  productIds?: string[];
  strategy?: GenerationStrategy;
}

export interface GenerateGuaranteedIssueRulesInput {
  carrierId: string;
  imoId: string;
  userId: string;
  productIds: string[];
  strategy?: GenerationStrategy;
}

export interface GenerationResult {
  success: boolean;
  error?: string;
  created: number;
  skipped: number;
  ruleSetIds: string[];
  productsProcessed?: number;
}

const BULK_PAGE_SIZE = 1000;
const BULK_INSERT_CHUNK_SIZE = 200;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchPagedRows<T>(
  buildPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * BULK_PAGE_SIZE;
    const to = from + BULK_PAGE_SIZE - 1;
    const { data, error } = await buildPage(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < BULK_PAGE_SIZE) {
      return rows;
    }
  }
}

// =============================================================================
// Get Available Knockout Codes
// =============================================================================

/**
 * Fetch the list of available knockout condition codes
 */
export async function getAvailableKnockoutCodes(): Promise<
  KnockoutCondition[]
> {
  const { data, error } = await supabase.rpc("get_available_knockout_codes");

  if (error) {
    console.error("Error fetching knockout codes:", error);
    throw error;
  }

  return (data ?? []).map(
    (row: { code: string; name: string; severity: string }) => ({
      code: row.code,
      name: row.name,
      severity: row.severity as "absolute" | "conditional",
    }),
  );
}

// =============================================================================
// Generate Knockout Rules
// =============================================================================

/**
 * Generate global knockout rule sets for a carrier
 *
 * @param input - Generation parameters
 * @returns Result with created/skipped counts and rule set IDs
 */
export async function generateKnockoutRules(
  input: GenerateKnockoutRulesInput,
): Promise<GenerationResult> {
  const { data, error } = await supabase.rpc("generate_global_knockout_rules", {
    p_carrier_id: input.carrierId,
    p_imo_id: input.imoId,
    p_user_id: input.userId,
    p_knockout_codes: input.knockoutCodes ?? null,
    p_strategy: input.strategy ?? "skip_if_exists",
  });

  if (error) {
    console.error("Error generating knockout rules:", error);
    throw error;
  }

  const result = data as {
    success: boolean;
    error?: string;
    created?: number;
    skipped?: number;
    rule_set_ids?: string[];
  };

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      created: 0,
      skipped: 0,
      ruleSetIds: [],
    };
  }

  return {
    success: true,
    created: result.created ?? 0,
    skipped: result.skipped ?? 0,
    ruleSetIds: result.rule_set_ids ?? [],
  };
}

// =============================================================================
// Generate Age Rules from Products
// =============================================================================

/**
 * Generate age eligibility rule sets from product metadata
 *
 * @param input - Generation parameters
 * @returns Result with created/skipped counts and rule set IDs
 */
export async function generateAgeRulesFromProducts(
  input: GenerateAgeRulesInput,
): Promise<GenerationResult> {
  const { data, error } = await supabase.rpc(
    "generate_age_rules_from_products",
    {
      p_carrier_id: input.carrierId,
      p_imo_id: input.imoId,
      p_user_id: input.userId,
      p_product_ids: input.productIds ?? null,
      p_strategy: input.strategy ?? "skip_if_exists",
    },
  );

  if (error) {
    console.error("Error generating age rules:", error);
    throw error;
  }

  const result = data as {
    success: boolean;
    error?: string;
    created?: number;
    skipped?: number;
    products_processed?: number;
    rule_set_ids?: string[];
  };

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      created: 0,
      skipped: 0,
      ruleSetIds: [],
    };
  }

  return {
    success: true,
    created: result.created ?? 0,
    skipped: result.skipped ?? 0,
    productsProcessed: result.products_processed ?? 0,
    ruleSetIds: result.rule_set_ids ?? [],
  };
}

// =============================================================================
// Generate Guaranteed-Issue Rules from Explicit Product Selection
// =============================================================================

interface ActiveConditionRow {
  code: string;
  name: string;
}

interface ProductRow {
  id: string;
  name: string;
}

interface ExistingRuleSetRow {
  condition_code: string | null;
  id: string;
  product_id: string | null;
  review_status: string | null;
  version: number | null;
}

/**
 * Generate product-specific draft rule sets that always return guaranteed issue
 * for each active condition on explicitly selected products.
 *
 * Safety:
 * - Requires explicit product selection (no automatic GI discovery)
 * - Never modifies approved rule sets
 * - Creates drafts only
 */
export async function generateGuaranteedIssueRulesFromProducts(
  input: GenerateGuaranteedIssueRulesInput,
): Promise<GenerationResult> {
  if (input.productIds.length === 0) {
    return {
      success: false,
      error: "Select at least one product.",
      created: 0,
      skipped: 0,
      ruleSetIds: [],
    };
  }

  if (
    !["skip_if_exists", "create_new_draft", "upsert_draft"].includes(
      input.strategy ?? "skip_if_exists",
    )
  ) {
    return {
      success: false,
      error:
        "Invalid strategy. Must be: skip_if_exists, create_new_draft, or upsert_draft.",
      created: 0,
      skipped: 0,
      ruleSetIds: [],
    };
  }

  const [productsResult, conditionsResult, existingRuleSets] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name")
        .eq("carrier_id", input.carrierId)
        .eq("is_active", true)
        .in("id", input.productIds)
        .order("name", { ascending: true }),
      supabase
        .from("underwriting_health_conditions")
        .select("code, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      fetchPagedRows<ExistingRuleSetRow>(
        async (from, to) =>
          await supabase
            .from("underwriting_rule_sets")
            .select("id, product_id, condition_code, review_status, version")
            .eq("imo_id", input.imoId)
            .eq("carrier_id", input.carrierId)
            .eq("scope", "condition")
            .eq("is_active", true)
            .in("product_id", input.productIds)
            .range(from, to),
      ),
    ]);

  if (productsResult.error) {
    throw new Error(productsResult.error.message);
  }

  if (conditionsResult.error) {
    throw new Error(conditionsResult.error.message);
  }

  const products = (productsResult.data ?? []) as ProductRow[];
  const activeConditions = (conditionsResult.data ??
    []) as ActiveConditionRow[];

  if (products.length === 0) {
    return {
      success: false,
      error: "No active products found for the selected carrier.",
      created: 0,
      skipped: 0,
      ruleSetIds: [],
    };
  }

  const productNameById = new Map(
    products.map((product) => [product.id, product.name]),
  );
  const conditionNameByCode = new Map(
    activeConditions.map((condition) => [condition.code, condition.name]),
  );

  const existingByKey = existingRuleSets.reduce((acc, ruleSet) => {
    if (!ruleSet.product_id || !ruleSet.condition_code) {
      return acc;
    }

    const key = `${ruleSet.product_id}:${ruleSet.condition_code}`;
    const bucket = acc.get(key) ?? [];
    bucket.push(ruleSet);
    acc.set(key, bucket);
    return acc;
  }, new Map<string, ExistingRuleSetRow[]>());

  const strategy = input.strategy ?? "skip_if_exists";
  const ruleSetsToDelete = new Set<string>();
  const ruleSetInserts: Array<{
    carrier_id: string;
    condition_code: string;
    created_by: string;
    default_outcome: {
      eligibility: string;
      healthClass: string;
      reason: string;
      tableRating: string;
    };
    description: string;
    imo_id: string;
    is_active: boolean;
    name: string;
    product_id: string;
    review_status: "draft";
    scope: "condition";
    source: "imported";
    variant: "default";
    version: number;
  }> = [];

  let skipped = 0;

  for (const product of products) {
    for (const condition of activeConditions) {
      const key = `${product.id}:${condition.code}`;
      const existing = existingByKey.get(key) ?? [];
      const hasApproved = existing.some(
        (ruleSet) => ruleSet.review_status === "approved",
      );
      const nextVersion =
        existing.reduce(
          (maxVersion, ruleSet) => Math.max(maxVersion, ruleSet.version ?? 0),
          0,
        ) + 1;

      if (strategy === "skip_if_exists" && existing.length > 0) {
        skipped += 1;
        continue;
      }

      if (strategy === "upsert_draft" && hasApproved) {
        skipped += 1;
        continue;
      }

      if (strategy === "upsert_draft") {
        existing
          .filter((ruleSet) => ruleSet.review_status !== "approved")
          .forEach((ruleSet) => ruleSetsToDelete.add(ruleSet.id));
      }

      const productName = productNameById.get(product.id) ?? product.id;
      const conditionName =
        conditionNameByCode.get(condition.code) ?? condition.code;

      ruleSetInserts.push({
        carrier_id: input.carrierId,
        condition_code: condition.code,
        created_by: input.userId,
        default_outcome: {
          eligibility: "unknown",
          healthClass: "unknown",
          reason: "No matching rule - manual review required",
          tableRating: "none",
        },
        description: `Auto-generated guaranteed issue coverage for ${conditionName}. Use only for products that truly accept applicants regardless of reported health.`,
        imo_id: input.imoId,
        is_active: true,
        name: `${productName} - ${conditionName} (Guaranteed Issue)`,
        product_id: product.id,
        review_status: "draft",
        scope: "condition",
        source: "imported",
        variant: "default",
        version: nextVersion,
      });
    }
  }

  if (ruleSetsToDelete.size > 0) {
    for (const ids of chunkArray(
      Array.from(ruleSetsToDelete),
      BULK_INSERT_CHUNK_SIZE,
    )) {
      const { error } = await supabase
        .from("underwriting_rule_sets")
        .delete()
        .in("id", ids);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  if (ruleSetInserts.length === 0) {
    return {
      success: true,
      created: 0,
      skipped,
      productsProcessed: products.length,
      ruleSetIds: [],
    };
  }

  const createdRuleSets: Array<{
    condition_code: string | null;
    id: string;
    product_id: string | null;
  }> = [];

  for (const chunk of chunkArray(ruleSetInserts, BULK_INSERT_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("underwriting_rule_sets")
      .insert(chunk)
      .select("id, product_id, condition_code");

    if (error) {
      throw new Error(error.message);
    }

    createdRuleSets.push(...(data ?? []));
  }

  const rulesToInsert = createdRuleSets.map((ruleSet) => {
    const conditionCode = ruleSet.condition_code ?? "condition";
    return {
      description: "Always returns guaranteed issue for the selected product.",
      name: "Default - Guaranteed Issue",
      outcome_concerns: [conditionCode],
      outcome_eligibility: "eligible" as const,
      outcome_health_class: "guaranteed_issue" as const,
      outcome_reason:
        "Guaranteed issue product — coverage available regardless of reported medical conditions.",
      outcome_table_rating: "none" as const,
      predicate: { version: 2, root: {} },
      predicate_version: 2,
      priority: 1,
      rule_set_id: ruleSet.id,
    };
  });

  for (const chunk of chunkArray(rulesToInsert, BULK_INSERT_CHUNK_SIZE)) {
    const { error } = await supabase.from("underwriting_rules").insert(chunk);
    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    success: true,
    created: createdRuleSets.length,
    skipped,
    productsProcessed: products.length,
    ruleSetIds: createdRuleSets.map((ruleSet) => ruleSet.id),
  };
}
