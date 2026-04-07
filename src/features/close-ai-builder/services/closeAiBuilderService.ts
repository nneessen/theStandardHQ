// Service layer for the Close AI Builder feature.
// Calls the close-ai-builder edge function which handles gating, AI generation,
// and Close API writes. Mirrors the pattern in closeKpiService.ts.

import { supabase } from "@/services/base/supabase";

/**
 * Typed error class for Close AI Builder edge function failures. Carries the
 * edge function's `code` (e.g. RATE_LIMITED, FEATURE_LOCKED, CLOSE_AUTH_ERROR,
 * CLOSE_NOT_CONNECTED, INTERNAL_ERROR) and any sanitized Close API error body
 * so callers can render specific UI (e.g. "connect Close" prompt, "retry in
 * 24h", etc.) instead of generic messages.
 */
export class CloseAiBuilderError extends Error {
  code?: string;
  status?: number;
  closeErrorBody?: unknown;

  constructor(
    message: string,
    opts: { code?: string; status?: number; closeErrorBody?: unknown } = {},
  ) {
    super(message);
    this.name = "CloseAiBuilderError";
    this.code = opts.code;
    this.status = opts.status;
    this.closeErrorBody = opts.closeErrorBody;
  }

  get isRateLimited(): boolean {
    return this.code === "RATE_LIMITED";
  }
  get isFeatureLocked(): boolean {
    return this.code === "FEATURE_LOCKED";
  }
  get isCloseAuthError(): boolean {
    return this.code === "CLOSE_AUTH_ERROR";
  }
  get isNotConnected(): boolean {
    return (
      this.code === "CLOSE_NOT_CONNECTED" || this.code === "CLOSE_INACTIVE"
    );
  }
}
import type {
  CloseEmailTemplate,
  CloseSequence,
  CloseSmsTemplate,
  ConnectionStatus,
  EmailGenerationResponse,
  EmailPromptOptions,
  GeneratedEmailTemplate,
  GeneratedSequence,
  GeneratedSmsTemplate,
  GenerationsListResponse,
  ListResponse,
  SaveEmailTemplateResponse,
  SaveSequenceResponse,
  SaveSmsTemplateResponse,
  SequenceGenerationResponse,
  SequencePromptOptions,
  SmsGenerationResponse,
  SmsPromptOptions,
} from "../types/close-ai-builder.types";

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let token = session?.access_token;
  if (!token) {
    const {
      data: { session: refreshed },
    } = await supabase.auth.refreshSession();
    token = refreshed?.access_token;
  }
  if (!token) throw new Error("Session expired. Please log in again.");
  return token;
}

async function invokeBuilder<T>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const accessToken = await getAccessToken();
  const { data, error } = await supabase.functions.invoke("close-ai-builder", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { action, ...params },
  });

  if (error) {
    // Try to extract the edge function's structured error body from
    // FunctionsHttpError.context (a Response). If that succeeds, throw a
    // typed CloseAiBuilderError carrying code/status/closeErrorBody so the
    // UI can render specific handling per error type.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as {
          error?: string;
          code?: string;
          close_error_body?: unknown;
        };
        throw new CloseAiBuilderError(
          body?.error || error.message || "Close AI Builder error",
          {
            code: body?.code,
            status: ctx.status,
            closeErrorBody: body?.close_error_body,
          },
        );
      } catch (e) {
        // Re-throw our typed error; swallow JSON parse failures.
        if (e instanceof CloseAiBuilderError) throw e;
      }
    }
    throw new CloseAiBuilderError(error.message || "Close AI Builder error");
  }

  // Some edge function paths return 200 with an error field inside the body
  // (e.g. when it was simpler than throwing). Treat these as typed errors too.
  if (data?.error) {
    throw new CloseAiBuilderError(data.error, {
      code: data.code,
      closeErrorBody: data.close_error_body,
    });
  }

  return data as T;
}

export const closeAiBuilderService = {
  // Connection
  connectionStatus: () => invokeBuilder<ConnectionStatus>("connection_status"),

  // Generation
  generateEmail: (prompt: string, options: EmailPromptOptions = {}) =>
    invokeBuilder<EmailGenerationResponse>("generate_email_template", {
      prompt,
      options,
    }),

  generateSms: (prompt: string, options: SmsPromptOptions = {}) =>
    invokeBuilder<SmsGenerationResponse>("generate_sms_template", {
      prompt,
      options,
    }),

  generateSequence: (prompt: string, options: SequencePromptOptions = {}) =>
    invokeBuilder<SequenceGenerationResponse>("generate_sequence", {
      prompt,
      options,
    }),

  // Save
  saveEmail: (template: GeneratedEmailTemplate, generationId?: string) =>
    invokeBuilder<SaveEmailTemplateResponse>("save_email_template", {
      template,
      generation_id: generationId,
    }),

  saveSms: (template: GeneratedSmsTemplate, generationId?: string) =>
    invokeBuilder<SaveSmsTemplateResponse>("save_sms_template", {
      template,
      generation_id: generationId,
    }),

  saveSequence: (sequence: GeneratedSequence, generationId?: string) =>
    invokeBuilder<SaveSequenceResponse>("save_sequence", {
      sequence,
      generation_id: generationId,
    }),

  // List
  listEmailTemplates: (params: { limit?: number; skip?: number } = {}) =>
    invokeBuilder<ListResponse<CloseEmailTemplate>>(
      "list_email_templates",
      params,
    ),

  listSmsTemplates: (params: { limit?: number; skip?: number } = {}) =>
    invokeBuilder<ListResponse<CloseSmsTemplate>>("list_sms_templates", params),

  listSequences: (params: { limit?: number; skip?: number } = {}) =>
    invokeBuilder<ListResponse<CloseSequence>>("list_sequences", params),

  // Update
  updateEmailTemplate: (id: string, patch: Partial<GeneratedEmailTemplate>) =>
    invokeBuilder<SaveEmailTemplateResponse>("update_email_template", {
      id,
      patch,
    }),

  updateSmsTemplate: (id: string, patch: Partial<GeneratedSmsTemplate>) =>
    invokeBuilder<SaveSmsTemplateResponse>("update_sms_template", {
      id,
      patch,
    }),

  // Delete
  deleteEmailTemplate: (id: string) =>
    invokeBuilder<{ deleted: string }>("delete_email_template", { id }),

  deleteSmsTemplate: (id: string) =>
    invokeBuilder<{ deleted: string }>("delete_sms_template", { id }),

  deleteSequence: (id: string) =>
    invokeBuilder<{ deleted: string }>("delete_sequence", { id }),

  // History
  getGenerations: (
    params: {
      limit?: number;
      generationType?: "email" | "sms" | "sequence";
    } = {},
  ) =>
    invokeBuilder<GenerationsListResponse>("get_generations", {
      limit: params.limit,
      generation_type: params.generationType,
    }),
};
