// Close API v1 client — Basic auth, timeout, 401/429 handling.
// Mirrors the pattern in supabase/functions/close-kpi-data/index.ts but
// isolated here because this function writes to Close rather than just reads.
//
// Auth: HTTP Basic with the Close API key as the username and an empty password.
// Base URL: https://api.close.com/api/v1 (see ./README.md for verified schemas)

const CLOSE_API_BASE = "https://api.close.com/api/v1";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface CloseApiError extends Error {
  code: "CLOSE_AUTH_ERROR" | "CLOSE_RATE_LIMIT" | "CLOSE_ERROR";
  status: number;
  /** Parsed `errors[]` and `field-errors{}` blob from Close, if any */
  body?: unknown;
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

export async function closePut<T = unknown>(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await closeApiFetch(`${CLOSE_API_BASE}${path}`, {
    method: "PUT",
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
