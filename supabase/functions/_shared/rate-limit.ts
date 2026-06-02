// _shared/rate-limit.ts — Postgres-backed rate limiter for edge functions.
//
// Uses the `check_rate_limit` SECURITY DEFINER RPC (service_role only).
// Call with the admin/service-role client — user-scoped clients lack EXECUTE.
//
// Two canonical buckets per user:
//   Request:  "ratelimit:req:<fn>:<uid>"  — per-function hourly cap
//   Token:    "ratelimit:tok:<uid>"       — cross-function daily token cap
//
// Token bucket pattern (two calls):
//   1. At request start: enforceRateLimit(..., { tokens: 0, maxTokens: 200_000 })
//      → rejects if the user is ALREADY over the daily budget from prior calls.
//   2. After Anthropic returns: enforceRateLimit(..., { tokens: actualUsed, maxTokens: 200_000 })
//      → records the spend; the `allowed` result is intentionally ignored (we
//        don't retroactively reject a call that already ran).

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export interface RateLimitOptions {
  /** Bucket key, e.g. "ratelimit:req:assistant-orchestrator:<uid>" */
  key: string;
  /** Max requests allowed in the window. Pass 2_000_000_000 to disable the request axis. */
  maxRequests: number;
  /** Window size in seconds. 3600 = hourly, 86400 = daily. */
  windowSeconds: number;
  /** Tokens to record this call (default 0). Use 0 at request start; actual usage after. */
  tokens?: number;
  /** Max token_count in the window. NULL/undefined = skip token axis. */
  maxTokens?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  requestsUsed: number;
  tokensUsed: bigint;
  retryAfterSeconds: number;
}

/**
 * Call the `check_rate_limit` RPC via the service-role admin client.
 * Returns a structured result. Does NOT throw on limit exceeded — the caller
 * decides whether to throw or return a 429.
 */
export async function checkRateLimit(
  adminClient: AdminClient,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { data, error } = await adminClient.rpc("check_rate_limit", {
    p_key: opts.key,
    p_max_requests: opts.maxRequests,
    p_window_seconds: opts.windowSeconds,
    p_tokens: opts.tokens ?? 0,
    p_max_tokens: opts.maxTokens ?? null,
  });

  if (error) {
    // Log and fail-open: if the limiter itself errors we prefer serving the
    // request over blocking a user on an infrastructure fault.
    console.error("[rate-limit] check_rate_limit RPC error:", error.message);
    return {
      allowed: true,
      requestsUsed: 0,
      tokensUsed: BigInt(0),
      retryAfterSeconds: 0,
    };
  }

  // PostgREST returns an array (one row from RETURNS TABLE).
  const row = Array.isArray(data) ? data[0] : data;

  return {
    allowed: row?.allowed ?? true,
    requestsUsed: row?.requests_used ?? 0,
    tokensUsed: BigInt(row?.tokens_used ?? 0),
    retryAfterSeconds: row?.retry_after_seconds ?? 60,
  };
}

/**
 * Enforce a rate limit. If not allowed, returns a 429 Response with the
 * provided CORS headers. If allowed, returns null (caller continues normally).
 *
 * `corsHeaders` must be the headers object already computed by the calling
 * function — each function uses a different CORS scheme, so we accept them as
 * a parameter rather than importing a single scheme here.
 */
export async function enforceRateLimit(
  adminClient: AdminClient,
  opts: RateLimitOptions,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const result = await checkRateLimit(adminClient, opts);
  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterSeconds, corsHeaders);
  }
  return null;
}

/**
 * Build a standard 429 Response.
 * `retryAfterSeconds` populates the Retry-After header (RFC 7231 §7.1.3).
 */
export function rateLimitResponse(
  retryAfterSeconds: number,
  corsHeaders: Record<string, string>,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded. Please wait before retrying.",
      retry_after_seconds: retryAfterSeconds,
      ...extra,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

// ---------------------------------------------------------------------------
// AI rate-limit policy — the single source of truth for the limits every
// Anthropic-backed edge function shares. Previously copy-pasted into each one,
// which meant a budget change had to be found and edited in ~10 places.
//   Request axis: PER-FUNCTION hourly cap (30/hr).
//   Token axis:   PER-USER daily cap (200k/24h), SHARED across all AI functions
//                 (note the token bucket key intentionally omits the function name).
const AI_REQ_MAX_PER_HOUR = 30;
const AI_REQ_WINDOW_SECONDS = 3600;
const AI_TOKEN_MAX_PER_DAY = 200_000;
const AI_TOKEN_WINDOW_SECONDS = 86400;
// Sentinel: the token bucket only limits on the token axis, so its request axis
// must never trip — disable it with an effectively-infinite request ceiling.
const REQUESTS_UNLIMITED = 2_000_000_000;

const tokenBucketKey = (userId: string) => `ratelimit:tok:${userId}`;

/**
 * Per-request AI pre-flight: enforce this function's hourly request cap AND the
 * user's shared daily token ceiling (recording 0 tokens — the pre-call admission
 * check). Returns a ready-to-send 429 Response if either is exceeded, else null.
 * Record the actual spend after the model call with {@link recordAiTokens}.
 *
 * Behaviour is identical to the hand-rolled req+token enforce blocks it replaces;
 * any function-specific limiter (e.g. a daily generation-count cap) stays at the
 * call site — this only owns the two canonical buckets.
 */
export async function enforceAiRateLimits(
  adminClient: AdminClient,
  fnName: string,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const reqLimited = await enforceRateLimit(
    adminClient,
    {
      key: `ratelimit:req:${fnName}:${userId}`,
      maxRequests: AI_REQ_MAX_PER_HOUR,
      windowSeconds: AI_REQ_WINDOW_SECONDS,
    },
    corsHeaders,
  );
  if (reqLimited) return reqLimited;

  return enforceRateLimit(
    adminClient,
    {
      key: tokenBucketKey(userId),
      maxRequests: REQUESTS_UNLIMITED,
      windowSeconds: AI_TOKEN_WINDOW_SECONDS,
      tokens: 0,
      maxTokens: AI_TOKEN_MAX_PER_DAY,
    },
    corsHeaders,
  );
}

/**
 * Record actual token spend against the user's shared daily budget AFTER the model
 * call returns. A no-op when tokens <= 0. The `allowed` result is intentionally
 * ignored — a call that already ran is never retroactively rejected.
 */
export async function recordAiTokens(
  adminClient: AdminClient,
  userId: string,
  tokens: number,
): Promise<void> {
  if (!tokens || tokens <= 0) return;
  await checkRateLimit(adminClient, {
    key: tokenBucketKey(userId),
    maxRequests: REQUESTS_UNLIMITED,
    windowSeconds: AI_TOKEN_WINDOW_SECONDS,
    tokens,
    maxTokens: AI_TOKEN_MAX_PER_DAY,
  });
}
