// Inbound-Call CRM Integration — stateless M2M bearer token (sign + verify).
//
// Why a dedicated module instead of _shared/hmac.ts: hmac.ts's parseSignedState
// verifies ONLY the signature — it checks no expiry/issued-at/type claims — and is
// keyed to SLACK_SIGNING_SECRET (a different rotation domain). M2M bearer tokens must
// be expiry-checked and type-scoped, with their own signing key.
//
// Token shape:  base64url(JSON payload) + "." + HMAC-SHA256(payload)  (hex)
// Payload:      { imo_id, credential_id, scopes, typ:"crm_m2m", iat, exp }
//
// FAIL CLOSED: a missing CRM_CALL_PLATFORM_SIGNING_KEY throws — we never sign or
// verify with an empty key (an empty key would make every token forgeable).

const SIGNING_KEY_ENV = "CRM_CALL_PLATFORM_SIGNING_KEY";
const TOKEN_TYPE = "crm_m2m";
const CLOCK_SKEW_SECONDS = 60;
export const CRM_TOKEN_TTL_SECONDS = 86400; // 24h, per the platform spec

export interface CrmTokenPayload {
  imo_id: string;
  credential_id: string;
  scopes: string[];
  typ: string;
  iat: number;
  exp: number;
}

function getSigningKeyMaterial(): string {
  const key = Deno.env.get(SIGNING_KEY_ENV) ?? "";
  if (!key) {
    throw new Error(`${SIGNING_KEY_ENV} is not set`);
  }
  return key;
}

async function importHmacKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningKeyMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return atob(b64 + pad);
}

async function hmacHex(data: string): Promise<string> {
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return bytesToHex(new Uint8Array(sig));
}

// Constant-time comparison over equal-length hex strings (prevents timing attacks).
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function signCrmToken(payload: CrmTokenPayload): Promise<string> {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacHex(body);
  return `${body}.${signature}`;
}

/**
 * Verify a bearer token: signature (constant-time), then the typ/iat/exp claims.
 * Returns the payload when valid, or null for ANY failure (caller responds 401).
 */
export async function verifyCrmToken(
  token: string,
): Promise<CrmTokenPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  let expected: string;
  try {
    expected = await hmacHex(body); // throws if the signing key is unset -> reject
  } catch {
    return null;
  }
  if (!constantTimeEqual(expected, signature)) return null;

  let payload: CrmTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body)) as CrmTokenPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.typ !== TOKEN_TYPE) return null;
  if (typeof payload.iat !== "number" || payload.iat > now + CLOCK_SKEW_SECONDS)
    return null;
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (typeof payload.imo_id !== "string" || !payload.imo_id) return null;
  if (typeof payload.credential_id !== "string" || !payload.credential_id)
    return null;
  if (!Array.isArray(payload.scopes)) return null;

  return payload;
}

/** Mint a 24h token for an authenticated credential. */
export async function mintCrmToken(args: {
  imo_id: string;
  credential_id: string;
  scopes: string[];
}): Promise<{ token: string; payload: CrmTokenPayload; expires_in: number }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: CrmTokenPayload = {
    imo_id: args.imo_id,
    credential_id: args.credential_id,
    scopes: args.scopes ?? [],
    typ: TOKEN_TYPE,
    iat: now,
    exp: now + CRM_TOKEN_TTL_SECONDS,
  };
  return {
    token: await signCrmToken(payload),
    payload,
    expires_in: CRM_TOKEN_TTL_SECONDS,
  };
}
