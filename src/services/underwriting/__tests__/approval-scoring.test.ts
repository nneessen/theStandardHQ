// src/services/underwriting/__tests__/approval-scoring.test.ts
// Unit tests for approval scoring functions
// Tests determineHealthClass and applyBuildConstraint from the extracted module

import { describe, it, expect } from "vitest";

// =============================================================================
// Import from actual production modules
// =============================================================================

import {
  HEALTH_CLASS_SEVERITY,
  applyBuildConstraint,
  determineHealthClass,
} from "../core/approval-scoring";

import type {
  HealthClass,
  ConditionDecision,
} from "../core/decision-engine.types";
import type { BuildRatingClass } from "@/features/underwriting";

// =============================================================================
// Test Helpers
// =============================================================================

function createConditionDecision(
  overrides: Partial<ConditionDecision> = {},
): ConditionDecision {
  return {
    conditionCode: "test_condition",
    decision: "approved",
    likelihood: 0.9,
    healthClassResult: "standard",
    isApproved: true,
    ...overrides,
  };
}

// =============================================================================
// Tests: HEALTH_CLASS_SEVERITY constant
// =============================================================================

describe("HEALTH_CLASS_SEVERITY", () => {
  it("has correct ordering (preferred_plus is best)", () => {
    expect(HEALTH_CLASS_SEVERITY["preferred_plus"]).toBe(0);
  });

  it("has correct ordering (preferred < standard_plus)", () => {
    expect(HEALTH_CLASS_SEVERITY["preferred"]).toBeLessThan(
      HEALTH_CLASS_SEVERITY["standard_plus"],
    );
  });

  it("has correct ordering (standard_plus < standard)", () => {
    expect(HEALTH_CLASS_SEVERITY["standard_plus"]).toBeLessThan(
      HEALTH_CLASS_SEVERITY["standard"],
    );
  });

  it("has correct ordering (standard < table_rated)", () => {
    expect(HEALTH_CLASS_SEVERITY["standard"]).toBeLessThan(
      HEALTH_CLASS_SEVERITY["table_rated"],
    );
  });

  it("treats all table ratings equally", () => {
    const tables = [
      "table_a",
      "table_b",
      "table_c",
      "table_d",
      "table_e",
      "table_f",
      "table_g",
      "table_h",
      "table_rated",
    ];
    const severities = tables.map((t) => HEALTH_CLASS_SEVERITY[t]);
    expect(new Set(severities).size).toBe(1); // All same value
    expect(severities[0]).toBe(4);
  });
});

// =============================================================================
// Tests: applyBuildConstraint
// =============================================================================

describe("applyBuildConstraint", () => {
  describe("build chart cannot improve health class", () => {
    it("keeps rule engine class when build is better", () => {
      const result = applyBuildConstraint("standard", "preferred_plus");
      expect(result).toBe("standard");
    });

    it("keeps rule engine class when build is same", () => {
      const result = applyBuildConstraint("preferred", "preferred");
      expect(result).toBe("preferred");
    });

    it("keeps standard_plus when build is preferred", () => {
      const result = applyBuildConstraint("standard_plus", "preferred");
      expect(result).toBe("standard_plus");
    });
  });

  describe("build chart can worsen health class", () => {
    it("downgrades preferred_plus to standard when build is standard", () => {
      const result = applyBuildConstraint("preferred_plus", "standard");
      expect(result).toBe("standard");
    });

    it("downgrades preferred to standard_plus when build is standard_plus", () => {
      const result = applyBuildConstraint("preferred", "standard_plus");
      expect(result).toBe("standard_plus");
    });

    it("downgrades standard to table_rated when build is table rating", () => {
      const result = applyBuildConstraint("standard", "table_a");
      expect(result).toBe("table_rated");
    });
  });

  describe("table ratings map to table_rated", () => {
    const tableRatings: BuildRatingClass[] = [
      "table_a",
      "table_b",
      "table_c",
      "table_d",
      "table_e",
      "table_f",
      "table_g",
      "table_h",
      "table_i",
      "table_j",
      "table_k",
      "table_l",
      "table_m",
      "table_n",
      "table_o",
      "table_p",
    ];

    tableRatings.forEach((tableRating) => {
      it(`maps ${tableRating} to table_rated when worse than rule engine`, () => {
        const result = applyBuildConstraint("preferred", tableRating);
        expect(result).toBe("table_rated");
      });
    });
  });

  describe("standard class mappings", () => {
    it("maps build preferred_plus correctly when it worsens", () => {
      // This case shouldn't happen (preferred_plus can't worsen anything)
      // but testing the mapping logic
      const result = applyBuildConstraint("preferred_plus", "preferred_plus");
      expect(result).toBe("preferred_plus");
    });

    it("maps build preferred correctly", () => {
      const result = applyBuildConstraint("preferred_plus", "preferred");
      expect(result).toBe("preferred");
    });

    it("maps build standard_plus correctly", () => {
      const result = applyBuildConstraint("preferred_plus", "standard_plus");
      expect(result).toBe("standard_plus");
    });

    it("maps build standard correctly", () => {
      const result = applyBuildConstraint("preferred_plus", "standard");
      expect(result).toBe("standard");
    });
  });

  describe("edge cases", () => {
    it("handles unknown build rating by using default severity", () => {
      const result = applyBuildConstraint("preferred", "unknown");
      // unknown maps to severity 3 (standard), which is worse than preferred (1)
      // But since "unknown" is not in standardClassMap, it returns table_rated
      expect(result).toBe("table_rated");
    });
  });
});

// =============================================================================
// Tests: determineHealthClass
// =============================================================================

describe("determineHealthClass", () => {
  describe("empty conditions", () => {
    it("returns preferred_plus with no condition decisions", () => {
      const result = determineHealthClass([]);
      expect(result).toBe("preferred_plus");
    });
  });

  describe("single condition", () => {
    it("returns health class from single decision", () => {
      const decisions = [
        createConditionDecision({ healthClassResult: "standard" }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("standard");
    });

    it("returns preferred_plus when decision has null health class", () => {
      const decisions = [createConditionDecision({ healthClassResult: null })];
      const result = determineHealthClass(decisions);
      expect(result).toBe("preferred_plus");
    });

    it("maps table_a to table_rated", () => {
      const decisions = [
        createConditionDecision({ healthClassResult: "table_a" }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("table_rated");
    });

    it("maps table_d to table_rated", () => {
      const decisions = [
        createConditionDecision({ healthClassResult: "table_d" }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("table_rated");
    });
  });

  describe("multiple conditions - worst class wins", () => {
    it("returns standard when one condition is standard and one is preferred", () => {
      const decisions = [
        createConditionDecision({
          conditionCode: "diabetes",
          healthClassResult: "preferred",
        }),
        createConditionDecision({
          conditionCode: "hypertension",
          healthClassResult: "standard",
        }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("standard");
    });

    it("returns table_rated when any condition is table rated", () => {
      const decisions = [
        createConditionDecision({
          conditionCode: "diabetes",
          healthClassResult: "preferred",
        }),
        createConditionDecision({
          conditionCode: "obesity",
          healthClassResult: "table_b",
        }),
        createConditionDecision({
          conditionCode: "hypertension",
          healthClassResult: "standard",
        }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("table_rated");
    });

    it("returns preferred when best condition is preferred", () => {
      const decisions = [
        createConditionDecision({
          conditionCode: "mild_condition",
          healthClassResult: "preferred",
        }),
        createConditionDecision({
          conditionCode: "another",
          healthClassResult: null,
        }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("preferred");
    });

    it("returns standard_plus correctly", () => {
      const decisions = [
        createConditionDecision({
          conditionCode: "cond1",
          healthClassResult: "preferred",
        }),
        createConditionDecision({
          conditionCode: "cond2",
          healthClassResult: "standard_plus",
        }),
        createConditionDecision({
          conditionCode: "cond3",
          healthClassResult: "preferred_plus",
        }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("standard_plus");
    });
  });

  describe("all health class levels", () => {
    const testCases: Array<{
      healthClass: HealthClass;
      expected: HealthClass;
    }> = [
      { healthClass: "preferred_plus", expected: "preferred_plus" },
      { healthClass: "preferred", expected: "preferred" },
      { healthClass: "standard_plus", expected: "standard_plus" },
      { healthClass: "standard", expected: "standard" },
      { healthClass: "table_rated", expected: "table_rated" },
    ];

    testCases.forEach(({ healthClass, expected }) => {
      it(`correctly identifies ${healthClass}`, () => {
        const decisions = [
          createConditionDecision({ healthClassResult: healthClass }),
        ];
        const result = determineHealthClass(decisions);
        expect(result).toBe(expected);
      });
    });
  });

  describe("mixed null and valid health classes", () => {
    it("ignores null and uses valid health class", () => {
      const decisions = [
        createConditionDecision({
          conditionCode: "cond1",
          healthClassResult: null,
        }),
        createConditionDecision({
          conditionCode: "cond2",
          healthClassResult: null,
        }),
        createConditionDecision({
          conditionCode: "cond3",
          healthClassResult: "standard_plus",
        }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("standard_plus");
    });

    it("returns preferred_plus when all health classes are null", () => {
      const decisions = [
        createConditionDecision({
          conditionCode: "cond1",
          healthClassResult: null,
        }),
        createConditionDecision({
          conditionCode: "cond2",
          healthClassResult: null,
        }),
      ];
      const result = determineHealthClass(decisions);
      expect(result).toBe("preferred_plus");
    });
  });
});
