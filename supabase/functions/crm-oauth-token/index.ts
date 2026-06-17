// supabase/functions/crm-oauth-token/index.ts
// OAuth2 client-credentials token endpoint for the external inbound-call platform.
//
// Flow: the platform POSTs `grant_type=client_credentials` + client_id + client_secret
// (form-urlencoded body OR HTTP Basic auth). We verify the credential via the
// service-role-only crm_authenticate_credential RPC (bcrypt), then mint a stateless
// 24h HMAC bearer (crm-token-decoder). The response is shaped exactly to the platform's
// Salesforce-style spec: { access_token, instance_url, id, token_type, scope, expires_in }.
//
// Auth model: this endpoint has its OWN auth (the client_id/secret), so config.toml sets
// verify_jwt=false. We do NOT import _shared/cors.ts (machine-to-machine; no browser origin).
//
// Required secrets (Deno.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-set by the
// runtime), CRM_CALL_PLATFORM_SIGNING_KEY (bearer signing key), CRM_INSTANCE_URL (the base
// URL the platform should target for /api/v1/leads — confirmed at onboarding).
//
// NEVER log client_secret or the minted token.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import { mintCrmToken } from "../_shared/crm-token-decoder.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
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

serve(async (req: Request): Promise<Response> => {
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
    supabase = createSupabaseAdminClient();
  } catch {
    return oauthError("server_error", "Service unavailable.", 500);
  }

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
});
