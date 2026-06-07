// src/services/recruiting/recruitingDesignService.ts
// Client for the generate-recruiting-design edge function. Always re-validates
// the returned spec client-side (canonical + defense-in-depth).

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import { validateDesignSpec } from "@/lib/recruiting-design-spec";
import type { RecruitingDesignSpec } from "@/types/recruiting-design-spec.types";

export interface DesignReferenceImage {
  media_type: string;
  data: string; // base64 (no data: prefix)
}

export interface DesignConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateDesignInput {
  prompt: string;
  conversation?: DesignConversationTurn[];
  currentSpec?: RecruitingDesignSpec | null;
  referenceImages?: DesignReferenceImage[];
  agentContext?: {
    primary_color?: string;
    accent_color?: string;
    display_name?: string | null;
    headline?: string | null;
    subheadline?: string | null;
    calendly_url?: string | null;
  };
}

export interface GenerateDesignResult {
  spec: RecruitingDesignSpec;
  notes: string[];
}

/**
 * Try to surface the edge function's friendly error message. supabase-js wraps a
 * non-2xx response in a FunctionsHttpError whose `context` is the raw Response.
 */
async function extractEdgeError(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error ? error.message : "Failed to generate design.";
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).json();
      if (body?.error) return String(body.error);
    } catch {
      // ignore — fall back to the generic message
    }
  }
  return fallback;
}

export const recruitingDesignService = {
  async generateDesignSpec(
    input: GenerateDesignInput,
  ): Promise<GenerateDesignResult> {
    const { data, error } = await supabase.functions.invoke(
      "generate-recruiting-design",
      { body: input },
    );

    if (error) {
      const message = await extractEdgeError(error);
      logger.error(
        "Failed to generate recruiting design",
        message,
        "recruitingDesignService",
      );
      throw new Error(message);
    }
    if (!data?.success || !data?.spec) {
      throw new Error(
        data?.error || "The design generator returned no result.",
      );
    }

    // Re-validate the untrusted edge response before it touches the UI.
    const { spec } = validateDesignSpec(data.spec);
    return { spec, notes: Array.isArray(data.notes) ? data.notes : [] };
  },
};

export default recruitingDesignService;
