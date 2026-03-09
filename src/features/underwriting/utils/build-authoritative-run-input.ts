import type {
  ClientInfo,
  CoverageRequest,
  HealthInfo,
  SessionSaveInput,
} from "../types/underwriting.types";
import { buildSessionHealthSnapshot } from "./session-health-snapshot";

export interface UnderwritingDecisionRunInput extends SessionSaveInput {
  runKey: string;
}

export function buildAuthoritativeUnderwritingRunInput(params: {
  clientInfo: ClientInfo;
  healthInfo: HealthInfo;
  coverageRequest: CoverageRequest;
  runKey: string;
  selectedTermYears?: number | null;
  sessionDurationSeconds?: number;
}): UnderwritingDecisionRunInput {
  const {
    clientInfo,
    healthInfo,
    coverageRequest,
    runKey,
    selectedTermYears = null,
    sessionDurationSeconds,
  } = params;

  return {
    clientName: clientInfo.name || undefined,
    clientDob: clientInfo.dob,
    clientAge: clientInfo.age,
    clientGender: clientInfo.gender,
    clientState: clientInfo.state,
    clientHeightInches: clientInfo.heightFeet * 12 + clientInfo.heightInches,
    clientWeightLbs: clientInfo.weight,
    healthResponses: buildSessionHealthSnapshot(
      healthInfo.conditions,
      healthInfo.medications,
    ),
    conditionsReported: healthInfo.conditions.map((c) => c.conditionCode),
    tobaccoUse: healthInfo.tobacco.currentUse,
    tobaccoDetails: healthInfo.tobacco,
    requestedFaceAmounts: coverageRequest.faceAmounts,
    requestedProductTypes: coverageRequest.productTypes,
    sessionDurationSeconds,
    selectedTermYears,
    runKey,
  };
}
