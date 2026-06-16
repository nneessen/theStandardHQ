// generate-call-script — AI synthesis of a generic, coaching-annotated MASTER
// SALES SCRIPT from the recent WINNING (sold) calls of one call type.
//
// POST { call_type_id } with an IMO-admin / super-admin JWT. The imo is derived
// SERVER-SIDE from the call type (globally unique) so a super-admin can generate
// cross-IMO. Flow:
//   1. authenticate (real 401),
//   2. derive the target IMO from the call type (404 if missing),
//   3. ADMIN gate mirroring the frontend hasImoAdminRole (imo_owner|imo_admin) or
//      super-admin (403), then the Epic-Life feature gate (403, fail closed),
//   4. AI-rate-limit (shared 30/hr + 200k tok/day),
//   5. gather <=15 sold + analyzed calls of the type; floor of MIN_CALLS,
//   6. ATOMICALLY claim the (imo, call_type) script row via kpi_claim_call_script
//      (409 if a fresh generation is already running; never blanks a live body),
//   7. in the BACKGROUND (EdgeRuntime.waitUntil — a Sonnet reduce can take 20-60s,
//      longer than a client invoke should block): build a token-bounded EXTRACTIVE
//      digest per call from its already-stored analysis + transcript turns, ask
//      Sonnet for ONE structured-JSON annotated script, validate, SERVER re-anchor
//      word-track hints to real kpi_word_tracks ids, then write script_body.
//   On any failure the prior script_body is LEFT INTACT (status='failed' only).
//
// PII: transcripts contain client PII and are sent to Anthropic by necessity. The
// prompt forbids client-specific data in the output and a server guard redacts any
// stray $-amounts / phone / SSN runs. NEVER console.log a transcript or model output.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";
import { resolveAiAccessFacts } from "../_shared/resolve-ai-access.ts";
import { enforceAiRateLimits, recordAiTokens } from "../_shared/rate-limit.ts";
import {
  getAnthropicClient,
  MODEL_SMART,
} from "../close-ai-builder/ai/anthropic-client.ts";
import {
  asArray,
  buildDigest,
  normalizeScript,
  parseJson,
  systemPrompt,
  userPrompt,
  type Segment,
  type SourceCall,
  type WordTrack,
} from "./synthesis.ts";

const FN_NAME = "generate-call-script";
const MIN_CALLS = 3; // floor for a meaningful synthesis (owner-confirmed)
const MAX_SOURCE_CALLS = 15; // most-recent sold calls fed per generation
// Output cap for the master script. 6144 truncated real 5-call syntheses mid-JSON
// (stop_reason=max_tokens → "truncated, try again", which never recovered because
// the output is deterministically larger than the cap). 16384 is the skill-backed
// non-streaming default — well under Sonnet 4.6's 64K output ceiling and the SDK's
// ~10-min HTTP timeout, with real headroom for a full 7-phase annotated script
// (its size is bounded by structure, not by how many source calls feed it).
const MAX_REDUCE_TOKENS = 16384;

// Roles per the IMO role model (mirror of src/types/imo.types.ts hasImoAdminRole).
const ADMIN_ROLES = new Set(["imo_owner", "imo_admin"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── 1. Body ────────────────────────────────────────────────────────────────
  let callTypeId: string | null = null;
  try {
    const body = (await req.json()) as { call_type_id?: unknown };
    if (typeof body?.call_type_id === "string") callTypeId = body.call_type_id;
  } catch {
    return json({ error: "Expected JSON body with call_type_id." }, 400);
  }
  if (!callTypeId) return json({ error: "call_type_id is required." }, 400);

  // ── 2. Authenticate ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const db = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;
  const admin = createSupabaseAdminClient();

  // ── 3. Derive the target IMO from the call type (globally unique) ────────────
  const { data: callType, error: ctErr } = await admin
    .from("kpi_call_types")
    .select("id, name, imo_id")
    .eq("id", callTypeId)
    .maybeSingle();
  if (ctErr) return json({ error: "Failed to load call type." }, 500);
  if (!callType) return json({ error: "Call type not found." }, 404);
  const targetImoId = callType.imo_id as string;
  const callTypeName = (callType.name as string) ?? "Sales Call";

  // ── 4. Admin gate (mirror frontend hasImoAdminRole) + Epic-Life gate ─────────
  const { data: profile, error: profErr } = await admin
    .from("user_profiles")
    .select("imo_id, roles, approval_status, is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profErr || !profile) return json({ error: "Profile not found." }, 403);
  const isSuperAdmin = profile.is_super_admin === true;
  const roles = Array.isArray(profile.roles) ? (profile.roles as string[]) : [];
  const isImoAdmin = roles.some((r) => ADMIN_ROLES.has(r));
  const approved = profile.approval_status === "approved";
  const canGenerate =
    isSuperAdmin || (approved && isImoAdmin && profile.imo_id === targetImoId);
  if (!canGenerate) {
    return json({ error: "Only IMO admins can generate sales scripts." }, 403);
  }

  const { data: isEpic } = await admin.rpc("is_epic_life_imo", {
    p_imo_id: targetImoId,
  });
  // Team IMOs (Epic Life) or super-admin generate free with no further lookups;
  // otherwise the caller's free_all_features IMO or ai_assistant ("AI Suite")
  // add-on. Mirrors useAiAccess. Fail closed.
  if (isEpic !== true && !isSuperAdmin) {
    const aiFacts = await resolveAiAccessFacts(admin, userId);
    if (!aiFacts.imoGrantsAllFeatures && !aiFacts.hasAiAddon) {
      return json(
        { error: "Script generation isn't available for this account." },
        403,
      );
    }
  }

  // ── 5. Gather the most-recent sold + analyzed calls of this type ─────────────
  const { data: callsRaw, error: gatherErr } = await admin
    .from("kpi_call_recordings")
    .select(
      "id, ai_summary, ai_key_moments, objection_events, transcript_segments, speaker_role_map, duration_seconds",
    )
    .eq("imo_id", targetImoId)
    .eq("call_type_id", callTypeId)
    .eq("outcome", "sold")
    .eq("analysis_status", "completed")
    .eq("transcription_status", "completed")
    .order("call_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_SOURCE_CALLS);
  if (gatherErr) return json({ error: "Failed to load source calls." }, 500);

  // Keep only calls that can contribute real content (segments OR stored analysis).
  const calls = (callsRaw ?? []).filter((c: Record<string, unknown>) => {
    const hasSegments = asArray<Segment>(c.transcript_segments).length > 0;
    const hasAnalysis =
      (typeof c.ai_summary === "string" && c.ai_summary.trim().length > 0) ||
      asArray<unknown>(c.objection_events).length > 0;
    return hasSegments || hasAnalysis;
  }) as SourceCall[];

  // ── 6. Floor check BEFORE claiming. The claim flips status→processing, so
  //      claiming first and THEN failing the floor would strand an existing good
  //      script as "Generating…"/"Refresh failed". Check first: a prior good
  //      script is left completely untouched; only record a failed row when there
  //      is no script to protect (so the UI can show the "need more calls" reason).
  if (calls.length < MIN_CALLS) {
    const msg = `Need at least ${MIN_CALLS} analyzed sold calls of this type; found ${calls.length}.`;
    const { data: existing } = await admin
      .from("kpi_call_scripts")
      .select("script_body")
      .eq("imo_id", targetImoId)
      .eq("call_type_id", callTypeId)
      .maybeSingle();
    if (!existing?.script_body) {
      await admin.from("kpi_call_scripts").upsert(
        {
          imo_id: targetImoId,
          call_type_id: callTypeId,
          status: "failed",
          generation_error: msg,
          updated_by: userId,
        },
        { onConflict: "imo_id,call_type_id" },
      );
    }
    return json(
      {
        ok: false,
        status: "failed",
        source_call_count: calls.length,
        error: msg,
      },
      200,
    );
  }

  // ── 7. AI rate limits (shared budget). Only genuine generate attempts count —
  //      below-floor no-ops above never burn the hourly request budget.
  const limited = await enforceAiRateLimits(admin, FN_NAME, userId, cors);
  if (limited) return limited;

  // ── 8. Atomic claim (never blanks a live script_body) ────────────────────────
  const runId = crypto.randomUUID();
  const { data: claimedId, error: claimErr } = await admin.rpc(
    "kpi_claim_call_script",
    {
      p_imo_id: targetImoId,
      p_call_type_id: callTypeId,
      p_user: userId,
      p_run_id: runId,
    },
  );
  if (claimErr) return json({ error: "Could not start generation." }, 500);
  if (!claimedId) {
    return json(
      { error: "A script generation is already running for this call type." },
      409,
    );
  }

  // ── 9. Heavy synthesis runs in the BACKGROUND; client returns 202 now ────────
  const work = (async () => {
    try {
      const { data: tracksRaw } = await admin
        .from("kpi_word_tracks")
        .select("id, label, phrase, category")
        .eq("imo_id", targetImoId)
        .eq("is_active", true)
        .in("scope", ["team", "imo"]);
      const tracks = (tracksRaw ?? []) as WordTrack[];

      const digests = calls.map((c, i) => buildDigest(c, i));

      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: MODEL_SMART,
        max_tokens: MAX_REDUCE_TOKENS,
        system: systemPrompt(),
        messages: [
          { role: "user", content: userPrompt(callTypeName, digests, tracks) },
        ],
      });
      const tokensUsed =
        (response.usage?.input_tokens ?? 0) +
        (response.usage?.output_tokens ?? 0);
      await recordAiTokens(admin, userId, tokensUsed);

      if (response.stop_reason === "max_tokens") {
        throw new Error("The generated script was truncated. Try again.");
      }
      const rawText = response.content
        .filter(
          (b): b is { type: "text"; text: string } =>
            b.type === "text" && "text" in b,
        )
        .map((b) => b.text)
        .join("");
      const scriptBody = normalizeScript(
        parseJson(rawText),
        callTypeName,
        tracks,
      );

      const { error: saveErr } = await admin
        .from("kpi_call_scripts")
        .update({
          script_body: scriptBody,
          status: "completed",
          generation_error: null,
          model: MODEL_SMART,
          source_recording_ids: calls.map((c) => c.id),
          source_call_count: calls.length,
          tokens_used: tokensUsed,
          generated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("imo_id", targetImoId)
        .eq("call_type_id", callTypeId)
        .eq("last_run_id", runId);
      if (saveErr) throw new Error(saveErr.message);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Script generation failed.";
      // Leave any prior script_body intact — only flip status + record the error.
      await admin
        .from("kpi_call_scripts")
        .update({
          status: "failed",
          generation_error: message,
          updated_by: userId,
        })
        .eq("imo_id", targetImoId)
        .eq("call_type_id", callTypeId)
        .eq("last_run_id", runId);
    }
  })();

  const runtime = (
    globalThis as {
      EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
    }
  ).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work; // local `functions serve` may lack EdgeRuntime → run inline

  return json(
    { ok: true, status: "processing", source_call_count: calls.length },
    202,
  );
});
