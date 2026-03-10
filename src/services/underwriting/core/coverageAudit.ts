import type { Database, Json } from "@/types/database.types";

type RuleSetRow = Database["public"]["Tables"]["underwriting_rule_sets"]["Row"];
type RuleRow = Database["public"]["Tables"]["underwriting_rules"]["Row"];
type AcceptanceRow =
  Database["public"]["Tables"]["carrier_condition_acceptance"]["Row"];
type HealthConditionRow =
  Database["public"]["Tables"]["underwriting_health_conditions"]["Row"];

export interface CoverageAuditCarrierProduct {
  carrierId: string;
  carrierName: string;
  productId: string;
  productName: string;
  productType: string;
}

export interface CoverageAuditRuleSet extends Pick<
  RuleSetRow,
  | "id"
  | "carrier_id"
  | "product_id"
  | "condition_code"
  | "default_outcome"
  | "name"
  | "updated_at"
  | "version"
> {
  rules: Array<Pick<RuleRow, "outcome_eligibility" | "predicate">>;
}

export type CoverageAuditAcceptanceRule = Pick<
  AcceptanceRow,
  | "acceptance"
  | "carrier_id"
  | "condition_code"
  | "notes"
  | "product_type"
  | "review_status"
  | "updated_at"
>;

export type CoverageAuditStatus =
  | "rule_based"
  | "manual_review_only"
  | "legacy_acceptance_only"
  | "missing";

export type CoverageAuditProductStatus = "ready" | "review" | "unsafe";

export interface CoverageAuditConditionRow {
  category: string;
  carrierId: string;
  conditionCode: string;
  conditionName: string;
  hasMedicationRule: boolean;
  legacyAcceptanceDecision: string | null;
  legacyAcceptanceNotes: string | null;
  productId: string;
  ruleSetId: string | null;
  ruleSetName: string | null;
  source:
    | "product_rule_set"
    | "carrier_rule_set"
    | "legacy_acceptance"
    | "missing";
  status: CoverageAuditStatus;
}

export interface CoverageAuditProductRow {
  carrierId: string;
  carrierName: string;
  definitiveCoveragePercent: number;
  legacyAcceptanceOnlyCount: number;
  manualReviewOnlyCount: number;
  medicationAwareCount: number;
  missingCount: number;
  productId: string;
  productName: string;
  productStatus: CoverageAuditProductStatus;
  productType: string;
  ruleBasedCount: number;
  totalConditions: number;
  conditions: CoverageAuditConditionRow[];
}

export interface CoverageAuditCarrierRow {
  carrierId: string;
  carrierName: string;
  legacyAcceptanceOnlyCount: number;
  manualReviewOnlyCount: number;
  missingCount: number;
  productCount: number;
  products: CoverageAuditProductRow[];
  readyProducts: number;
  reviewProducts: number;
  ruleBasedCount: number;
  totalConditions: number;
  unsafeProducts: number;
  medicationAwareCount: number;
}

export interface CoverageAuditSummary {
  legacyAcceptanceOnlyConditions: number;
  manualReviewOnlyConditions: number;
  medicationAwareConditions: number;
  missingConditions: number;
  readyProducts: number;
  reviewProducts: number;
  totalProducts: number;
  unsafeProducts: number;
}

export interface CoverageAuditReport {
  carriers: CoverageAuditCarrierRow[];
  generatedAt: string;
  products: CoverageAuditProductRow[];
  summary: CoverageAuditSummary;
}

function parseDefaultOutcomeEligibility(
  defaultOutcome: Json | null,
): string | null {
  if (!defaultOutcome || Array.isArray(defaultOutcome)) {
    return null;
  }

  const rawEligibility = (defaultOutcome as { eligibility?: Json }).eligibility;
  return typeof rawEligibility === "string" ? rawEligibility : null;
}

function hasMedicationPredicate(node: Json | null | undefined): boolean {
  if (!node) {
    return false;
  }

  if (Array.isArray(node)) {
    return node.some((entry) => hasMedicationPredicate(entry));
  }

  if (typeof node !== "object") {
    return false;
  }

  if (typeof node.field === "string" && node.field.startsWith("medications.")) {
    return true;
  }

  return Object.values(node).some((value) =>
    hasMedicationPredicate(value ?? null),
  );
}

export function classifyRuleSetCoverage(ruleSet: CoverageAuditRuleSet): {
  hasMedicationRule: boolean;
  status: Extract<CoverageAuditStatus, "manual_review_only" | "rule_based">;
} {
  const hasDecisiveRule = ruleSet.rules.some(
    (rule) =>
      rule.outcome_eligibility === "eligible" ||
      rule.outcome_eligibility === "ineligible",
  );
  const defaultEligibility = parseDefaultOutcomeEligibility(
    ruleSet.default_outcome,
  );
  const hasDecisiveDefault =
    defaultEligibility === "eligible" || defaultEligibility === "ineligible";

  return {
    status:
      hasDecisiveRule || hasDecisiveDefault
        ? "rule_based"
        : "manual_review_only",
    hasMedicationRule: ruleSet.rules.some((rule) =>
      hasMedicationPredicate(rule.predicate),
    ),
  };
}

function getRuleSetPriority(ruleSet: CoverageAuditRuleSet): number {
  return ruleSet.version ?? 0;
}

function getRuleSetUpdatedAt(ruleSet: CoverageAuditRuleSet): number {
  return ruleSet.updated_at ? Date.parse(ruleSet.updated_at) : 0;
}

function chooseBestRuleSet(
  current: CoverageAuditRuleSet | undefined,
  candidate: CoverageAuditRuleSet,
): CoverageAuditRuleSet {
  if (!current) {
    return candidate;
  }

  const currentPriority = getRuleSetPriority(current);
  const candidatePriority = getRuleSetPriority(candidate);

  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }

  return getRuleSetUpdatedAt(candidate) >= getRuleSetUpdatedAt(current)
    ? candidate
    : current;
}

function chooseBestAcceptanceRule(
  current: CoverageAuditAcceptanceRule | undefined,
  candidate: CoverageAuditAcceptanceRule,
): CoverageAuditAcceptanceRule {
  if (!current) {
    return candidate;
  }

  const currentUpdatedAt = current.updated_at
    ? Date.parse(current.updated_at)
    : 0;
  const candidateUpdatedAt = candidate.updated_at
    ? Date.parse(candidate.updated_at)
    : 0;

  return candidateUpdatedAt >= currentUpdatedAt ? candidate : current;
}

function getProductStatus(
  product: Pick<
    CoverageAuditProductRow,
    "legacyAcceptanceOnlyCount" | "manualReviewOnlyCount" | "missingCount"
  >,
): CoverageAuditProductStatus {
  if (product.missingCount > 0 || product.legacyAcceptanceOnlyCount > 0) {
    return "unsafe";
  }

  if (product.manualReviewOnlyCount > 0) {
    return "review";
  }

  return "ready";
}

function roundPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

function compareProductSeverity(
  left: CoverageAuditProductRow,
  right: CoverageAuditProductRow,
): number {
  const severityRank: Record<CoverageAuditProductStatus, number> = {
    unsafe: 0,
    review: 1,
    ready: 2,
  };

  const rankDiff =
    severityRank[left.productStatus] - severityRank[right.productStatus];
  if (rankDiff !== 0) {
    return rankDiff;
  }

  if (left.missingCount !== right.missingCount) {
    return right.missingCount - left.missingCount;
  }

  if (left.legacyAcceptanceOnlyCount !== right.legacyAcceptanceOnlyCount) {
    return right.legacyAcceptanceOnlyCount - left.legacyAcceptanceOnlyCount;
  }

  if (left.manualReviewOnlyCount !== right.manualReviewOnlyCount) {
    return right.manualReviewOnlyCount - left.manualReviewOnlyCount;
  }

  if (left.ruleBasedCount !== right.ruleBasedCount) {
    return left.ruleBasedCount - right.ruleBasedCount;
  }

  return left.productName.localeCompare(right.productName);
}

export function buildCoverageAuditReport(params: {
  acceptanceRules: CoverageAuditAcceptanceRule[];
  carrierProducts: CoverageAuditCarrierProduct[];
  healthConditions: Pick<HealthConditionRow, "category" | "code" | "name">[];
  ruleSets: CoverageAuditRuleSet[];
}): CoverageAuditReport {
  const { acceptanceRules, carrierProducts, healthConditions, ruleSets } =
    params;

  const sortedConditions = [...healthConditions].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  const preferredRuleSets = new Map<string, CoverageAuditRuleSet>();
  for (const ruleSet of ruleSets) {
    if (!ruleSet.condition_code) {
      continue;
    }

    const key = [
      ruleSet.carrier_id,
      ruleSet.product_id ?? "all",
      ruleSet.condition_code,
    ].join(":");
    preferredRuleSets.set(
      key,
      chooseBestRuleSet(preferredRuleSets.get(key), ruleSet),
    );
  }

  const preferredAcceptanceRules = new Map<
    string,
    CoverageAuditAcceptanceRule
  >();
  for (const acceptanceRule of acceptanceRules) {
    const key = [
      acceptanceRule.carrier_id,
      acceptanceRule.product_type ?? "all",
      acceptanceRule.condition_code,
    ].join(":");
    preferredAcceptanceRules.set(
      key,
      chooseBestAcceptanceRule(
        preferredAcceptanceRules.get(key),
        acceptanceRule,
      ),
    );
  }

  const productRows = carrierProducts.map((product) => {
    const conditions = sortedConditions.map((condition) => {
      const productRuleSet = preferredRuleSets.get(
        [product.carrierId, product.productId, condition.code].join(":"),
      );
      const carrierRuleSet = preferredRuleSets.get(
        [product.carrierId, "all", condition.code].join(":"),
      );
      const applicableRuleSet = productRuleSet ?? carrierRuleSet;

      const productAcceptance = preferredAcceptanceRules.get(
        [product.carrierId, product.productType, condition.code].join(":"),
      );
      const carrierAcceptance = preferredAcceptanceRules.get(
        [product.carrierId, "all", condition.code].join(":"),
      );
      const applicableAcceptance = productAcceptance ?? carrierAcceptance;

      if (applicableRuleSet) {
        const classification = classifyRuleSetCoverage(applicableRuleSet);

        return {
          category: condition.category,
          carrierId: product.carrierId,
          conditionCode: condition.code,
          conditionName: condition.name,
          hasMedicationRule: classification.hasMedicationRule,
          legacyAcceptanceDecision: applicableAcceptance?.acceptance ?? null,
          legacyAcceptanceNotes: applicableAcceptance?.notes ?? null,
          productId: product.productId,
          ruleSetId: applicableRuleSet.id,
          ruleSetName: applicableRuleSet.name,
          source: productRuleSet ? "product_rule_set" : "carrier_rule_set",
          status: classification.status,
        } satisfies CoverageAuditConditionRow;
      }

      if (applicableAcceptance) {
        return {
          category: condition.category,
          carrierId: product.carrierId,
          conditionCode: condition.code,
          conditionName: condition.name,
          hasMedicationRule: false,
          legacyAcceptanceDecision: applicableAcceptance.acceptance,
          legacyAcceptanceNotes: applicableAcceptance.notes,
          productId: product.productId,
          ruleSetId: null,
          ruleSetName: null,
          source: "legacy_acceptance",
          status: "legacy_acceptance_only",
        } satisfies CoverageAuditConditionRow;
      }

      return {
        category: condition.category,
        carrierId: product.carrierId,
        conditionCode: condition.code,
        conditionName: condition.name,
        hasMedicationRule: false,
        legacyAcceptanceDecision: null,
        legacyAcceptanceNotes: null,
        productId: product.productId,
        ruleSetId: null,
        ruleSetName: null,
        source: "missing",
        status: "missing",
      } satisfies CoverageAuditConditionRow;
    });

    const ruleBasedCount = conditions.filter(
      (condition) => condition.status === "rule_based",
    ).length;
    const manualReviewOnlyCount = conditions.filter(
      (condition) => condition.status === "manual_review_only",
    ).length;
    const legacyAcceptanceOnlyCount = conditions.filter(
      (condition) => condition.status === "legacy_acceptance_only",
    ).length;
    const missingCount = conditions.filter(
      (condition) => condition.status === "missing",
    ).length;
    const medicationAwareCount = conditions.filter(
      (condition) => condition.hasMedicationRule,
    ).length;

    const productRow: CoverageAuditProductRow = {
      carrierId: product.carrierId,
      carrierName: product.carrierName,
      definitiveCoveragePercent: roundPercent(
        ruleBasedCount,
        sortedConditions.length,
      ),
      legacyAcceptanceOnlyCount,
      manualReviewOnlyCount,
      medicationAwareCount,
      missingCount,
      productId: product.productId,
      productName: product.productName,
      productStatus: "ready",
      productType: product.productType,
      ruleBasedCount,
      totalConditions: sortedConditions.length,
      conditions,
    };

    productRow.productStatus = getProductStatus(productRow);
    return productRow;
  });

  productRows.sort(compareProductSeverity);

  const carrierRows = Array.from(
    productRows.reduce((acc, product) => {
      const existing = acc.get(product.carrierId);
      if (existing) {
        existing.products.push(product);
        existing.productCount += 1;
        existing.readyProducts += product.productStatus === "ready" ? 1 : 0;
        existing.reviewProducts += product.productStatus === "review" ? 1 : 0;
        existing.unsafeProducts += product.productStatus === "unsafe" ? 1 : 0;
        existing.ruleBasedCount += product.ruleBasedCount;
        existing.manualReviewOnlyCount += product.manualReviewOnlyCount;
        existing.legacyAcceptanceOnlyCount += product.legacyAcceptanceOnlyCount;
        existing.missingCount += product.missingCount;
        existing.totalConditions += product.totalConditions;
        existing.medicationAwareCount += product.medicationAwareCount;
        return acc;
      }

      acc.set(product.carrierId, {
        carrierId: product.carrierId,
        carrierName: product.carrierName,
        legacyAcceptanceOnlyCount: product.legacyAcceptanceOnlyCount,
        manualReviewOnlyCount: product.manualReviewOnlyCount,
        missingCount: product.missingCount,
        medicationAwareCount: product.medicationAwareCount,
        productCount: 1,
        products: [product],
        readyProducts: product.productStatus === "ready" ? 1 : 0,
        reviewProducts: product.productStatus === "review" ? 1 : 0,
        ruleBasedCount: product.ruleBasedCount,
        totalConditions: product.totalConditions,
        unsafeProducts: product.productStatus === "unsafe" ? 1 : 0,
      });
      return acc;
    }, new Map<string, CoverageAuditCarrierRow>()),
  )
    .map(([, carrier]) => {
      carrier.products.sort(compareProductSeverity);
      return carrier;
    })
    .sort((left, right) => {
      if (left.unsafeProducts !== right.unsafeProducts) {
        return right.unsafeProducts - left.unsafeProducts;
      }

      if (left.reviewProducts !== right.reviewProducts) {
        return right.reviewProducts - left.reviewProducts;
      }

      return left.carrierName.localeCompare(right.carrierName);
    });

  const summary: CoverageAuditSummary = {
    legacyAcceptanceOnlyConditions: productRows.reduce(
      (total, product) => total + product.legacyAcceptanceOnlyCount,
      0,
    ),
    manualReviewOnlyConditions: productRows.reduce(
      (total, product) => total + product.manualReviewOnlyCount,
      0,
    ),
    medicationAwareConditions: productRows.reduce(
      (total, product) => total + product.medicationAwareCount,
      0,
    ),
    missingConditions: productRows.reduce(
      (total, product) => total + product.missingCount,
      0,
    ),
    readyProducts: productRows.filter(
      (product) => product.productStatus === "ready",
    ).length,
    reviewProducts: productRows.filter(
      (product) => product.productStatus === "review",
    ).length,
    totalProducts: productRows.length,
    unsafeProducts: productRows.filter(
      (product) => product.productStatus === "unsafe",
    ).length,
  };

  return {
    carriers: carrierRows,
    generatedAt: new Date().toISOString(),
    products: productRows,
    summary,
  };
}
