// supabase/functions/close-ai-builder/index.ts
//
// AI-powered Close CRM email/SMS template + sequence builder.
//
// Gating (mirrors business-tools-proxy):
//   1. Super-admin (nickneessen@thestandardhq.com) — always allowed
//   2. Subscription feature flag close_ai_builder — paid team plan
//   3. Direct downline of owner (RPC is_direct_downline_of_owner) — free access
//
// Every action requires a working close_config row with an active encrypted API
// key. Generation actions call Anthropic and persist to close_ai_generations.
// Save actions POST to Close and stamp the generation row with close_id.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";
import {
  createEmailTemplate,
  createSequence,
  createSmsTemplate,
  CloseSequenceStep,
  deleteEmailTemplate,
  deleteSequence,
  deleteSmsTemplate,
  listEmailTemplates,
  listSequences,
  listSmsTemplates,
  updateEmailTemplate,
  updateSmsTemplate,
} from "./close/endpoints.ts";
import {
  generateEmailTemplate,
  type EmailPromptOptions,
} from "./ai/email-prompt.ts";
import { generateSmsTemplate, type SmsPromptOptions } from "./ai/sms-prompt.ts";
import {
  generateSequence,
  type SequencePromptOptions,
} from "./ai/sequence-prompt.ts";

// ─── CORS ──────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "https://app.thestandardhq.com",
  "https://www.thestandardhq.com",
  "https://thestandardhq.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3003",
  "http://127.0.0.1:3004",
];

function isLoopback(v?: string | null) {
  return !!v && (v.includes("127.0.0.1") || v.includes("localhost"));
}

function corsHeaders(req?: Request) {
  const reqOrigin = req?.headers.get("origin") ?? "";
  const isLocal =
    isLoopback(Deno.env.get("SUPABASE_URL")) ||
    isLoopback(reqOrigin) ||
    isLoopback(req?.url);
  let origin = "*";
  if (reqOrigin && isLoopback(reqOrigin)) {
    origin = reqOrigin;
  } else if (!isLocal && req) {
    origin = ALLOWED_ORIGINS.includes(reqOrigin)
      ? reqOrigin
      : ALLOWED_ORIGINS[0];
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// deno-lint-ignore no-explicit-any
function json(data: any, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── Close error body sanitizer ────────────────────────────────────
//
// Close API errors come back as { errors?: string[], field-errors?: {...} }.
// We've seen those two shapes in production (see close/README.md). Anything
// else in the body could theoretically contain org identifiers, internal
// fields, or credentials if a future Close API change starts echoing them.
// Strip everything except the two known-safe fields before surfacing to the
// client. Anything unexpected becomes `{ _stripped: true }` so we know at
// least SOMETHING was there.

// deno-lint-ignore no-explicit-any
function sanitizeCloseErrorBody(body: any): unknown {
  if (body == null) return null;
  if (typeof body === "string") {
    // Cap length to avoid echoing huge payloads; 1 KB is plenty for error text.
    return body.length > 1024 ? body.slice(0, 1024) + "…(truncated)" : body;
  }
  if (typeof body !== "object") return null;

  const out: Record<string, unknown> = {};
  if (Array.isArray(body.errors)) {
    out.errors = body.errors
      .filter((e: unknown) => typeof e === "string")
      .slice(0, 20); // cap count
  }
  const fieldErrors = body["field-errors"];
  if (fieldErrors && typeof fieldErrors === "object") {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (typeof v === "string" && typeof k === "string") {
        cleaned[k.slice(0, 64)] = v.slice(0, 256);
      }
    }
    out["field-errors"] = cleaned;
  }
  // If we recognized nothing, signal that something was stripped so the
  // caller knows the original body existed but wasn't safe to echo.
  if (Object.keys(out).length === 0) {
    return { _stripped: true };
  }
  return out;
}

// ─── Auth & gating ─────────────────────────────────────────────────

const SUPER_ADMIN_EMAIL = "nickneessen@thestandardhq.com";

async function verifyAndGate(
  req: Request,
): Promise<
  | {
      ok: true;
      user: { id: string; email: string };
      userClient: SupabaseClient;
    }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      ok: false,
      response: json({ error: "Missing Authorization header" }, 401, req),
    };
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } =
    await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, response: json({ error: "Unauthorized" }, 401, req) };
  }

  const user = {
    id: userData.user.id,
    email: (userData.user.email ?? "").toLowerCase(),
  };

  // Tier 1: super-admin bypass
  if (user.email === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { ok: true, user, userClient };
  }

  // Tier 2: subscription feature flag
  const { data: hasFeature, error: featureErr } = await userClient.rpc(
    "user_has_feature",
    { p_user_id: user.id, p_feature: "close_ai_builder" },
  );
  if (featureErr) {
    console.error("[close-ai-builder] user_has_feature rpc error:", featureErr);
  }
  if (hasFeature) {
    return { ok: true, user, userClient };
  }

  // Tier 3: owner-downline fallback
  const { data: isDownline } = await userClient.rpc(
    "is_direct_downline_of_owner",
    { p_user_id: user.id },
  );
  if (isDownline) {
    return { ok: true, user, userClient };
  }

  return {
    ok: false,
    response: json(
      {
        error: "Close AI Builder not available on your plan",
        code: "FEATURE_LOCKED",
      },
      403,
      req,
    ),
  };
}

// ─── Close API key retrieval ───────────────────────────────────────

async function getUserCloseApiKey(
  userClient: SupabaseClient,
  userId: string,
): Promise<string> {
  // close_config has RLS that restricts reads to auth.uid() = user_id,
  // so the user client can read its own row directly.
  const { data, error } = await userClient
    .from("close_config")
    .select("api_key_encrypted, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw Object.assign(
      new Error(`Failed to load close_config: ${error.message}`),
      {
        code: "CLOSE_CONFIG_READ_ERROR",
        status: 500,
      },
    );
  }
  if (!data) {
    throw Object.assign(new Error("No Close API key connected for this user"), {
      code: "CLOSE_NOT_CONNECTED",
      status: 412,
    });
  }
  if (!data.is_active) {
    throw Object.assign(new Error("Close API key is inactive"), {
      code: "CLOSE_INACTIVE",
      status: 412,
    });
  }
  return await decrypt(data.api_key_encrypted);
}

// ─── Generation persistence ────────────────────────────────────────

interface InsertGenerationArgs {
  userId: string;
  generationType: "email" | "sms" | "sequence";
  prompt: string;
  // deno-lint-ignore no-explicit-any
  options: any;
  // deno-lint-ignore no-explicit-any
  outputJson: any;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
}

async function insertGeneration(
  userClient: SupabaseClient,
  args: InsertGenerationArgs,
): Promise<string> {
  const { data, error } = await userClient
    .from("close_ai_generations")
    .insert({
      user_id: args.userId,
      generation_type: args.generationType,
      prompt: args.prompt,
      options: args.options ?? {},
      output_json: args.outputJson,
      model_used: args.modelUsed,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to persist generation: ${error.message}`);
  }
  return data!.id as string;
}

async function markGenerationSaved(
  userClient: SupabaseClient,
  generationId: string,
  closeId: string,
  closeChildIds: string[] = [],
  // deno-lint-ignore no-explicit-any
  finalOutputJson?: any,
): Promise<void> {
  const patch: Record<string, unknown> = {
    close_id: closeId,
    close_child_ids: closeChildIds.length > 0 ? closeChildIds : null,
    saved_at: new Date().toISOString(),
  };
  if (finalOutputJson) patch.output_json = finalOutputJson;

  const { error } = await userClient
    .from("close_ai_generations")
    .update(patch)
    .eq("id", generationId);

  if (error) {
    console.error("[close-ai-builder] failed to mark generation saved:", error);
    // Non-fatal — the Close objects were created successfully.
  }
}

// ─── Action handlers ───────────────────────────────────────────────

interface ActionContext {
  user: { id: string; email: string };
  userClient: SupabaseClient;
  req: Request;
  body: Record<string, unknown>;
}

// ─── Rate limiting ─────────────────────────────────────────────────
//
// Per-user daily generation cap to bound Anthropic cost exposure.
// Super-admin bypasses; every other caller is limited to DAILY_GENERATION_CAP
// generations per rolling 24-hour window, counted from close_ai_generations.
//
// Why a rolling window (not calendar day): prevents cap reset at midnight
// from being exploited to double-spend in a short interval. Costs ~1 extra
// SELECT per generation — cheap compared to the Anthropic call that follows.

const DAILY_GENERATION_CAP = 50;

async function enforceGenerationRateLimit(
  ctx: ActionContext,
): Promise<Response | null> {
  // Super-admin bypass — same email check used in verifyAndGate
  if (ctx.user.email === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return null;
  }

  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { count, error } = await ctx.userClient
    .from("close_ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id)
    .gte("created_at", twentyFourHoursAgo);

  if (error) {
    // Fail-open on counter read error — we prefer false negatives (allowing a
    // generation past cap) to false positives (blocking a paying user). Logged
    // so we can spot counter-outage patterns.
    console.error(
      "[close-ai-builder] rate-limit counter read failed:",
      error.message,
    );
    return null;
  }

  if ((count ?? 0) >= DAILY_GENERATION_CAP) {
    return json(
      {
        error: `Daily generation limit reached (${DAILY_GENERATION_CAP}/24h). Try again later.`,
        code: "RATE_LIMITED",
        cap: DAILY_GENERATION_CAP,
        window_seconds: 86400,
      },
      429,
      ctx.req,
    );
  }
  return null;
}

async function handleGenerateEmail(ctx: ActionContext): Promise<Response> {
  const prompt = String(ctx.body.prompt ?? "").trim();
  if (!prompt) return json({ error: "prompt is required" }, 400, ctx.req);
  const options = (ctx.body.options as EmailPromptOptions) ?? {};

  const rateLimited = await enforceGenerationRateLimit(ctx);
  if (rateLimited) return rateLimited;

  const result = await generateEmailTemplate(prompt, options);
  const generationId = await insertGeneration(ctx.userClient, {
    userId: ctx.user.id,
    generationType: "email",
    prompt,
    options,
    outputJson: result.template,
    modelUsed: result.model,
    inputTokens: result.input_tokens,
    outputTokens: result.output_tokens,
  });

  return json(
    {
      generation_id: generationId,
      template: result.template,
      model: result.model,
      tokens: {
        input: result.input_tokens,
        output: result.output_tokens,
      },
    },
    200,
    ctx.req,
  );
}

async function handleGenerateSms(ctx: ActionContext): Promise<Response> {
  const prompt = String(ctx.body.prompt ?? "").trim();
  if (!prompt) return json({ error: "prompt is required" }, 400, ctx.req);
  const options = (ctx.body.options as SmsPromptOptions) ?? {};

  const rateLimited = await enforceGenerationRateLimit(ctx);
  if (rateLimited) return rateLimited;

  const result = await generateSmsTemplate(prompt, options);
  const generationId = await insertGeneration(ctx.userClient, {
    userId: ctx.user.id,
    generationType: "sms",
    prompt,
    options,
    outputJson: result.template,
    modelUsed: result.model,
    inputTokens: result.input_tokens,
    outputTokens: result.output_tokens,
  });

  return json(
    {
      generation_id: generationId,
      template: result.template,
      model: result.model,
      tokens: {
        input: result.input_tokens,
        output: result.output_tokens,
      },
    },
    200,
    ctx.req,
  );
}

async function handleGenerateSequence(ctx: ActionContext): Promise<Response> {
  const prompt = String(ctx.body.prompt ?? "").trim();
  if (!prompt) return json({ error: "prompt is required" }, 400, ctx.req);
  const options = (ctx.body.options as SequencePromptOptions) ?? {};

  const rateLimited = await enforceGenerationRateLimit(ctx);
  if (rateLimited) return rateLimited;

  const result = await generateSequence(prompt, options);
  const generationId = await insertGeneration(ctx.userClient, {
    userId: ctx.user.id,
    generationType: "sequence",
    prompt,
    options,
    outputJson: result.sequence,
    modelUsed: result.model,
    inputTokens: result.input_tokens,
    outputTokens: result.output_tokens,
  });

  return json(
    {
      generation_id: generationId,
      sequence: result.sequence,
      model: result.model,
      tokens: {
        input: result.input_tokens,
        output: result.output_tokens,
      },
    },
    200,
    ctx.req,
  );
}

async function handleSaveEmail(ctx: ActionContext): Promise<Response> {
  const generationId = ctx.body.generation_id as string | undefined;
  const template = ctx.body.template as
    | { name: string; subject: string; body: string }
    | undefined;
  if (!template?.name || !template?.subject || !template?.body) {
    return json(
      { error: "template { name, subject, body } is required" },
      400,
      ctx.req,
    );
  }

  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  const created = await createEmailTemplate(apiKey, template);

  if (generationId) {
    await markGenerationSaved(
      ctx.userClient,
      generationId,
      created.id,
      [],
      template,
    );
  }

  return json({ template: created }, 200, ctx.req);
}

async function handleSaveSms(ctx: ActionContext): Promise<Response> {
  const generationId = ctx.body.generation_id as string | undefined;
  const template = ctx.body.template as
    | { name: string; text: string }
    | undefined;
  if (!template?.name || !template?.text) {
    return json({ error: "template { name, text } is required" }, 400, ctx.req);
  }

  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  const created = await createSmsTemplate(apiKey, template);

  if (generationId) {
    await markGenerationSaved(
      ctx.userClient,
      generationId,
      created.id,
      [],
      template,
    );
  }

  return json({ template: created }, 200, ctx.req);
}

async function handleSaveSequence(ctx: ActionContext): Promise<Response> {
  const generationId = ctx.body.generation_id as string | undefined;
  // deno-lint-ignore no-explicit-any
  const seq = ctx.body.sequence as any;
  // Note: we don't validate seq.timezone here because the save path
  // hardcodes FIXED_SEQUENCE_TIMEZONE regardless of what the client sends.
  // The AI and the preview editor may still show a timezone for UX reasons
  // but it's display-only at save time.
  if (!seq?.name || !Array.isArray(seq?.steps) || seq.steps.length === 0) {
    return json(
      {
        error:
          "sequence { name, steps[] } is required and must have at least one step",
      },
      400,
      ctx.req,
    );
  }

  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);

  // Phase 1 of save: materialize each inline template into a real Close object.
  //
  // Two critical behaviors:
  //
  // 1. RELATIVE DELAYS. Close's sequence API interprets `delay` as seconds
  //    SINCE THE PREVIOUS STEP, NOT as absolute seconds from sequence start.
  //    Our AI prompt + UI still work in absolute "Day N" numbers because that's
  //    the natural way humans think about multi-touch cadences ("Day 1, Day 3,
  //    Day 7"). We convert to Close's relative model here at save time:
  //       delay_i = (day_i - day_{i-1}) * 86400      for i > 0
  //       delay_0 = (day_0 - 1) * 86400              (Day 1 = immediate = 0)
  //
  // 2. TEMPLATE NAME PREFIXING. Every template created as part of a workflow
  //    gets its name prefixed with the workflow's name (in square brackets)
  //    so agents can find all templates belonging to a workflow by searching
  //    the Close template library. Idempotent — skip if the AI already added
  //    the prefix.
  // Track created templates with their kind so rollback can call the right
  // delete endpoint (email vs SMS templates have different paths in Close).
  const createdTemplates: Array<{ id: string; kind: "email" | "sms" }> = [];
  const createdTemplateIds: string[] = [];
  const finalSteps: CloseSequenceStep[] = [];
  const sortedSteps = [...seq.steps].sort(
    // deno-lint-ignore no-explicit-any
    (a: any, b: any) => (a.day ?? 1) - (b.day ?? 1),
  );
  const workflowName = String(seq.name).trim();

  // Prefix a template name with the workflow name in brackets, unless already prefixed.
  const prefixTemplateName = (raw: string): string => {
    const trimmed = String(raw).trim();
    if (!trimmed) return `[${workflowName}] Untitled`;
    const expectedPrefix = `[${workflowName}]`;
    if (trimmed.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
      return trimmed;
    }
    // Also catch the case where the AI used the workflow name without brackets
    // (e.g. "IUL Nurture - Day 1 Intro") — still prepend brackets so the
    // library search pattern `[workflow name]` finds every child template.
    return `[${workflowName}] ${trimmed}`;
  };

  let prevDay = 1; // "Day 1" is the enrollment moment (immediate, 0 delay)

  for (const step of sortedSteps) {
    const day = typeof step.day === "number" ? Math.max(1, step.day) : 1;
    // RELATIVE delay from the previous step (NOT absolute from sequence start).
    const delay = Math.max(0, (day - prevDay) * 86400);

    if (step.step_type === "email" && step.generated_email) {
      const tmpl = await createEmailTemplate(apiKey, {
        name: prefixTemplateName(step.generated_email.name),
        subject: step.generated_email.subject,
        body: step.generated_email.body,
      });
      createdTemplates.push({ id: tmpl.id, kind: "email" });
      createdTemplateIds.push(tmpl.id);
      finalSteps.push({
        step_type: "email",
        delay,
        email_template_id: tmpl.id,
        sms_template_id: null,
        threading:
          step.threading === "old_thread" ? "old_thread" : "new_thread",
      });
      prevDay = day;
    } else if (step.step_type === "sms" && step.generated_sms) {
      const tmpl = await createSmsTemplate(apiKey, {
        name: prefixTemplateName(step.generated_sms.name),
        text: step.generated_sms.text,
      });
      createdTemplates.push({ id: tmpl.id, kind: "sms" });
      createdTemplateIds.push(tmpl.id);
      finalSteps.push({
        step_type: "sms",
        delay,
        email_template_id: null,
        sms_template_id: tmpl.id,
        threading: null,
      });
      prevDay = day;
    } else {
      return json(
        {
          error: `Invalid step: step_type=${step.step_type} missing inline content`,
          created_template_ids: createdTemplateIds,
        },
        400,
        ctx.req,
      );
    }
  }

  // Phase 2: create the sequence itself referencing the real template IDs.
  // Timezone + schedule are hardcoded inside createSequence — ignoring any
  // value the client sent in seq.timezone.
  try {
    const created = await createSequence(apiKey, {
      name: seq.name,
      steps: finalSteps,
    });

    if (generationId) {
      await markGenerationSaved(
        ctx.userClient,
        generationId,
        created.id,
        createdTemplateIds,
        { ...seq, steps: finalSteps, final_sequence_id: created.id },
      );
    }

    return json(
      {
        sequence: created,
        created_template_ids: createdTemplateIds,
      },
      200,
      ctx.req,
    );
  } catch (err) {
    // Phase 2 (sequence create) failed. Templates from phase 1 are now
    // orphaned in the user's Close workspace. Attempt best-effort cleanup:
    // delete each created template by kind. Any delete failures are logged
    // but do not propagate — the user still gets the original sequence error
    // plus a list of any IDs that failed to clean up for manual removal.
    // deno-lint-ignore no-explicit-any
    const e = err as any;
    const cleanupFailures: Array<{ id: string; kind: string; error: string }> =
      [];

    for (const t of createdTemplates) {
      try {
        if (t.kind === "email") {
          await deleteEmailTemplate(apiKey, t.id);
        } else {
          await deleteSmsTemplate(apiKey, t.id);
        }
      } catch (delErr) {
        // deno-lint-ignore no-explicit-any
        const de = delErr as any;
        cleanupFailures.push({
          id: t.id,
          kind: t.kind,
          error: de?.message ?? String(delErr),
        });
        console.error(
          `[close-ai-builder] rollback failed to delete ${t.kind} template ${t.id}:`,
          de?.message ?? delErr,
        );
      }
    }

    // Update the audit row so the incomplete save is still recoverable from
    // the close_ai_generations table even though close_id is null.
    if (generationId) {
      await markGenerationSaved(
        ctx.userClient,
        generationId,
        // Sentinel: close_id null means "sequence creation failed"; children
        // list reflects whichever templates we could NOT clean up (so they
        // can be found via the audit table if the rollback also failed).
        "",
        cleanupFailures.map((f) => f.id),
        {
          ...seq,
          steps: finalSteps,
          phase_2_error: e?.message ?? "Failed to create sequence",
          phase_2_code: e?.code ?? "CLOSE_ERROR",
          rollback_failures: cleanupFailures,
        },
      );
    }

    const allRolledBack = cleanupFailures.length === 0;
    return json(
      {
        error: e?.message ?? "Failed to create sequence",
        code: e?.code ?? "CLOSE_ERROR",
        close_error_body: sanitizeCloseErrorBody(e?.body),
        rolled_back: allRolledBack,
        cleanup_failures: cleanupFailures,
        note: allRolledBack
          ? "Sequence creation failed. All generated templates were rolled back — safe to retry."
          : "Sequence creation failed. Some templates could not be rolled back automatically — see cleanup_failures[] for IDs to delete manually in Close.",
      },
      e?.status ?? 500,
      ctx.req,
    );
  }
}

async function handleListEmail(ctx: ActionContext): Promise<Response> {
  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  const limit = Number(ctx.body.limit ?? 50);
  const skip = Number(ctx.body.skip ?? 0);
  const data = await listEmailTemplates(apiKey, { limit, skip });
  return json(data, 200, ctx.req);
}

async function handleListSms(ctx: ActionContext): Promise<Response> {
  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  const limit = Number(ctx.body.limit ?? 50);
  const skip = Number(ctx.body.skip ?? 0);
  const data = await listSmsTemplates(apiKey, { limit, skip });
  return json(data, 200, ctx.req);
}

async function handleListSequences(ctx: ActionContext): Promise<Response> {
  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  const limit = Number(ctx.body.limit ?? 50);
  const skip = Number(ctx.body.skip ?? 0);
  const data = await listSequences(apiKey, { limit, skip });
  return json(data, 200, ctx.req);
}

async function handleUpdateEmail(ctx: ActionContext): Promise<Response> {
  const id = String(ctx.body.id ?? "");
  if (!id) return json({ error: "id is required" }, 400, ctx.req);
  // deno-lint-ignore no-explicit-any
  const patch = (ctx.body.patch as any) ?? {};
  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  const updated = await updateEmailTemplate(apiKey, id, patch);
  return json({ template: updated }, 200, ctx.req);
}

async function handleUpdateSms(ctx: ActionContext): Promise<Response> {
  const id = String(ctx.body.id ?? "");
  if (!id) return json({ error: "id is required" }, 400, ctx.req);
  // deno-lint-ignore no-explicit-any
  const patch = (ctx.body.patch as any) ?? {};
  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  const updated = await updateSmsTemplate(apiKey, id, patch);
  return json({ template: updated }, 200, ctx.req);
}

async function handleDeleteEmail(ctx: ActionContext): Promise<Response> {
  const id = String(ctx.body.id ?? "");
  if (!id) return json({ error: "id is required" }, 400, ctx.req);
  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  await deleteEmailTemplate(apiKey, id);
  return json({ deleted: id }, 200, ctx.req);
}

async function handleDeleteSms(ctx: ActionContext): Promise<Response> {
  const id = String(ctx.body.id ?? "");
  if (!id) return json({ error: "id is required" }, 400, ctx.req);
  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  await deleteSmsTemplate(apiKey, id);
  return json({ deleted: id }, 200, ctx.req);
}

async function handleDeleteSequence(ctx: ActionContext): Promise<Response> {
  const id = String(ctx.body.id ?? "");
  if (!id) return json({ error: "id is required" }, 400, ctx.req);
  const apiKey = await getUserCloseApiKey(ctx.userClient, ctx.user.id);
  await deleteSequence(apiKey, id);
  return json({ deleted: id }, 200, ctx.req);
}

async function handleGetGenerations(ctx: ActionContext): Promise<Response> {
  const limit = Number(ctx.body.limit ?? 50);
  const generationType = ctx.body.generation_type as string | undefined;

  let query = ctx.userClient
    .from("close_ai_generations")
    .select(
      "id, generation_type, prompt, options, output_json, model_used, input_tokens, output_tokens, close_id, close_child_ids, saved_at, created_at",
    )
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (generationType) {
    query = query.eq("generation_type", generationType);
  }

  const { data, error } = await query;
  if (error) {
    return json(
      { error: `Failed to load generations: ${error.message}` },
      500,
      ctx.req,
    );
  }
  return json({ generations: data ?? [] }, 200, ctx.req);
}

async function handleConnectionStatus(ctx: ActionContext): Promise<Response> {
  const { data, error } = await ctx.userClient
    .from("close_config")
    .select("is_active, organization_id, organization_name, last_verified_at")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (error) {
    return json({ error: error.message }, 500, ctx.req);
  }
  return json(
    {
      connected: !!data?.is_active,
      organization_id: data?.organization_id ?? null,
      organization_name: data?.organization_name ?? null,
      last_verified_at: data?.last_verified_at ?? null,
    },
    200,
    ctx.req,
  );
}

// ─── Main handler ─────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, req);
  }

  try {
    const gate = await verifyAndGate(req);
    if (!gate.ok) return gate.response;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, req);
    }

    const action = String(body.action ?? "");
    const ctx: ActionContext = {
      user: gate.user,
      userClient: gate.userClient,
      req,
      body,
    };

    switch (action) {
      case "connection_status":
        return await handleConnectionStatus(ctx);

      case "generate_email_template":
        return await handleGenerateEmail(ctx);
      case "generate_sms_template":
        return await handleGenerateSms(ctx);
      case "generate_sequence":
        return await handleGenerateSequence(ctx);

      case "save_email_template":
        return await handleSaveEmail(ctx);
      case "save_sms_template":
        return await handleSaveSms(ctx);
      case "save_sequence":
        return await handleSaveSequence(ctx);

      case "list_email_templates":
        return await handleListEmail(ctx);
      case "list_sms_templates":
        return await handleListSms(ctx);
      case "list_sequences":
        return await handleListSequences(ctx);

      case "update_email_template":
        return await handleUpdateEmail(ctx);
      case "update_sms_template":
        return await handleUpdateSms(ctx);

      case "delete_email_template":
        return await handleDeleteEmail(ctx);
      case "delete_sms_template":
        return await handleDeleteSms(ctx);
      case "delete_sequence":
        return await handleDeleteSequence(ctx);

      case "get_generations":
        return await handleGetGenerations(ctx);

      default:
        return json({ error: `Unknown action: ${action}` }, 400, req);
    }
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    const e = err as any;
    console.error("[close-ai-builder] unhandled error:", e?.message ?? e);
    return json(
      {
        error: e?.message ?? "Internal error",
        code: e?.code ?? "INTERNAL_ERROR",
        close_error_body: sanitizeCloseErrorBody(e?.body),
      },
      e?.status ?? 500,
      req,
    );
  }
});
