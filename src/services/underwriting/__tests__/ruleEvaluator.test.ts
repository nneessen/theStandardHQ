import { describe, expect, it } from "vitest";
import { buildFactMap } from "../core/ruleEvaluator";

describe("buildFactMap", () => {
  it("adds medication facts to the canonical rule map", () => {
    const facts = buildFactMap(
      {
        age: 58,
        gender: "female",
        bmi: 31.2,
        state: "TX",
        tobacco: false,
        medications: {
          bpMedCount: 2,
          bloodThinners: false,
          heartMeds: false,
          cholesterolMedCount: 0,
          insulinUse: true,
          oralDiabetesMeds: false,
          antidepressants: false,
          antianxiety: false,
          antipsychotics: false,
          moodStabilizers: false,
          sleepAids: false,
          adhdMeds: false,
          painMedications: "opioid",
          seizureMeds: false,
          migraineMeds: false,
          inhalers: false,
          copdMeds: false,
          thyroidMeds: false,
          hormonalTherapy: false,
          steroids: false,
          immunosuppressants: false,
          biologics: false,
          dmards: false,
          cancerTreatment: false,
          antivirals: false,
          osteoporosisMeds: false,
          kidneyMeds: false,
          liverMeds: false,
        },
      },
      ["diabetes"],
      {
        diabetes: {
          insulin_use: true,
        },
      },
    );

    expect(facts["medications.bpMedCount"]).toBe(2);
    expect(facts["medications.insulinUse"]).toBe(true);
    expect(facts["medications.opioidUse"]).toBe(true);
    expect(facts["medications.totalSignals"]).toBe(3);
    expect(facts["medications.hasAny"]).toBe(true);
    expect(facts["medications.highRisk"]).toBe(true);
    expect(facts["medications.classes"]).toEqual(
      expect.arrayContaining(["bp_medications", "insulin", "opioid"]),
    );
  });
});
