// supabase/functions/crm-oauth-token/handler.ts
// Request handler for the OAuth2 client-credentials token endpoint (the public M2M
// entrypoint for the external inbound-call platform). Extracted from index.ts so it
// can be unit-tested WITHOUT importing index.ts's top-level serve() (which would bind
// a port). index.ts is the thin entrypoint: serve(handleOAuthTokenRequest).
//
// Flow: the platform POSTs `grant_type=client_credentials` + client_id + client_secret
// (form-urlencoded body OR HTTP Basic auth). We verify the credential via the
// service-role-only crm_authenticate_credential RPC (bcrypt cost-12), then mint a
// stateless 24h HMAC bearer. The response is shaped to the platform's Salesforce-style
// spec: { access_token, instance_url, id, token_type, scope, expires_in }.
//
// ── DoS protection (the reason this file carries rate-limit gates) ──────────────────
// crm_authenticate_credential runs bcrypt cost-12 INSIDE shared Postgres. This endpoint
// is public (config.toml verify_jwt=false), so an unauthenticated flood would pin
// Postgres CPU → ALL-TENANT denial of service. We place TWO fail-closed rate-limit gates
// immediately BEFORE that bcrypt call:
//   1. GLOBAL gate FIRST — a spoof-proof TOTAL ceiling (~30/min = 5 × 6 shards). It runs
//      first so it bounds how many rows the per-IP gate below can create: the rate_limits
//      table has no GC, and check_rate_limit INSERTs a row per new bucket_key, so a
//      spoofed-X-Forwarded-For flood hitting a per-IP gate first would create UNBOUNDED
//      rows. Behind the global gate at most ~30 new per-IP rows/min are created. The
//      shard is chosen RANDOMLY (not by hashing the IP) so the global cap is a pure
//      IP-independent total — IP-hash sharding would pin each IP to one 5/min shard and
//      make the per-IP gate redundant.
//   2. PER-IP gate SECOND — best-effort per-source fairness (~10/min per X-Forwarded-For).
//      The IP is attacker-spoofable, so this is NOT the DoS backstop (the global gate is);
//      it stops a single non-spoofing source from consuming the whole global budget.
// Both gates fail CLOSED (a limiter fault ⇒ 429, never admit). The gates run AFTER the
// cheap credential-format validation so a malformed flood gets a cheap 400 and never
// consumes the 30/min budget (no budget-eviction of legitimate token mints).
//
// FOLLOW-UP (cannot be fixed here — code-only change): public.rate_limits has NO GC.
// Add the cron the migration spec already calls for:
//   DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 days';
//
// NEVER log client_secret or the minted token.

import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import { mintCrmToken } from "../_shared/crm-token-decoder.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

// ── Rate-limit policy (60s windows) ──────────────────────────────────────────────
const RATE_WINDOW_SECONDS = 60;
// GLOBAL spoof-proof total ceiling = OAUTH_GLOBAL_MAX_PER_WINDOW × OAUTH_GLOBAL_SHARDS
// per window (5 × 6 = ~30/min). Sharding spreads the single-hot-row lock convoy under a
// flood; the cap is firm because each shard caps at 5 and the sum is therefore ≤30.
const OAUTH_GLOBAL_SHARDS = 6;
const OAUTH_GLOBAL_MAX_PER_WINDOW = 5;
// PER-IP fairness cap (~10/min per source). IP is spoofable — the global gate is the
// real backstop; this just stops one honest source monopolising the global budget.
const OAUTH_IP_MAX_PER_WINDOW = 10;

// Injectable seam for tests: the handler builds its admin client through this so a test
// can supply a fake whose .rpc(...) is observable (proving the gate runs before bcrypt).
export interface OAuthTokenDeps {
  makeAdminClient: () => ReturnType<typeof createSupabaseAdminClient>;
}

const defaultDeps: OAuthTokenDeps = {
  makeAdminClient: createSupabaseAdminClient,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// OAuth2 error shape ({error, error_description}); never echo the secret.
function oauthError(
  error: string,
  description: string,
  status: number,
): Response {
  return jsonResponse({ error, error_description: description }, status);
}

// 429 in the OAuth error shape + a Retry-After header. Deliberately reveals nothing about
// WHICH gate tripped or anything credential-related — just "slow down, retry later".
function oauthRateLimited(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      error: "slow_down",
      error_description:
        "Too many token requests. Please retry after the indicated delay.",
    }),
    {
      status: 429,
      headers: {
        ...JSON_HEADERS,
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
      },
    },
  );
}

/** Best-effort client IP from X-Forwarded-For (leftmost hop). Spoofable — used only for
 * the per-IP fairness gate, never as the DoS backstop. Missing/empty ⇒ a shared "unknown"
 * bucket, which is safe (that cohort is then capped collectively). */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || "unknown";
}

/**
 * Enforce the two fail-closed DoS gates that protect the bcrypt RPC. Returns a 429
 * Response if either gate trips (or a limiter fault, fail-closed), else null (proceed).
 * GLOBAL gate runs first (bounds per-IP row creation); both short-circuit.
 */
async function enforceOAuthTokenRateLimit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  ip: string,
): Promise<Response | null> {
  // Gate 1 — GLOBAL spoof-proof total cap. Random shard = IP-independent total ceiling.
  const shard = Math.floor(Math.random() * OAUTH_GLOBAL_SHARDS);
  const global = await checkRateLimit(admin, {
    key: `ratelimit:oauth-token:global:${shard}`,
    maxRequests: OAUTH_GLOBAL_MAX_PER_WINDOW,
    windowSeconds: RATE_WINDOW_SECONDS,
    failClosed: true,
  });
  if (!global.allowed) return oauthRateLimited(global.retryAfterSeconds);

  // Gate 2 — per-IP fairness cap (only reached by traffic that passed Gate 1, so its
  // row creation is bounded by Gate 1's total ceiling).
  const perIp = await checkRateLimit(admin, {
    key: `ratelimit:oauth-token:ip:${ip}`,
    maxRequests: OAUTH_IP_MAX_PER_WINDOW,
    windowSeconds: RATE_WINDOW_SECONDS,
    failClosed: true,
  });
  if (!perIp.allowed) return oauthRateLimited(perIp.retryAfterSeconds);

  return null;
}

/** Extract client_id/secret from the form body or an HTTP Basic auth header. */
async function readCredentials(req: Request): Promise<{
  grantType: string | null;
  clientId: string | null;
  clientSecret: string | null;
}> {
  let clientId: string | null = null;
  let clientSecret: string | null = null;
  let grantType: string | null = null;

  const raw = await req.text();
  if (raw) {
    const params = new URLSearchParams(raw);
    grantType = params.get("grant_type");
    clientId = params.get("client_id");
    clientSecret = params.get("client_secret");
  }

  // HTTP Basic auth takes precedence for the credential pair if present.
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = atob(authHeader.slice(6).trim());
      const idx = decoded.indexOf(":");
      if (idx >= 0) {
        clientId = decoded.slice(0, idx);
        clientSecret = decoded.slice(idx + 1);
      }
    } catch {
      // ignore malformed Basic header; fall through to form values
    }
  }

  return { grantType, clientId, clientSecret };
}

export async function handleOAuthTokenRequest(
  req: Request,
  deps: OAuthTokenDeps = defaultDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return oauthError("invalid_request", "Use POST.", 405);
  }

  let creds;
  try {
    creds = await readCredentials(req);
  } catch {
    return oauthError("invalid_request", "Malformed request body.", 400);
  }
  const { grantType, clientId, clientSecret } = creds;

  // grant_type defaults to client_credentials when omitted via Basic auth, but if it is
  // present it must be client_credentials.
  if (grantType && grantType !== "client_credentials") {
    return oauthError(
      "unsupported_grant_type",
      "Only client_credentials is supported.",
      400,
    );
  }
  if (!clientId || !clientSecret) {
    return oauthError(
      "invalid_request",
      "client_id and client_secret are required.",
      400,
    );
  }

  let supabase;
  try {
    supabase = deps.makeAdminClient();
  } catch {
    return oauthError("server_error", "Service unavailable.", 500);
  }

  // ── DoS gates: MUST run before the bcrypt RPC below. Fail closed. ──
  // Placed after the cheap format validation above so a malformed flood never consumes
  // the rate-limit budget — only credential-bearing requests (the ones that would reach
  // bcrypt) spend it.
  const limited = await enforceOAuthTokenRateLimit(supabase, clientIp(req));
  if (limited) return limited;

  // Verify the credential (bcrypt, service-role only). No row => bad/inactive/revoked.
  const { data, error } = await supabase.rpc("crm_authenticate_credential", {
    p_client_id: clientId,
    p_secret: clientSecret,
  });
  if (error) {
    console.error("crm-oauth-token: authenticate RPC error", {
      client_id: clientId,
      code: error.code,
    });
    return oauthError("server_error", "Authentication failed.", 500);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.imo_id || !row.credential_id) {
    // Generic 401 (triggers the platform's refresh-and-retry-once). Do not reveal which part failed.
    return oauthError("invalid_client", "Invalid client credentials.", 401);
  }

  // instance_url is load-bearing — the platform prepends it to the /api/v1/leads paths — so a
  // missing CRM_INSTANCE_URL must FAIL CLOSED (consistent with the signing key), never issue a
  // token the platform can't actually use.
  const instanceUrl = Deno.env.get("CRM_INSTANCE_URL") ?? "";
  if (!instanceUrl) {
    console.error("crm-oauth-token: CRM_INSTANCE_URL is not set");
    return oauthError("server_error", "Could not issue token.", 500);
  }

  let minted;
  try {
    minted = await mintCrmToken({
      imo_id: row.imo_id,
      credential_id: row.credential_id,
      scopes: row.scopes ?? [],
    });
  } catch (e) {
    // Fail closed (e.g. CRM_CALL_PLATFORM_SIGNING_KEY unset) — never issue an unsigned token.
    console.error("crm-oauth-token: token minting failed", {
      message: (e as Error).message,
    });
    return oauthError("server_error", "Could not issue token.", 500);
  }

  const scope = (row.scopes ?? []).join(" ");

  return jsonResponse(
    {
      access_token: minted.token,
      instance_url: instanceUrl,
      // Salesforce-style identity URL: base + /id/<tenant>/<credential>.
      id: `${instanceUrl}/id/${row.imo_id}/${row.credential_id}`,
      token_type: "Bearer",
      scope,
      expires_in: minted.expires_in,
    },
    200,
  );
}
