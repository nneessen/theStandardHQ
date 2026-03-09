/* eslint-disable no-restricted-imports -- Edge-function bridge imports pure underwriting modules directly for Deno bundling. */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

import type { Database } from "@/types/database.types.ts";
import type {
  BuildChartInfo,
  ExtractedCriteria,
  ProductCandidate,
} from "@/services/underwriting/decision-engine.types.ts";
import type {
  PremiumMatrix,
  GenderType,
  TobaccoClass,
} from "@/services/underwriting/premium-matrix-core.ts";
import type {
  RuleSetScope,
  ReviewStatus,
} from "@/services/underwriting/ruleEngineDSL.ts";

type RuleSetRow = Database["public"]["Tables"]["underwriting_rule_sets"]["Row"];
type RuleRow = Database["public"]["Tables"]["underwriting_rules"]["Row"];

export interface RuleSetWithRules extends RuleSetRow {
  rules: RuleRow[];
}

function buildProductScopeFilter(productIds: string[]): {
  type: "is-null" | "or";
  value: string;
} {
  if (productIds.length === 0) {
    return { type: "is-null", value: "" };
  }

  return {
    type: "or",
    value: `product_id.is.null,product_id.in.(${productIds.join(",")})`,
  };
}

export async function fetchProducts(
  client: SupabaseClient<Database>,
  imoId: string,
  productTypes: string[],
): Promise<ProductCandidate[]> {
  let query = client
    .from("products")
    .select(
      `
      id, name, product_type, min_age, max_age,
      min_face_amount, max_face_amount, carrier_id, metadata,
      build_chart_id,
      carriers!inner(id, name)
      `,
    )
    .eq("is_active", true)
    .or(`imo_id.eq.${imoId},imo_id.is.null`);

  if (productTypes.length > 0) {
    query = query.in("product_type", productTypes);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch underwriting products: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const carrier = row.carriers as { id: string; name: string } | null;

    return {
      productId: row.id,
      productName: row.name,
      carrierId: row.carrier_id,
      carrierName: carrier?.name ?? "Unknown",
      productType: row.product_type,
      minAge: row.min_age,
      maxAge: row.max_age,
      minFaceAmount: row.min_face_amount,
      maxFaceAmount: row.max_face_amount,
      metadata: (row.metadata as ProductCandidate["metadata"]) ?? null,
      buildChartId: row.build_chart_id ?? null,
    };
  });
}

export async function fetchExtractedCriteriaMap(
  client: SupabaseClient<Database>,
  productIds: string[],
): Promise<Map<string, ExtractedCriteria>> {
  const criteriaMap = new Map<string, ExtractedCriteria>();
  if (productIds.length === 0) {
    return criteriaMap;
  }

  const { data, error } = await client
    .from("carrier_underwriting_criteria")
    .select("product_id, criteria, updated_at")
    .in("product_id", productIds)
    .eq("review_status", "approved")
    .order("product_id", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to fetch underwriting criteria context: ${error.message}`,
    );
  }

  for (const row of data ?? []) {
    if (!criteriaMap.has(row.product_id)) {
      criteriaMap.set(row.product_id, row.criteria as ExtractedCriteria);
    }
  }

  return criteriaMap;
}

export async function fetchPremiumMatrixMap(
  client: SupabaseClient<Database>,
  productIds: string[],
  imoId: string,
  gender: GenderType,
  tobaccoUse: boolean,
): Promise<Map<string, PremiumMatrix[]>> {
  const matrixMap = new Map<string, PremiumMatrix[]>();
  if (productIds.length === 0) {
    return matrixMap;
  }

  const tobaccoClass: TobaccoClass = tobaccoUse ? "tobacco" : "non_tobacco";
  const pageSize = 5000;
  const selectQuery = `
    *,
    product:products(id, name, product_type, carrier_id)
  `;

  const {
    data: firstPage,
    error,
    count,
  } = await client
    .from("premium_matrix")
    .select(selectQuery, { count: "exact" })
    .in("product_id", productIds)
    .eq("imo_id", imoId)
    .eq("gender", gender)
    .eq("tobacco_class", tobaccoClass)
    .order("product_id", { ascending: true })
    .order("age", { ascending: true })
    .order("face_amount", { ascending: true })
    .range(0, pageSize - 1);

  if (error) {
    throw new Error(`Failed to fetch premium matrix context: ${error.message}`);
  }

  let allRows = (firstPage ?? []) as PremiumMatrix[];
  const totalRows = count ?? allRows.length;

  if (allRows.length >= pageSize && totalRows > pageSize) {
    const totalPages = Math.ceil(totalRows / pageSize);
    const pageResults = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        client
          .from("premium_matrix")
          .select(selectQuery)
          .in("product_id", productIds)
          .eq("imo_id", imoId)
          .eq("gender", gender)
          .eq("tobacco_class", tobaccoClass)
          .order("product_id", { ascending: true })
          .order("age", { ascending: true })
          .order("face_amount", { ascending: true })
          .range((index + 1) * pageSize, (index + 2) * pageSize - 1),
      ),
    );

    for (const page of pageResults) {
      if (page.error) {
        throw new Error(
          `Failed to fetch premium matrix context page: ${page.error.message}`,
        );
      }
      allRows = allRows.concat((page.data ?? []) as PremiumMatrix[]);
    }
  }

  for (const row of allRows) {
    const existing = matrixMap.get(row.product_id) ?? [];
    existing.push(row);
    matrixMap.set(row.product_id, existing);
  }

  return matrixMap;
}

export async function fetchBuildChartMap(
  client: SupabaseClient<Database>,
  products: ProductCandidate[],
  imoId: string,
): Promise<Map<string, BuildChartInfo>> {
  const chartMap = new Map<string, BuildChartInfo>();
  if (products.length === 0) {
    return chartMap;
  }

  const specificChartIds: string[] = [];
  const carriersNeedingDefault: string[] = [];
  const productsByChartId = new Map<string, string[]>();
  const productsByCarrier = new Map<string, string[]>();

  for (const product of products) {
    if (product.buildChartId) {
      specificChartIds.push(product.buildChartId);
      productsByChartId.set(product.buildChartId, [
        ...(productsByChartId.get(product.buildChartId) ?? []),
        product.productId,
      ]);
      continue;
    }

    if (!carriersNeedingDefault.includes(product.carrierId)) {
      carriersNeedingDefault.push(product.carrierId);
    }
    productsByCarrier.set(product.carrierId, [
      ...(productsByCarrier.get(product.carrierId) ?? []),
      product.productId,
    ]);
  }

  const [specificCharts, defaultCharts] = await Promise.all([
    specificChartIds.length > 0
      ? client
          .from("carrier_build_charts")
          .select("id, table_type, build_data, bmi_data")
          .in("id", specificChartIds)
          .then(({ data, error }) => {
            if (error) {
              throw new Error(
                `Failed to fetch product-specific build charts: ${error.message}`,
              );
            }
            return data ?? [];
          })
      : Promise.resolve([]),
    carriersNeedingDefault.length > 0
      ? client
          .from("carrier_build_charts")
          .select(
            "id, carrier_id, table_type, build_data, bmi_data, is_default, created_at",
          )
          .in("carrier_id", carriersNeedingDefault)
          .eq("imo_id", imoId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true })
          .then(({ data, error }) => {
            if (error) {
              throw new Error(
                `Failed to fetch default build charts: ${error.message}`,
              );
            }
            return data ?? [];
          })
      : Promise.resolve([]),
  ]);

  for (const chart of specificCharts) {
    const info: BuildChartInfo = {
      tableType: chart.table_type as BuildChartInfo["tableType"],
      buildData: chart.build_data as BuildChartInfo["buildData"],
      bmiData: chart.bmi_data as BuildChartInfo["bmiData"],
    };

    for (const productId of productsByChartId.get(chart.id) ?? []) {
      chartMap.set(productId, info);
    }
  }

  const carrierDefaults = new Map<string, BuildChartInfo>();
  for (const chart of defaultCharts) {
    if (!carrierDefaults.has(chart.carrier_id)) {
      carrierDefaults.set(chart.carrier_id, {
        tableType: chart.table_type as BuildChartInfo["tableType"],
        buildData: chart.build_data as BuildChartInfo["buildData"],
        bmiData: chart.bmi_data as BuildChartInfo["bmiData"],
      });
    }
  }

  for (const [carrierId, info] of carrierDefaults) {
    for (const productId of productsByCarrier.get(carrierId) ?? []) {
      if (!chartMap.has(productId)) {
        chartMap.set(productId, info);
      }
    }
  }

  return chartMap;
}

async function fetchRuleSets(
  client: SupabaseClient<Database>,
  params: {
    imoId: string;
    carrierIds: string[];
    productIds: string[];
    scope: RuleSetScope;
    conditionCodes?: string[];
    reviewStatus?: ReviewStatus;
  },
): Promise<RuleSetWithRules[]> {
  if (params.carrierIds.length === 0) {
    return [];
  }

  let query = client
    .from("underwriting_rule_sets")
    .select(
      `
      *,
      rules:underwriting_rules(*)
      `,
    )
    .eq("imo_id", params.imoId)
    .in("carrier_id", params.carrierIds)
    .eq("review_status", params.reviewStatus ?? "approved")
    .eq("is_active", true)
    .eq("scope", params.scope);

  const productScopeFilter = buildProductScopeFilter(params.productIds);
  if (productScopeFilter.type === "is-null") {
    query = query.is("product_id", null);
  } else {
    query = query.or(productScopeFilter.value);
  }

  if (params.scope === "condition") {
    if (!params.conditionCodes || params.conditionCodes.length === 0) {
      return [];
    }
    query = query.in("condition_code", params.conditionCodes);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch underwriting rule sets: ${error.message}`);
  }

  return (data ?? []).map((ruleSet) => ({
    ...ruleSet,
    rules: (ruleSet.rules ?? []).sort((a, b) => a.priority - b.priority),
  }));
}

export async function fetchApprovedGlobalRuleSets(
  client: SupabaseClient<Database>,
  params: {
    imoId: string;
    carrierIds: string[];
    productIds: string[];
  },
): Promise<RuleSetWithRules[]> {
  return fetchRuleSets(client, {
    ...params,
    scope: "global",
  });
}

export async function fetchApprovedConditionRuleSets(
  client: SupabaseClient<Database>,
  params: {
    imoId: string;
    carrierIds: string[];
    productIds: string[];
    conditionCodes: string[];
  },
): Promise<RuleSetWithRules[]> {
  return fetchRuleSets(client, {
    ...params,
    scope: "condition",
    conditionCodes: params.conditionCodes,
  });
}
