// src/services/underwriting/conditionResponseTransformer.test.ts
// Unit tests for the condition response transformer
//
// CRITICAL: These tests verify that missing inputs produce undefined outputs,
// never false/[] - this is essential for rule evaluation semantics.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transformConditionResponses } from "./core/conditionResponseTransformer";

describe("transformConditionResponses", () => {
  // Capture console.warn calls
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("diabetes transformer", () => {
    const clientAge = 55;

    it("transforms complete diabetes responses correctly", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Insulin only",
            a1c_level: 7.8,
            complications: ["Neuropathy (nerve)", "Retinopathy (eye)"],
            diagnosis_age: 45,
            type: "Type 2",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBe(true);
      expect(result.diabetes.is_controlled).toBe(false); // 7.8 >= 7.5
      expect(result.diabetes.good_control).toBe(false); // Alias for is_controlled
      expect(result.diabetes.complications).toEqual([
        "neuropathy",
        "retinopathy",
      ]);
      expect(result.diabetes.years_since_diagnosis).toBe(10); // 55 - 45
      expect(result.diabetes.type).toBe("Type 2");
      expect(result.diabetes.a1c_level).toBe(7.8); // Pass-through
    });

    it("correctly identifies controlled diabetes (A1C < 7.5)", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Oral medication only",
            a1c_level: 6.5,
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBe(false);
      expect(result.diabetes.is_controlled).toBe(true); // 6.5 < 7.5
      expect(result.diabetes.good_control).toBe(true); // Alias
    });

    it("correctly identifies uncontrolled diabetes (A1C >= 7.5)", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: 8.2,
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.is_controlled).toBe(false); // 8.2 >= 7.5
      expect(result.diabetes.good_control).toBe(false); // Alias
    });

    // =========================================================================
    // good_control field tests
    // =========================================================================

    it("sets good_control when A1C is present", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: 7.0,
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.good_control).toBe(true); // 7.0 < 7.5
      expect(result.diabetes.is_controlled).toBe(true);
    });

    it("does not set good_control when A1C is missing", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Insulin only",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.good_control).toBeUndefined();
      expect(result.diabetes.is_controlled).toBeUndefined();
    });

    // =========================================================================
    // A1C numeric string parsing tests
    // =========================================================================

    it("parses A1C from numeric string", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: "6.8", // String instead of number
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.a1c_level).toBe(6.8);
      expect(result.diabetes.is_controlled).toBe(true);
      expect(result.diabetes.good_control).toBe(true);
    });

    it("handles A1C string with whitespace", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: "  7.9  ", // String with whitespace
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.a1c_level).toBe(7.9);
      expect(result.diabetes.is_controlled).toBe(false); // 7.9 >= 7.5
    });

    it("treats invalid A1C string as undefined", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: "not a number",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.a1c_level).toBeUndefined();
      expect(result.diabetes.is_controlled).toBeUndefined();
      expect(result.diabetes.good_control).toBeUndefined();
    });

    it("treats empty A1C string as undefined", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: "",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.a1c_level).toBeUndefined();
    });

    it("treats Infinity A1C as undefined", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: Infinity,
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.a1c_level).toBeUndefined();
      expect(result.diabetes.is_controlled).toBeUndefined();
    });

    it("treats NaN A1C as undefined", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: NaN,
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.a1c_level).toBeUndefined();
      expect(result.diabetes.is_controlled).toBeUndefined();
    });

    it("identifies insulin use from 'Insulin pump' treatment", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Insulin pump",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBe(true);
    });

    it("identifies insulin use from 'Oral medication + Insulin'", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Oral medication + Insulin",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBe(true);
    });

    it("correctly identifies non-insulin treatment", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Diet and exercise only",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBe(false);
    });

    // =========================================================================
    // "No insulin" treatment string tests (CRITICAL: must not misclassify)
    // =========================================================================

    it('does NOT set insulin_use true for "No insulin" treatment', () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "No insulin",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      // CRITICAL: "No insulin" should NOT be classified as insulin use
      expect(result.diabetes.insulin_use).toBe(false);
    });

    it('does NOT set insulin_use true for "No medication" treatment', () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "No medication",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBe(false);
    });

    it("handles case-insensitive treatment matching", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "INSULIN ONLY", // Uppercase
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBe(true);
    });

    it("treats empty treatment string as undefined (no insulin_use set)", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBeUndefined();
    });

    it("treats whitespace-only treatment as undefined", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "   ",
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBeUndefined();
    });

    // =========================================================================
    // CRITICAL: Missing Input → Undefined Output Tests
    // =========================================================================

    it("preserves undefined for missing treatment (NOT false)", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c_level: 6.5,
            // treatment is MISSING
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      // CRITICAL: insulin_use should be undefined, NOT false
      expect(result.diabetes.insulin_use).toBeUndefined();
      expect(result.diabetes.is_controlled).toBe(true); // 6.5 < 7.5
    });

    it("preserves undefined for missing A1C (NOT false)", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Diet and exercise only",
            // a1c_level is MISSING
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.insulin_use).toBe(false);
      // CRITICAL: is_controlled should be undefined, NOT false
      expect(result.diabetes.is_controlled).toBeUndefined();
      // a1c_level should also be undefined (not passed through)
      expect(result.diabetes.a1c_level).toBeUndefined();
    });

    it("preserves undefined for missing complications (NOT [])", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Oral medication only",
            // complications is MISSING
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      // CRITICAL: complications should be undefined, NOT []
      expect(result.diabetes.complications).toBeUndefined();
    });

    it("preserves undefined for missing diagnosis_age", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Insulin only",
            // diagnosis_age is MISSING
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      // CRITICAL: years_since_diagnosis should be undefined
      expect(result.diabetes.years_since_diagnosis).toBeUndefined();
    });

    it("preserves undefined for missing type", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Insulin only",
            // type is MISSING
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.type).toBeUndefined();
    });

    // =========================================================================
    // Complications Normalization Tests
    // =========================================================================

    it('handles "None" complication selection correctly', () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            complications: ["None"], // User explicitly selected "None"
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      // "None" should be filtered out, resulting in empty array
      expect(result.diabetes.complications).toEqual([]);
    });

    it("normalizes all complication labels correctly", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            complications: [
              "Retinopathy (eye)",
              "Neuropathy (nerve)",
              "Nephropathy (kidney)",
              "Amputation",
              "Heart disease",
            ],
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      expect(result.diabetes.complications).toEqual([
        "retinopathy",
        "neuropathy",
        "nephropathy",
        "amputation",
        "heart_disease",
      ]);
    });

    it("treats empty complications array (no None) as undefined (unanswered)", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            complications: [], // Empty array without explicit "None" = unanswered
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      // CRITICAL: Empty array without "None" should be treated as unanswered → undefined
      // This distinguishes "user didn't answer" from "user explicitly selected None"
      expect(result.diabetes.complications).toBeUndefined();
    });

    it("handles unknown complication labels by lowercasing", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            complications: ["Unknown Complication (with notes)"],
          },
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      // Unknown labels should be lowercased with parentheticals removed
      expect(result.diabetes.complications).toEqual(["unknown complication"]);
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    it("handles diagnosis_age equal to client age (recent diagnosis)", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            diagnosis_age: 55, // Same as client age
          },
        },
      ];

      const result = transformConditionResponses(conditions, 55);

      expect(result.diabetes.years_since_diagnosis).toBe(0);
    });

    it("handles diagnosis_age greater than client age (data error)", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            diagnosis_age: 60, // Greater than client age of 55
          },
        },
      ];

      const result = transformConditionResponses(conditions, 55);

      // Should not set years_since_diagnosis for invalid data
      expect(result.diabetes.years_since_diagnosis).toBeUndefined();
    });

    it("handles negative diagnosis_age as invalid", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            diagnosis_age: -5, // Negative age is invalid
          },
        },
      ];

      const result = transformConditionResponses(conditions, 55);

      expect(result.diabetes.years_since_diagnosis).toBeUndefined();
    });

    it("handles NaN diagnosis_age as undefined", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            diagnosis_age: NaN,
          },
        },
      ];

      const result = transformConditionResponses(conditions, 55);

      expect(result.diabetes.years_since_diagnosis).toBeUndefined();
    });

    it("handles Infinity diagnosis_age as undefined", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            diagnosis_age: Infinity,
          },
        },
      ];

      const result = transformConditionResponses(conditions, 55);

      expect(result.diabetes.years_since_diagnosis).toBeUndefined();
    });

    it("parses diagnosis_age from numeric string", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            diagnosis_age: "45", // String instead of number
          },
        },
      ];

      const result = transformConditionResponses(conditions, 55);

      expect(result.diabetes.years_since_diagnosis).toBe(10); // 55 - 45
    });

    it("handles invalid diagnosis_age string as undefined", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            diagnosis_age: "not a number",
          },
        },
      ];

      const result = transformConditionResponses(conditions, 55);

      expect(result.diabetes.years_since_diagnosis).toBeUndefined();
    });

    it("handles completely empty responses", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {},
        },
      ];

      const result = transformConditionResponses(conditions, clientAge);

      // All derived fields should be undefined
      expect(result.diabetes.insulin_use).toBeUndefined();
      expect(result.diabetes.is_controlled).toBeUndefined();
      expect(result.diabetes.good_control).toBeUndefined();
      expect(result.diabetes.complications).toBeUndefined();
      expect(result.diabetes.years_since_diagnosis).toBeUndefined();
      expect(result.diabetes.type).toBeUndefined();
    });
  });

  // =========================================================================
  // Fallback for Unknown Conditions
  // =========================================================================

  describe("fallback for unknown conditions", () => {
    it("passes through raw data unchanged", () => {
      const conditions = [
        {
          conditionCode: "unknown_condition",
          conditionName: "Unknown",
          responses: { foo: "bar", baz: 123, arr: ["a", "b"] },
        },
      ];

      const result = transformConditionResponses(conditions, 50);

      // Raw data passed through unchanged
      expect(result.unknown_condition).toEqual({
        foo: "bar",
        baz: 123,
        arr: ["a", "b"],
      });
    });

    it("emits console warning for unknown conditions", () => {
      const conditions = [
        {
          conditionCode: "some_rare_condition",
          conditionName: "Rare Condition",
          responses: { severity: "mild" },
        },
      ];

      transformConditionResponses(conditions, 50);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[ConditionTransformer] No transformer for "some_rare_condition"',
        ),
      );
    });

    it("does not emit warning for known conditions", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: { treatment: "Insulin only" },
        },
      ];

      transformConditionResponses(conditions, 50);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Multiple Conditions
  // =========================================================================

  describe("multiple conditions", () => {
    it("transforms multiple conditions correctly", () => {
      const conditions = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            treatment: "Insulin only",
            a1c_level: 7.0,
          } as Record<string, string | number | string[]>,
        },
        {
          conditionCode: "hypertension",
          conditionName: "Hypertension",
          responses: {
            control_status: "well_controlled",
            medication_count: 2,
          } as Record<string, string | number | string[]>,
        },
      ];

      const result = transformConditionResponses(conditions, 55);

      // Diabetes should be transformed
      expect(result.diabetes.insulin_use).toBe(true);
      expect(result.diabetes.is_controlled).toBe(true); // 7.0 < 7.5
      expect(result.diabetes.good_control).toBe(true); // Alias

      // Hypertension should be passed through (no transformer yet)
      expect(result.hypertension).toEqual({
        control_status: "well_controlled",
        medication_count: 2,
      });

      // Warning should be emitted for hypertension
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[ConditionTransformer] No transformer for "hypertension"',
        ),
      );
    });

    it("handles empty conditions array", () => {
      const result = transformConditionResponses([], 55);

      expect(result).toEqual({});
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
