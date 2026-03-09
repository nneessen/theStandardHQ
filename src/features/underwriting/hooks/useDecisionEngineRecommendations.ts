import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/services/base/supabase";
import type { DecisionEngineResult } from "@/services/underwriting/decisionEngine";
import {
  buildAuthoritativeUnderwritingRunInput,
  type UnderwritingDecisionRunInput,
} from "../utils/build-authoritative-run-input";

export { buildAuthoritativeUnderwritingRunInput };

async function runDecisionEngine(
  request: UnderwritingDecisionRunInput,
): Promise<DecisionEngineResult> {
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
    decisionResult?: DecisionEngineResult;
    error?: string;
  } | null;

  if (!parsed?.success || !parsed.decisionResult) {
    throw new Error(parsed?.error || "Failed to compute underwriting run");
  }

  return parsed.decisionResult;
}

export function useDecisionEngineRecommendations() {
  return useMutation<DecisionEngineResult, Error, UnderwritingDecisionRunInput>(
    {
      mutationFn: runDecisionEngine,
      onError: (error) => {
        console.error("Decision engine error:", error);
      },
    },
  );
}
