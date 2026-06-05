// Voice-aware request rate-limit bucket selection.
//
// A realtime voice session (the Jarvis LiveKit worker bridging each spoken turn to this
// orchestrator) runs 10+ turns/min, so it MUST NOT share the typed path's 30-req/hr
// request bucket — it would trip its own cap mid-conversation. The voice surface gets its
// OWN request bucket with a much higher cap. The per-user TOKEN axis (200k/day, enforced
// separately) stays the real cost ceiling for BOTH surfaces, so raising the voice request
// cap does not raise the spend ceiling.
//
// SECURITY NOTE: the surface is a self-reported request header (`x-jarvis-surface: voice`).
// It only ever selects the caller's OWN per-user request bucket key — it is NOT a tenant
// boundary and grants no cross-user access — so a spoofed value at most inflates that one
// user's request allowance, which the token axis still bounds. Safe by construction.

/** Typed (command-center text) request cap — unchanged from the original inline value. */
export const REQUEST_MAX_PER_HOUR_TYPED = 30;
/** Voice request cap — high enough that a long spoken conversation never self-throttles. */
export const REQUEST_MAX_PER_HOUR_VOICE = 600;

// Daily TOKEN (cost) ceilings. The typed key is SHARED across Anthropic edge functions
// (close-ai-builder, etc.) so its value + key must not change. Voice gets its OWN daily
// bucket so a long spoken session can't drain the typed budget (and vice versa), and a
// higher cap because a realtime call runs many short turns — but it is still a HARD spend
// ceiling, not "unlimited". Tokens are counted COST-weighted (cache reads at ~0.1×, their
// real Anthropic price), so this is a budget of input-token-equivalents, not raw volume.
export const TOKEN_MAX_PER_DAY_TYPED = 200_000;
export const TOKEN_MAX_PER_DAY_VOICE = 500_000;

export interface RequestBucket {
  key: string;
  maxRequests: number;
}

export interface TokenBucket {
  key: string;
  maxTokens: number;
}

/**
 * Pick the request rate-limit bucket for this turn. Voice turns get a distinct key
 * (`ratelimit:req:assistant-voice:<uid>`) and the higher cap; everything else keeps the
 * original `ratelimit:req:assistant-orchestrator:<uid>` bucket and 30/hr cap.
 */
export function requestRateBucket(
  userId: string,
  isVoiceSurface: boolean,
): RequestBucket {
  return isVoiceSurface
    ? {
        key: `ratelimit:req:assistant-voice:${userId}`,
        maxRequests: REQUEST_MAX_PER_HOUR_VOICE,
      }
    : {
        key: `ratelimit:req:assistant-orchestrator:${userId}`,
        maxRequests: REQUEST_MAX_PER_HOUR_TYPED,
      };
}

/**
 * Pick the DAILY token bucket for this turn. Voice turns get a distinct key
 * (`ratelimit:tok:voice:<uid>`) and the higher cap; everything else keeps the original
 * shared `ratelimit:tok:<uid>` bucket and 200k cap (do NOT change that key — other Anthropic
 * functions report into it). Mirrors requestRateBucket so both axes split the same way.
 */
export function tokenRateBucket(
  userId: string,
  isVoiceSurface: boolean,
): TokenBucket {
  return isVoiceSurface
    ? {
        key: `ratelimit:tok:voice:${userId}`,
        maxTokens: TOKEN_MAX_PER_DAY_VOICE,
      }
    : {
        key: `ratelimit:tok:${userId}`,
        maxTokens: TOKEN_MAX_PER_DAY_TYPED,
      };
}
