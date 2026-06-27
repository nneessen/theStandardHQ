// backfill-call-redaction — privileged one-shot re-processing of pre-Phase-1 call
// recordings that still hold raw PII (Call Reviews redaction Phase 3 backfill).
//
// These rows are redaction_status='pending'|'failed' and their transcript + AI
// fields (ai_summary, ai_key_moments, objection_events, caller_existing_coverage)
// + kpi_word_track_detections were generated from the RAW transcript → they leak
// SSN/banking. Per recording this fn:
//   1. NULLs the stale AI-derived fields and DELETEs its detection rows (so old
//      PII can't survive if a later step fails),
//   2. resets transcription_status='pending' and fires transcribe-call-recording
//      via the privileged service-role backfill path (skips the 10/hr limiter) →
//      re-transcribe → redact transcript + spans → analyze (clean AI) → mute →
//      lands 'needs_review' for an admin to approve in the Review Queue.
//   audio_deleted_at rows can't be re-transcribed (no raw audio): NULL their AI
//   fields + lock as 'rejected', and report them (they need transcript-only
//   redaction — a manual follow-up).
//
// Auth: a shared X-Backfill-Secret (BACKFILL_SECRET) — NOT a user JWT. Deployed
// verify_jwt=false. Idempotent: only targets rows still pending/failed, so it can
// be re-run to pick up stragglers. NEVER logs transcript / audio / PII.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";

serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Auth: dedicated backfill secret ──────────────────────────────────────
  const secret = Deno.env.get("BACKFILL_SECRET") ?? "";
  if (secret.length < 16 || req.headers.get("x-backfill-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Optional scoping from the body.
  let imoId: string | null = null;
  let limit = 1000;
  let dryRun = false;
  let remute = false;
  let analyzeMode = false;
  try {
    const body = (await req.json()) as {
      imo_id?: unknown;
      limit?: unknown;
      dry_run?: unknown;
      remute?: unknown;
      analyze?: unknown;
    };
    if (typeof body?.imo_id === "string") imoId = body.imo_id;
    if (typeof body?.limit === "number") limit = Math.min(1000, body.limit);
    dryRun = body?.dry_run === true;
    remute = body?.remute === true;
    analyzeMode = body?.analyze === true;
  } catch {
    // empty body is fine
  }

  const admin = createSupabaseAdminClient();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // ── Re-mute mode: re-fire muting for needs_review rows whose audio failed or
  //    is stale (muted_spans_version != spans_version). Used to recover after a
  //    worker error (e.g. a bad key) without re-transcribing. ────────────────
  if (remute) {
    let rq = admin
      .from("kpi_call_recordings")
      .select("id, audio_redaction_status, spans_version, muted_spans_version")
      .eq("redaction_status", "needs_review")
      .limit(limit);
    if (imoId) rq = rq.eq("imo_id", imoId);
    const { data: rrows, error: rerr } = await rq;
    if (rerr) {
      console.error("backfill remute load error", rerr.code ?? "");
      return json({ error: "Failed to load recordings." }, 500);
    }
    const stale = (rrows ?? []).filter(
      (r) =>
        r.audio_redaction_status !== "done" ||
        (r.muted_spans_version ?? 0) !== (r.spans_version ?? 0),
    );
    if (dryRun)
      return json({
        ok: true,
        dry_run: true,
        remute: true,
        stale: stale.length,
      });
    const rfires = stale.map((r) =>
      fetch(`${supabaseUrl}/functions/v1/redact-call-audio`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recording_id: r.id, force: true }),
      })
        .then((res) => {
          if (!res.ok) console.error("remute dispatch non-ok", res.status);
        })
        .catch((e) =>
          console.error(
            "remute dispatch failed",
            e instanceof Error ? e.message : "",
          ),
        ),
    );
    const rt = (
      globalThis as {
        EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
      }
    ).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(Promise.allSettled(rfires));
    return json({ ok: true, remuting: stale.length });
  }

  // ── Analyze mode: regenerate AI analysis on re-redacted transcripts (runs on
  //    the already-redacted text → clean by construction). For rows whose AI
  //    didn't regenerate during the re-transcribe (analyze rejected the call). ─
  if (analyzeMode) {
    let aq = admin
      .from("kpi_call_recordings")
      .select("id, analysis_status")
      .eq("redaction_status", "needs_review")
      .neq("analysis_status", "completed")
      .eq("transcription_status", "completed")
      .limit(limit);
    if (imoId) aq = aq.eq("imo_id", imoId);
    const { data: arows, error: aerr } = await aq;
    if (aerr) {
      console.error("backfill analyze load error", aerr.code ?? "");
      return json({ error: "Failed to load recordings." }, 500);
    }
    const pend = arows ?? [];
    if (dryRun)
      return json({
        ok: true,
        dry_run: true,
        analyze: true,
        pending: pend.length,
      });
    const afires = pend.map((r) =>
      fetch(`${supabaseUrl}/functions/v1/analyze-call-transcript`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recording_id: r.id, force: true }),
      })
        .then((res) => {
          if (!res.ok) console.error("analyze dispatch non-ok", res.status);
        })
        .catch((e) =>
          console.error(
            "analyze dispatch failed",
            e instanceof Error ? e.message : "",
          ),
        ),
    );
    const at = (
      globalThis as {
        EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
      }
    ).EdgeRuntime;
    if (at?.waitUntil) at.waitUntil(Promise.allSettled(afires));
    return json({ ok: true, analyzing: pend.length });
  }

  // Eligible = still pending/failed (re-runnable; approved/needs_review skipped).
  let q = admin
    .from("kpi_call_recordings")
    .select("id, audio_deleted_at, raw_audio_purged_at")
    .in("redaction_status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (imoId) q = q.eq("imo_id", imoId);
  const { data: rows, error } = await q;
  if (error) {
    console.error("backfill load error", error.code ?? "");
    return json({ error: "Failed to load recordings." }, 500);
  }

  const all = rows ?? [];
  const audioGone = all.filter(
    (r) => r.audio_deleted_at || r.raw_audio_purged_at,
  );
  const eligible = all.filter(
    (r) => !r.audio_deleted_at && !r.raw_audio_purged_at,
  );

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      eligible: eligible.length,
      audio_deleted: audioGone.length,
      ids: eligible.map((r) => r.id),
    });
  }

  // ── audio_deleted rows: can't re-transcribe → null AI PII + lock rejected ─
  for (const r of audioGone) {
    await admin
      .from("kpi_call_recordings")
      .update({
        ai_summary: null,
        ai_key_moments: null,
        objection_events: null,
        caller_existing_coverage: null,
        redaction_status: "rejected",
      })
      .eq("id", r.id);
    await admin
      .from("kpi_word_track_detections")
      .delete()
      .eq("recording_id", r.id);
  }

  // ── eligible rows: scrub AI PII + delete detections, then re-transcribe ───
  const fires: Promise<unknown>[] = [];
  for (const r of eligible) {
    // 1. Clear stale AI-derived PII + detections FIRST (so it can't survive).
    await admin
      .from("kpi_call_recordings")
      .update({
        ai_summary: null,
        ai_key_moments: null,
        objection_events: null,
        caller_existing_coverage: null,
        analysis_status: "pending",
        transcription_status: "pending",
      })
      .eq("id", r.id);
    await admin
      .from("kpi_word_track_detections")
      .delete()
      .eq("recording_id", r.id);

    // 2. Fire the privileged re-transcribe (service-role bearer = backfill path).
    fires.push(
      fetch(`${supabaseUrl}/functions/v1/transcribe-call-recording`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recording_id: r.id }),
      })
        .then((res) => {
          if (!res.ok) console.error("backfill transcribe non-ok", res.status);
        })
        .catch((e) =>
          console.error(
            "backfill transcribe dispatch failed",
            e instanceof Error ? e.message : "",
          ),
        ),
    );
  }

  // Keep the dispatched re-transcribes alive after we respond.
  const runtime = (
    globalThis as {
      EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
    }
  ).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(Promise.allSettled(fires));

  return json({
    ok: true,
    re_transcribing: eligible.length,
    audio_deleted_rejected: audioGone.length,
  });
});
