import type {
  VoiceCancellationPayload,
  VoiceClientResponse,
  VoiceEntitlementPayload,
  VoiceEntitlementSnapshot,
} from "../../../src/services/subscription/voice-sync.ts";

export interface VoiceUsageSnapshot {
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  includedMinutes: number;
  hardLimitMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  outboundCalls: number;
  inboundCalls: number;
  answeredCalls: number;
}

export interface VoicePhoneNumberData {
  id: string;
  agentId: string;
  phoneNumber: string;
  areaCode: number | null;
  countryCode: string;
  tollFree: boolean;
  numberProvider: string;
  nickname: string | null;
  isPrimary: boolean;
  status: string;
  externalSubscriptionItemId: string | null;
  purchasedAt: string;
  releasedAt: string | null;
}

export interface PurchasePhoneNumberBody {
  areaCode?: number;
  countryCode?: "US" | "CA";
  tollFree?: boolean;
  nickname?: string;
  externalSubscriptionItemId?: string;
}

export interface StandardChatBotVoiceClient {
  getVoiceEntitlement(
    agentId: string,
  ): Promise<VoiceClientResponse<VoiceEntitlementSnapshot>>;
  upsertVoiceEntitlement(
    agentId: string,
    payload: VoiceEntitlementPayload,
    idempotencyKey: string,
  ): Promise<VoiceClientResponse<VoiceEntitlementSnapshot>>;
  cancelVoiceEntitlement(
    agentId: string,
    payload: VoiceCancellationPayload,
    idempotencyKey: string,
  ): Promise<VoiceClientResponse<VoiceEntitlementSnapshot>>;
  getVoiceUsage(
    agentId: string,
  ): Promise<VoiceClientResponse<VoiceUsageSnapshot>>;

  // Phone number management
  purchasePhoneNumber(
    agentId: string,
    body: PurchasePhoneNumberBody,
    idempotencyKey: string,
  ): Promise<VoiceClientResponse<VoicePhoneNumberData>>;
  listPhoneNumbers(
    agentId: string,
  ): Promise<VoiceClientResponse<VoicePhoneNumberData[]>>;
  releasePhoneNumber(
    agentId: string,
    phoneNumberId: string,
    idempotencyKey: string,
  ): Promise<VoiceClientResponse<{ released: boolean }>>;
}

function getErrorMessage(body: unknown, fallback: string) {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const error = record.error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
    const message = record.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function resolveVoiceApiConfig() {
  const baseUrl =
    Deno.env.get("STANDARD_CHAT_BOT_API_URL") ||
    Deno.env.get("CHAT_BOT_API_URL");
  const apiKey =
    Deno.env.get("STANDARD_CHAT_BOT_EXTERNAL_API_KEY") ||
    Deno.env.get("CHAT_BOT_API_KEY");
  const timeoutRaw =
    Deno.env.get("STANDARD_CHAT_BOT_TIMEOUT_MS") ||
    Deno.env.get("CHAT_BOT_TIMEOUT_MS") ||
    "10000";
  const timeoutMs = Number.parseInt(timeoutRaw, 10);

  if (!baseUrl || !apiKey) {
    throw new Error("standard-chat-bot external voice API is not configured");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 10000,
  };
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createStandardChatBotVoiceClient(
  fetchImpl: typeof fetch = fetch,
): StandardChatBotVoiceClient {
  const config = resolveVoiceApiConfig();

  async function request<TData>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      idempotencyKey?: string;
    },
  ): Promise<VoiceClientResponse<TData>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        "X-API-Key": config.apiKey,
      };

      if (method !== "GET") {
        headers["Content-Type"] = "application/json";
      }
      if (options?.idempotencyKey) {
        headers["X-Idempotency-Key"] = options.idempotencyKey;
      }

      const response = await fetchImpl(
        `${config.baseUrl}/api/external${path}`,
        {
          method,
          headers,
          body:
            method === "GET" || options?.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          signal: controller.signal,
        },
      );

      const raw = await parseResponseBody(response);
      const data =
        raw && typeof raw === "object" && "data" in raw
          ? ((raw as Record<string, unknown>).data as TData | null)
          : null;

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          data,
          raw,
        };
      }

      return {
        ok: false,
        status: response.status,
        data,
        error: getErrorMessage(
          raw,
          `Voice API request failed (${response.status})`,
        ),
        raw,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: null,
        error:
          error instanceof Error ? error.message : "Voice API request failed",
        raw: error,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    getVoiceEntitlement(agentId) {
      return request<VoiceEntitlementSnapshot>(
        "GET",
        `/agents/${agentId}/voice-entitlement`,
      );
    },
    upsertVoiceEntitlement(agentId, payload, idempotencyKey) {
      return request<VoiceEntitlementSnapshot>(
        "PUT",
        `/agents/${agentId}/voice-entitlement`,
        {
          body: payload,
          idempotencyKey,
        },
      );
    },
    cancelVoiceEntitlement(agentId, payload, idempotencyKey) {
      return request<VoiceEntitlementSnapshot>(
        "POST",
        `/agents/${agentId}/voice-entitlement/cancel`,
        {
          body: payload,
          idempotencyKey,
        },
      );
    },
    getVoiceUsage(agentId) {
      return request<VoiceUsageSnapshot>(
        "GET",
        `/agents/${agentId}/voice-usage`,
      );
    },

    // Phone number management
    purchasePhoneNumber(agentId, body, idempotencyKey) {
      return request<VoicePhoneNumberData>(
        "POST",
        `/agents/${agentId}/voice/phone-numbers`,
        { body, idempotencyKey },
      );
    },
    listPhoneNumbers(agentId) {
      return request<VoicePhoneNumberData[]>(
        "GET",
        `/agents/${agentId}/voice/phone-numbers`,
      );
    },
    releasePhoneNumber(agentId, phoneNumberId, idempotencyKey) {
      return request<{ released: boolean }>(
        "DELETE",
        `/agents/${agentId}/voice/phone-numbers/${phoneNumberId}`,
        { idempotencyKey },
      );
    },
  };
}
