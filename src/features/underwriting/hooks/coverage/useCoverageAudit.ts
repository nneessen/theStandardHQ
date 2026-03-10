import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/base/supabase";
import {
  buildCoverageAuditReport,
  type CoverageAuditAcceptanceRule,
  type CoverageAuditCarrierProduct,
  type CoverageAuditReport,
  type CoverageAuditRuleSet,
} from "@/services/underwriting/core/coverageAudit";

const PAGE_SIZE = 1000;

type CarrierProductQueryRow = {
  id: string;
  name: string;
  products: Array<{
    id: string;
    name: string;
    product_type: string;
  }> | null;
};

export const coverageAuditKeys = {
  all: ["underwriting", "coverage-audit", "v1"] as const,
  byImo: (imoId: string) => [...coverageAuditKeys.all, imoId] as const,
};

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
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildPage(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function fetchCarriersWithProducts(imoId: string) {
  const [imoCarriersResult, globalCarriersResult] = await Promise.all([
    supabase
      .from("carriers")
      .select(
        `
        id,
        name,
        products (
          id,
          name,
          product_type
        )
      `,
      )
      .eq("is_active", true)
      .eq("imo_id", imoId),
    supabase
      .from("carriers")
      .select(
        `
        id,
        name,
        products (
          id,
          name,
          product_type
        )
      `,
      )
      .eq("is_active", true)
      .is("imo_id", null),
  ]);

  if (imoCarriersResult.error) {
    throw new Error(imoCarriersResult.error.message);
  }

  if (globalCarriersResult.error) {
    throw new Error(globalCarriersResult.error.message);
  }

  const uniqueCarriers = Array.from(
    new Map(
      [
        ...(imoCarriersResult.data ?? []),
        ...(globalCarriersResult.data ?? []),
      ].map((carrier) => [carrier.id, carrier]),
    ).values(),
  ) as CarrierProductQueryRow[];

  return uniqueCarriers.flatMap((carrier): CoverageAuditCarrierProduct[] =>
    (carrier.products ?? []).map((product) => ({
      carrierId: carrier.id,
      carrierName: carrier.name,
      productId: product.id,
      productName: product.name,
      productType: product.product_type,
    })),
  );
}

async function fetchCoverageAuditRuleSets(
  imoId: string,
): Promise<CoverageAuditRuleSet[]> {
  return fetchPagedRows<CoverageAuditRuleSet>(
    async (from, to) =>
      await supabase
        .from("underwriting_rule_sets")
        .select(
          `
        id,
        carrier_id,
        product_id,
        condition_code,
        default_outcome,
        name,
        updated_at,
        version,
        rules:underwriting_rules (
          outcome_eligibility,
          predicate
        )
      `,
        )
        .eq("imo_id", imoId)
        .eq("scope", "condition")
        .eq("review_status", "approved")
        .eq("is_active", true)
        .not("condition_code", "is", null)
        .range(from, to),
  );
}

async function fetchCoverageAuditAcceptanceRules(
  imoId: string,
): Promise<CoverageAuditAcceptanceRule[]> {
  return fetchPagedRows<CoverageAuditAcceptanceRule>(
    async (from, to) =>
      await supabase
        .from("carrier_condition_acceptance")
        .select(
          `
        acceptance,
        carrier_id,
        condition_code,
        notes,
        product_type,
        review_status,
        updated_at
      `,
        )
        .eq("imo_id", imoId)
        .eq("review_status", "approved")
        .range(from, to),
  );
}

export async function fetchCoverageAudit(
  imoId: string,
): Promise<CoverageAuditReport> {
  const [carrierProducts, healthConditionsResult, ruleSets, acceptanceRules] =
    await Promise.all([
      fetchCarriersWithProducts(imoId),
      supabase
        .from("underwriting_health_conditions")
        .select("code, name, category")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      fetchCoverageAuditRuleSets(imoId),
      fetchCoverageAuditAcceptanceRules(imoId),
    ]);

  if (healthConditionsResult.error) {
    throw new Error(healthConditionsResult.error.message);
  }

  return buildCoverageAuditReport({
    acceptanceRules,
    carrierProducts,
    healthConditions: healthConditionsResult.data ?? [],
    ruleSets,
  });
}

export function useCoverageAudit() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: coverageAuditKeys.byImo(imoId ?? ""),
    queryFn: () => fetchCoverageAudit(imoId!),
    enabled: !!imoId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
