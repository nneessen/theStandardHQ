// src/features/social-studio/aiErrorMessage.ts
// Turn a Supabase Edge Function failure into a SPECIFIC user message. supabase-js v2 wraps
// a non-2xx response as a FunctionsHttpError whose `.context` is the raw Response — so the
// HTTP status tells us WHY the AI call failed:
//   • 404 → the function isn't deployed (the bug that made "Generate caption" a silent no-op)
//   • 403 → the AI-access gate said no (not entitled on this account)
//   • 429 → rate limited
//   • 5xx → the model call failed server-side — often a transient error, OR the org's
//           Anthropic credit balance is too low (see the credit-balance runbook).
// Without this, every failure read as a generic "try again", hiding all of the above.

/** Pull the HTTP status off a thrown FunctionsHttpError (its Response lives on `.context`). */
function statusOf(e: unknown): number | undefined {
  if (e && typeof e === "object" && "context" in e) {
    const ctx = (e as { context?: unknown }).context;
    if (ctx && typeof ctx === "object" && "status" in ctx) {
      const s = (ctx as { status?: unknown }).status;
      if (typeof s === "number") return s;
    }
  }
  return undefined;
}

/**
 * A user-facing message for an AI edge-function failure. `noun` names what was being made
 * (e.g. "caption", "carousel", "copy") so the sentence reads naturally.
 */
export function aiErrorMessage(e: unknown, noun: string): string {
  switch (statusOf(e)) {
    case 404:
      return `The AI ${noun} service isn't available yet — it hasn't been deployed. Let support know.`;
    case 401:
    case 403:
      return `AI features aren't enabled for this account.`;
    case 429:
      return `Too many AI requests right now — wait a moment and try again.`;
    default: {
      const status = statusOf(e);
      if (status !== undefined && status >= 500)
        return `The AI service couldn't generate the ${noun} (a temporary issue, or the AI credit balance is low). Try again shortly.`;
      return `Couldn't generate the ${noun}. Please try again.`;
    }
  }
}
