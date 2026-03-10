import { describe, expect, it } from "vitest";

import {
  buildCoverageAuditReport,
  classifyRuleSetCoverage,
  type CoverageAuditAcceptanceRule,
  type CoverageAuditCarrierProduct,
  type CoverageAuditRuleSet,
} from "../core/coverageAudit";

describe("classifyRuleSetCoverage", () => {
  it("flags decisive rule sets and medication-aware predicates", () => {
    const result = classifyRuleSetCoverage({
      id: "rule-set-1",
      carrier_id: "carrier-1",
      condition_code: "diabetes",
      default_outcome: {
        eligibility: "unknown",
      },
      name: "Diabetes",
      product_id: null,
      rules: [
        {
          outcome_eligibility: "eligible",
          predicate: {
            field: "medications.insulinUse",
            operator: "equals",
            value: false,
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 1,
    });

    expect(result.status).toBe("rule_based");
    expect(result.hasMedicationRule).toBe(true);
  });

  it("flags refer-only rule sets as manual review only", () => {
    const result = classifyRuleSetCoverage({
      id: "rule-set-2",
      carrier_id: "carrier-1",
      condition_code: "copd",
      default_outcome: {
        eligibility: "refer",
      },
      name: "COPD",
      product_id: null,
      rules: [
        {
          outcome_eligibility: "refer",
          predicate: {
            field: "copd.severity",
            operator: "equals",
            value: "moderate",
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 1,
    });

    expect(result.status).toBe("manual_review_only");
    expect(result.hasMedicationRule).toBe(false);
  });
});

describe("buildCoverageAuditReport", () => {
  const carrierProducts: CoverageAuditCarrierProduct[] = [
    {
      carrierId: "carrier-1",
      carrierName: "Carrier One",
      productId: "product-1",
      productName: "Product Unsafe",
      productType: "term_life",
    },
    {
      carrierId: "carrier-1",
      carrierName: "Carrier One",
      productId: "product-2",
      productName: "Product Review",
      productType: "whole_life",
    },
    {
      carrierId: "carrier-2",
      carrierName: "Carrier Two",
      productId: "product-3",
      productName: "Product Ready",
      productType: "term_life",
    },
  ];

  const healthConditions = [
    { code: "asthma", name: "Asthma", category: "respiratory" },
    { code: "cancer", name: "Cancer", category: "cancer" },
    { code: "diabetes", name: "Diabetes", category: "endocrine" },
  ];

  const ruleSets: CoverageAuditRuleSet[] = [
    {
      id: "rs-diabetes-carrier-1",
      carrier_id: "carrier-1",
      condition_code: "diabetes",
      default_outcome: { eligibility: "refer" },
      name: "Carrier Diabetes",
      product_id: null,
      rules: [
        {
          outcome_eligibility: "refer",
          predicate: {
            conditions: [
              {
                field: "medications.insulinUse",
                operator: "equals",
                value: true,
              },
            ],
            operator: "and",
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 1,
    },
    {
      id: "rs-asthma-carrier-1",
      carrier_id: "carrier-1",
      condition_code: "asthma",
      default_outcome: { eligibility: "refer" },
      name: "Carrier Asthma",
      product_id: null,
      rules: [
        {
          outcome_eligibility: "refer",
          predicate: {
            field: "asthma.controller_medication",
            operator: "equals",
            value: true,
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 1,
    },
    {
      id: "rs-asthma-product-1",
      carrier_id: "carrier-1",
      condition_code: "asthma",
      default_outcome: { eligibility: "unknown" },
      name: "Product Asthma",
      product_id: "product-1",
      rules: [
        {
          outcome_eligibility: "eligible",
          predicate: {
            field: "asthma.severity",
            operator: "equals",
            value: "mild",
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 2,
    },
    {
      id: "rs-cancer-product-2",
      carrier_id: "carrier-1",
      condition_code: "cancer",
      default_outcome: { eligibility: "unknown" },
      name: "Product Cancer",
      product_id: "product-2",
      rules: [
        {
          outcome_eligibility: "ineligible",
          predicate: {
            field: "cancer.years_since_treatment",
            operator: "less_than",
            value: 5,
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 1,
    },
    {
      id: "rs-asthma-product-3",
      carrier_id: "carrier-2",
      condition_code: "asthma",
      default_outcome: { eligibility: "unknown" },
      name: "Asthma Ready",
      product_id: "product-3",
      rules: [
        {
          outcome_eligibility: "eligible",
          predicate: {
            field: "asthma.severity",
            operator: "equals",
            value: "mild",
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 1,
    },
    {
      id: "rs-cancer-product-3",
      carrier_id: "carrier-2",
      condition_code: "cancer",
      default_outcome: { eligibility: "unknown" },
      name: "Cancer Ready",
      product_id: "product-3",
      rules: [
        {
          outcome_eligibility: "ineligible",
          predicate: {
            field: "cancer.stage",
            operator: "equals",
            value: "active",
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 1,
    },
    {
      id: "rs-diabetes-product-3",
      carrier_id: "carrier-2",
      condition_code: "diabetes",
      default_outcome: { eligibility: "unknown" },
      name: "Diabetes Ready",
      product_id: "product-3",
      rules: [
        {
          outcome_eligibility: "eligible",
          predicate: {
            field: "diabetes.good_control",
            operator: "equals",
            value: true,
          },
        },
      ],
      updated_at: "2026-03-08T00:00:00.000Z",
      version: 1,
    },
  ];

  const acceptanceRules: CoverageAuditAcceptanceRule[] = [
    {
      acceptance: "approved",
      carrier_id: "carrier-1",
      condition_code: "cancer",
      notes: "Legacy approval",
      product_type: "term_life",
      review_status: "approved",
      updated_at: "2026-03-08T00:00:00.000Z",
    },
  ];

  it("classifies missing, legacy-only, manual-review, and ready products", () => {
    const report = buildCoverageAuditReport({
      acceptanceRules,
      carrierProducts,
      healthConditions,
      ruleSets,
    });

    expect(report.summary.totalProducts).toBe(3);
    expect(report.summary.unsafeProducts).toBe(1);
    expect(report.summary.reviewProducts).toBe(1);
    expect(report.summary.readyProducts).toBe(1);
    expect(report.summary.legacyAcceptanceOnlyConditions).toBe(1);
    expect(report.summary.manualReviewOnlyConditions).toBe(3);
    expect(report.summary.medicationAwareConditions).toBe(2);

    const unsafe = report.products.find(
      (product) => product.productId === "product-1",
    );
    expect(unsafe?.productStatus).toBe("unsafe");
    expect(unsafe?.ruleBasedCount).toBe(1);
    expect(unsafe?.manualReviewOnlyCount).toBe(1);
    expect(unsafe?.legacyAcceptanceOnlyCount).toBe(1);

    expect(
      unsafe?.conditions.find(
        (condition) => condition.conditionCode === "diabetes",
      ),
    ).toMatchObject({
      status: "manual_review_only",
      source: "carrier_rule_set",
      hasMedicationRule: true,
    });

    expect(
      unsafe?.conditions.find(
        (condition) => condition.conditionCode === "asthma",
      ),
    ).toMatchObject({
      status: "rule_based",
      source: "product_rule_set",
    });

    expect(
      unsafe?.conditions.find(
        (condition) => condition.conditionCode === "cancer",
      ),
    ).toMatchObject({
      status: "legacy_acceptance_only",
      legacyAcceptanceDecision: "approved",
      source: "legacy_acceptance",
    });

    const review = report.products.find(
      (product) => product.productId === "product-2",
    );
    expect(review?.productStatus).toBe("review");
    expect(review?.missingCount).toBe(0);
    expect(review?.manualReviewOnlyCount).toBe(2);

    const ready = report.products.find(
      (product) => product.productId === "product-3",
    );
    expect(ready?.productStatus).toBe("ready");
    expect(ready?.ruleBasedCount).toBe(3);
    expect(ready?.definitiveCoveragePercent).toBe(100);
  });
});
