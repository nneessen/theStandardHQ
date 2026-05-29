// Close API v1 client — the SHARED, canonical implementation.
//
// Auth: HTTP Basic with the Close API key as the username and an empty password.
// Base URL: https://api.close.com/api/v1
//
// This is intentionally free of esm.sh / supabase imports so it stays unit-testable
// offline and can be bundled by any edge function. It owns the HTTP concerns: timeout,
// 401 (auth) and 429 (rate-limit, one backoff retry honoring Retry-After) handling.
//
// NOTE (consolidation, deferred): close-ai-builder/close/client.ts and
// close-lead-drop/close/client.ts predate this file and remain their own copies. New
// callers (assistant-orchestrator) MUST import from here; migrating the two older
// functions onto this module is a separate, lower-risk cleanup tracked for later.

const CLOSE_API_BASE = "https://api.close.com/api/v1";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface CloseApiError extends Error {
  code: "CLOSE_AUTH_ERROR" | "CLOSE_RATE_LIMIT" | "CLOSE_ERROR";
  status: number;
  /** Parsed `errors[]` and `field-errors{}` blob from Close, if any */
  body?: unknown;
}

/** Structural type guard — true for errors thrown by this client. */
export function isCloseApiError(e: unknown): e is CloseApiError {
  return (
    e instanceof Error &&
    typeof (e as CloseApiError).code === "string" &&
    typeof (e as CloseApiError).status === "number"
  );
}

function makeError(
  message: string,
  code: CloseApiError["code"],
  status: number,
  body?: unknown,
): CloseApiError {
  const err = new Error(message) as CloseApiError;
  err.code = code;
  err.status = status;
  err.body = body;
  return err;
}

async function parseErrorBody(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

async function closeApiFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (res.status === 401) {
    throw makeError(
      "Close API key is expired or invalid",
      "CLOSE_AUTH_ERROR",
      401,
    );
  }

  if (res.status === 429) {
    const wait = parseInt(res.headers.get("retry-after") ?? "3", 10);
    await new Promise((r) => setTimeout(r, wait * 1000));
    const retry = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!retry.ok) {
      throw makeError("Close API rate limit", "CLOSE_RATE_LIMIT", 429);
    }
    return retry;
  }

  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw makeError(`Close API ${res.status}`, "CLOSE_ERROR", res.status, body);
  }

  return res;
}

function authHeader(apiKey: string): string {
  return `Basic ${btoa(`${apiKey}:`)}`;
}

export async function closeGet<T = unknown>(
  apiKey: string,
  path: string,
): Promise<T> {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json",
    },
  });
  return (await res.json()) as T;
}

export async function closePost<T = unknown>(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export async function closeDelete(apiKey: string, path: string): Promise<void> {
  await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json",
    },
  });
}

/**
 * A read-only Close client bound to a single API key. The key is captured in the
 * closure and never re-exposed — callers (assistant tools) only ever see `.get()`,
 * which makes "never log or leak the key" structural rather than a discipline.
 *
 * Writes are intentionally NOT bound here: the orchestrator's model-facing tools are
 * read-only. Writes happen only in assistant-action-execute (a trusted backend that
 * already handles raw secrets), behind the draft→approve→execute gate, by calling
 * closePost directly with a key from getUserCloseKey() — never through this client.
 */
export interface BoundCloseReadClient {
  get<T = unknown>(path: string): Promise<T>;
}

export function bindCloseReadClient(apiKey: string): BoundCloseReadClient {
  return {
    get: <T = unknown>(path: string) => closeGet<T>(apiKey, path),
  };
}
