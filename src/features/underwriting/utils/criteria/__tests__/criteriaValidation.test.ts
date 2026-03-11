// Tests for criteriaValidation — specifically the null coercion logic
// that handles AI-returned null values in extracted criteria.

import { describe, it, expect } from "vitest";
import { parseExtractedCriteria } from "../criteriaValidation";

describe("parseExtractedCriteria", () => {
  it("returns empty data for null input", () => {
    const result = parseExtractedCriteria(null);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it("returns empty data for undefined input", () => {
    const result = parseExtractedCriteria(undefined);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it("parses fully populated criteria without nulls", () => {
    const data = {
      ageLimits: { minIssueAge: 18, maxIssueAge: 65 },
      faceAmountLimits: { minimum: 25000, maximum: 500000 },
      knockoutConditions: {
        conditionCodes: ["cancer"],
        descriptions: [{ code: "cancer", name: "Cancer", severity: "decline" }],
      },
      buildRequirements: { type: "bmi", standardBmiMax: 40 },
      tobaccoRules: {
        smokingClassifications: [
          { classification: "non-smoker", requiresCleanMonths: 36 },
        ],
        nicotineTestRequired: true,
      },
      stateAvailability: {
        availableStates: ["TX"],
        unavailableStates: ["NY"],
      },
    };
    const result = parseExtractedCriteria(data);
    expect(result.success).toBe(true);
    expect(result.data.ageLimits).toBeDefined();
    expect(result.data.faceAmountLimits).toBeDefined();
    expect(result.data.knockoutConditions).toBeDefined();
    expect(result.data.tobaccoRules).toBeDefined();
    expect(result.data.stateAvailability).toBeDefined();
  });

  // ─── The actual bug scenario: AI returns null for inner fields ────────────

  it("handles AI-returned null for top-level ageLimits", () => {
    const data = { ageLimits: null };
    const result = parseExtractedCriteria(data);
    expect(result.success).toBe(true);
    // null ageLimits should be coerced to undefined (absent)
    expect(result.data.ageLimits).toBeUndefined();
  });

  it("handles null minimum/maximum in faceAmountLimits while preserving ageTiers", () => {
    const data = {
      faceAmountLimits: {
        minimum: null,
        maximum: null,
        ageTiers: [{ minAge: null, maxAge: null, maxFaceAmount: 100000 }],
      },
    };
    const result = parseExtractedCriteria(data);
    expect(result.success).toBe(true);
    expect(result.data.faceAmountLimits).toBeDefined();
    expect(result.data.faceAmountLimits!.ageTiers).toHaveLength(1);
    expect(result.data.faceAmountLimits!.ageTiers![0].maxFaceAmount).toBe(
      100000,
    );
  });

  it("handles null nicotineTestRequired in tobaccoRules", () => {
    const data = {
      tobaccoRules: {
        smokingClassifications: [
          {
            classification: "non_tobacco_marijuana",
            requiresCleanMonths: null,
          },
        ],
        nicotineTestRequired: null,
      },
    };
    const result = parseExtractedCriteria(data);
    expect(result.success).toBe(true);
    expect(result.data.tobaccoRules).toBeDefined();
    expect(result.data.tobaccoRules!.smokingClassifications).toHaveLength(1);
    expect(
      result.data.tobaccoRules!.smokingClassifications[0].classification,
    ).toBe("non_tobacco_marijuana");
  });

  it("handles null BMI maxes in buildRequirements (height_weight type)", () => {
    const data = {
      buildRequirements: {
        type: "height_weight",
        preferredPlusBmiMax: null,
        preferredBmiMax: null,
        standardBmiMax: null,
      },
    };
    const result = parseExtractedCriteria(data);
    expect(result.success).toBe(true);
    expect(result.data.buildRequirements).toBeDefined();
    expect(result.data.buildRequirements!.type).toBe("height_weight");
  });

  it("handles null medication sub-objects in medicationRestrictions", () => {
    const data = {
      medicationRestrictions: {
        insulin: { allowed: false, ratingImpact: "decline" },
        opioids: null,
        bloodThinners: { allowed: false },
        bpMedications: { maxCount: 2 },
        antidepressants: { allowed: true },
      },
    };
    const result = parseExtractedCriteria(data);
    expect(result.success).toBe(true);
    expect(result.data.medicationRestrictions).toBeDefined();
    expect(result.data.medicationRestrictions!.insulin?.allowed).toBe(false);
    expect(result.data.medicationRestrictions!.bloodThinners?.allowed).toBe(
      false,
    );
    expect(result.data.medicationRestrictions!.bpMedications?.maxCount).toBe(2);
    expect(result.data.medicationRestrictions!.antidepressants?.allowed).toBe(
      true,
    );
    // opioids was null → coerced to undefined → absent
    expect(result.data.medicationRestrictions!.opioids).toBeUndefined();
  });

  it("handles the exact DB payload from OCR extraction (real-world regression)", () => {
    // This is the actual criteria payload from the LGA BeyondTerm guide
    const data = {
      ageLimits: null,
      tobaccoRules: {
        nicotineTestRequired: null,
        smokingClassifications: [
          {
            classification: "non_tobacco_marijuana",
            requiresCleanMonths: null,
          },
        ],
      },
      faceAmountLimits: {
        maximum: null,
        minimum: null,
        ageTiers: [{ maxAge: null, minAge: null, maxFaceAmount: 100000 }],
      },
      buildRequirements: {
        type: "height_weight",
        standardBmiMax: null,
        preferredBmiMax: null,
        preferredPlusBmiMax: null,
      },
      stateAvailability: {
        availableStates: [],
        unavailableStates: ["NY"],
      },
      knockoutConditions: {
        descriptions: [
          {
            code: "hiv_aids",
            name: "History of HIV/AIDS (ever)",
            severity: "decline",
          },
          {
            code: "cancer",
            name: "Any cancer in the last 10 years",
            severity: "decline",
          },
        ],
        conditionCodes: [
          "hiv_aids",
          "cancer",
          "diabetes_type1",
          "stroke",
          "heart_disease",
        ],
      },
      medicationRestrictions: {
        insulin: { allowed: false, ratingImpact: "decline" },
        opioids: null,
        bloodThinners: { allowed: false },
        bpMedications: { maxCount: 2 },
        antidepressants: { allowed: true },
      },
    };

    const result = parseExtractedCriteria(data);
    expect(result.success).toBe(true);

    // All 6 non-null top-level fields should be present
    expect(result.data.tobaccoRules).toBeDefined();
    expect(result.data.faceAmountLimits).toBeDefined();
    expect(result.data.buildRequirements).toBeDefined();
    expect(result.data.stateAvailability).toBeDefined();
    expect(result.data.knockoutConditions).toBeDefined();
    expect(result.data.medicationRestrictions).toBeDefined();

    // ageLimits was null → absent
    expect(result.data.ageLimits).toBeUndefined();

    // Verify nested data survived
    expect(result.data.knockoutConditions!.conditionCodes).toHaveLength(5);
    expect(result.data.medicationRestrictions!.insulin?.allowed).toBe(false);
    expect(result.data.stateAvailability!.unavailableStates).toContain("NY");
  });
});
