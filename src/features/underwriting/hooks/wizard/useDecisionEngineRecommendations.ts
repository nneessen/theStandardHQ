import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/services/base/supabase";
import type { DecisionEngineResult } from "@/services/underwriting/workflows/decisionEngine";
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
    let message = error.message;

    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = (await ctx.json()) as { error?: string };
        message = body.error || message;
      }
    } catch {
      // ignore transport body parsing failures
    }

    throw new Error(message || "Failed to compute underwriting run");
  }

  const parsed = data as {
    success?: boolean;
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
    throw new Error(parsed?.error || "Failed to compute underwriting run");
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
    Error,
    UnderwritingDecisionRunInput
  >({
    mutationFn: runDecisionEngine,
    onError: (error) => {
      console.error("Decision engine error:", error);
    },
  });
}
