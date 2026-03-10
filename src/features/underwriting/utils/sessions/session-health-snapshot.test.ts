import { describe, expect, it } from "vitest";
import {
  buildSessionHealthSnapshot,
  parseSessionHealthSnapshot,
} from "./session-health-snapshot";
import type {
  ConditionResponse,
  MedicationInfo,
} from "../../types/underwriting.types";

const medications: MedicationInfo = {
  bpMedCount: 1,
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
  painMedications: "none",
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
};

describe("session health snapshot", () => {
  it("builds and parses the v2 snapshot format", () => {
    const conditions: ConditionResponse[] = [
      {
        conditionCode: "diabetes",
        conditionName: "Diabetes",
        responses: { a1c: 7.2 },
      },
    ];

    const snapshot = buildSessionHealthSnapshot(conditions, medications);
    const parsed = parseSessionHealthSnapshot(snapshot);

    expect(parsed.conditions).toEqual(conditions);
    expect(parsed.conditionsByCode.diabetes).toEqual(conditions[0]);
    expect(parsed.medications).toEqual(medications);
  });

  it("parses legacy condition-only snapshots", () => {
    const legacy = {
      diabetes: {
        conditionCode: "diabetes",
        conditionName: "Diabetes",
        responses: { a1c: 6.9 },
      },
    };

    const parsed = parseSessionHealthSnapshot(legacy);

    expect(parsed.conditionsByCode.diabetes.conditionName).toBe("Diabetes");
    expect(parsed.conditions).toHaveLength(1);
    expect(parsed.medications).toBeUndefined();
  });
});
