import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/services/base/supabase";
import type { DecisionEngineResult } from "@/services/underwriting/workflows/decisionEngine";
import {
  createUnderwritingRequestError,
  extractUnderwritingRequestError,
  UnderwritingRequestError,
} from "../shared/request-error";
import {
  buildAuthoritativeUnderwritingRunInput,
  buildAuthoritativeSessionSaveInput,
  type UnderwritingDecisionRunInput,
} from "../../utils/wizard/build-authoritative-run-input";
import type { SignedAuthoritativeRunEnvelope } from "../../types/underwriting.types";

export {
  buildAuthoritativeUnderwritingRunInput,
  buildAuthoritativeSessionSaveInput,
};

export interface UnderwritingDecisionRunResponse {
  requestId: string;
  decisionResult: DecisionEngineResult;
  authoritativeRunEnvelope: SignedAuthoritativeRunEnvelope;
}

async function runDecisionEngine(
  request: UnderwritingDecisionRunInput,
): Promise<UnderwritingDecisionRunResponse> {
  const { data, error } = await supabase.functions.invoke(
    "run-underwriting-session",
    {
      body: request,
    },
  );

  if (error) {
    throw await extractUnderwritingRequestError(
      error,
      "Failed to compute underwriting run",
    );
  }

  const parsed = data as {
    success?: boolean;
    code?: string;
    requestId?: string;
    decisionResult?: DecisionEngineResult;
    authoritativeRunEnvelope?: SignedAuthoritativeRunEnvelope;
    error?: string;
  } | null;

  if (
    !parsed?.success ||
    !parsed.requestId ||
    !parsed.decisionResult ||
    !parsed.authoritativeRunEnvelope
  ) {
    throw createUnderwritingRequestError(
      parsed,
      "Failed to compute underwriting run",
    );
  }

  return {
    requestId: parsed.requestId,
    decisionResult: parsed.decisionResult,
    authoritativeRunEnvelope: parsed.authoritativeRunEnvelope,
  };
}

export function useDecisionEngineRecommendations() {
  return useMutation<
    UnderwritingDecisionRunResponse,
    UnderwritingRequestError,
    UnderwritingDecisionRunInput
  >({
    mutationFn: runDecisionEngine,
    onError: (error) => {
      console.error("Decision engine error:", error);
    },
  });
}
