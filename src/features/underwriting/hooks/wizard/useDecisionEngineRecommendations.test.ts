import { describe, expect, it } from "vitest";

import {
  buildAuthoritativeSessionSaveInput,
  buildAuthoritativeUnderwritingRunInput,
} from "../../utils/wizard/build-authoritative-run-input";

describe("buildAuthoritativeUnderwritingRunInput", () => {
  it("builds a raw-input payload with run metadata for backend execution", () => {
    const result = buildAuthoritativeUnderwritingRunInput({
      clientInfo: {
        name: "Casey Client",
        dob: "1985-04-12",
        age: 40,
        gender: "female",
        state: "TX",
        heightFeet: 5,
        heightInches: 7,
        weight: 165,
      },
      healthInfo: {
        conditions: [
          {
            conditionCode: "diabetes",
            conditionName: "Diabetes",
            responses: {
              type: "Type 2",
              treatment: "Oral medication only",
            },
          },
        ],
        tobacco: {
          currentUse: false,
        },
        medications: {
          bpMedCount: 0,
          bloodThinners: false,
          heartMeds: false,
          cholesterolMedCount: 1,
          insulinUse: false,
          oralDiabetesMeds: true,
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
        },
      },
      coverageRequest: {
        faceAmounts: [250000, 500000],
        productTypes: ["term_life"],
      },
      runKey: "run-123",
      selectedTermYears: 20,
      sessionDurationSeconds: 95,
    });

    expect(result.runKey).toBe("run-123");
    expect(result.selectedTermYears).toBe(20);
    expect(result.clientHeightInches).toBe(67);
    expect(result.requestedFaceAmounts).toEqual([250000, 500000]);
    expect(result.conditionsReported).toEqual(["diabetes"]);
    expect(result.healthResponses).toMatchObject({
      version: 2,
      conditionsByCode: {
        diabetes: {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
        },
      },
    });
  });

  it("builds a save payload that carries the signed authoritative run envelope", () => {
    const authoritativeRunEnvelope = {
      version: 1 as const,
      actorId: "user-123",
      requestId: "req-123",
      issuedAt: "2026-03-09T00:00:00.000Z",
      input: {
        clientAge: 40,
        clientGender: "female",
        clientState: "TX",
        clientHeightInches: 67,
        clientWeightLbs: 165,
        healthResponses: {},
        conditionsReported: [],
        tobaccoUse: false,
        requestedFaceAmounts: [250000],
        requestedProductTypes: ["term_life"],
        runKey: "run-123",
        selectedTermYears: 20,
      },
      result: {
        sessionRecommendations: [],
        rateTableRecommendations: [],
        eligibilitySummary: {
          eligible: 1,
          unknown: 0,
          ineligible: 0,
        },
        evaluationMetadata: {
          engineVersion: "backend_authoritative_v1",
        },
      },
      auditRows: [],
      signature: "signed-envelope",
    };

    const result = buildAuthoritativeSessionSaveInput({
      clientInfo: {
        name: "Casey Client",
        dob: "1985-04-12",
        age: 40,
        gender: "female",
        state: "TX",
        heightFeet: 5,
        heightInches: 7,
        weight: 165,
      },
      healthInfo: {
        conditions: [],
        tobacco: {
          currentUse: false,
        },
        medications: {
          bpMedCount: 0,
          bloodThinners: false,
          heartMeds: false,
          cholesterolMedCount: 0,
          insulinUse: false,
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
        },
      },
      coverageRequest: {
        faceAmounts: [250000],
        productTypes: ["term_life"],
      },
      runKey: "run-123",
      authoritativeRunEnvelope,
      selectedTermYears: 20,
      sessionDurationSeconds: 95,
    });

    expect(result.authoritativeRunEnvelope).toBe(authoritativeRunEnvelope);
    expect(result.input.runKey).toBe("run-123");
    expect(result.input.sessionDurationSeconds).toBe(95);
  });
});
