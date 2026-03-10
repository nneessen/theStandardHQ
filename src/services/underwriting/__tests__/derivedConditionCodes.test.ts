import { describe, expect, it } from "vitest";
import { deriveRuleConditionCodes } from "../core/derivedConditionCodes";

describe("deriveRuleConditionCodes", () => {
  it("derives diabetes aliases for type 1 / insulin-dependent risk patterns", () => {
    const result = deriveRuleConditionCodes({
      age: 32,
      healthConditions: ["diabetes"],
      conditionResponses: {
        diabetes: {
          type: "Type 1",
          insulin_use: true,
          a1c_level: 8.3,
          good_control: false,
          years_since_diagnosis: 20,
          complications: ["retinopathy", "neuropathy", "amputation"],
        },
      },
    });

    expect(result.derivedConditionCodes).toEqual(
      expect.arrayContaining([
        "diabetes_juvenile",
        "diabetes_insulin_early",
        "diabetes_uncontrolled",
        "diabetic_retinopathy",
        "diabetic_neuropathy",
        "diabetes_amputation",
      ]),
    );
    expect(result.allConditionCodes).toEqual(
      expect.arrayContaining(["diabetes", "diabetes_insulin_early"]),
    );
  });

  it("does not create diabetes aliases for well-controlled non-insulin diabetes", () => {
    const result = deriveRuleConditionCodes({
      age: 58,
      healthConditions: ["diabetes"],
      conditionResponses: {
        diabetes: {
          type: "Type 2",
          insulin_use: false,
          a1c_level: 6.4,
          good_control: true,
          years_since_diagnosis: 5,
          complications: [],
        },
      },
    });

    expect(result.derivedConditionCodes).toEqual([]);
    expect(result.allConditionCodes).toEqual(["diabetes"]);
  });

  it("preserves base conditions and deduplicates derived aliases", () => {
    const result = deriveRuleConditionCodes({
      age: 50,
      healthConditions: ["diabetes", "copd", "diabetes"],
      conditionResponses: {
        diabetes: {
          type: "Type 1",
          insulin_use: true,
          good_control: false,
          a1c_level: 7.9,
          years_since_diagnosis: 40,
          complications: ["retinopathy", "retinopathy"],
        },
      },
    });

    expect(result.allConditionCodes).toEqual(
      expect.arrayContaining([
        "diabetes",
        "copd",
        "diabetes_insulin_early",
        "diabetic_retinopathy",
      ]),
    );
    expect(
      result.allConditionCodes.filter((code) => code === "diabetes"),
    ).toHaveLength(1);
    expect(
      result.derivedConditionCodes.filter(
        (code) => code === "diabetic_retinopathy",
      ),
    ).toHaveLength(1);
  });
});
