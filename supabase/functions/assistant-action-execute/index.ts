// assistant-action-execute — performs an approved external send (email/sms).
//
// This is the ONLY place an assistant-drafted message is actually sent, and it runs
// only after a human approved the action in the UI. It re-verifies (defense in depth)
// that the action row is `approved`, owned by the caller, and not expired, then does a
// race-safe transition to `executing` and calls the existing send-email / send-sms
// functions. Result is logged (redacted) and the row is set executed|failed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseClient,
  createSupabaseAdminClient,
} from "../_shared/supabase-client.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import {
  actionDailyCap,
  actionRateKey,
  ACTION_RATE_WINDOW_SECONDS,
  distinctRecipientDailyCap,
  imoDailySendCeiling,
} from "../assistant-orchestrator/core/action-limits.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { canExecute } from "../assistant-orchestrator/core/state-machine.ts";
import { canAccessAssistant } from "../assistant-orchestrator/core/access.ts";
import { redact } from "../assistant-orchestrator/core/redaction.ts";
import type { ActionStatus } from "../assistant-orchestrator/core/types.ts";
import { getUserCloseKey } from "../_shared/close/key.ts";
import { closePost, isCloseApiError } from "../_shared/close/client.ts";

// Domain-valid sender; replies route to the acting user.
const SYSTEM_FROM = "The Standard HQ <noreply@updates.thestandardhq.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bodyToHtml(body: string): string {
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">${escapeHtml(
    body,
  ).replace(/\n/g, "<br>")}</div>`;
}

// Stable, non-reversible recipient fingerprint for the audit ledger — the ledger
// must never store the raw phone/email. Normalized first (last-10 digits for phone,
// lower(trim) for email) so the same person always hashes the same regardless of
// formatting. Mirrors assistant_recipient_is_allowed / assistant_send_caps.
async function hashRecipient(
  channel: string,
  recipient: string,
): Promise<string | null> {
  let normalized: string;
  if (channel === "sms") {
    normalized = recipient.replace(/\D/g, "").slice(-10);
    if (normalized.length < 10) return null;
  } else {
    normalized = recipient.trim().toLowerCase();
    if (!normalized) return null;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader)
      return json({ error: "Missing Authorization header" }, 401);

    const db = createSupabaseClient(authHeader);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Command center is limited to Epic Life (super-admins bypass). Enforced here
    // too — this endpoint is HTTP-callable independent of the UI. Mirrors the
    // orchestrator + frontend RouteGuard gate.
    const { data: gateProfile } = await db
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();
    if (
      !canAccessAssistant({
        email: user.email,
        isSuperAdmin: gateProfile?.is_super_admin === true,
      })
    ) {
      return json(
        { error: "The command center isn't available for your account." },
        403,
      );
    }

    const body = await req.json().catch(() => ({}));
    const actionRequestId =
      typeof body.actionRequestId === "string" ? body.actionRequestId : "";
    if (!actionRequestId)
      return json({ error: "actionRequestId is required" }, 400);

    // Load (RLS already scopes to the owner; we re-check below for defense in depth).
    const { data: row, error: rowErr } = await db
      .from("assistant_action_requests")
      .select("*")
      .eq("id", actionRequestId)
      .maybeSingle();
    if (rowErr || !row) return json({ error: "Action request not found" }, 404);
    if (row.user_id !== user.id) return json({ error: "Forbidden" }, 403);

    if (!canExecute(row.status as ActionStatus, row.expires_at)) {
      return json(
        { error: "Action is not approved or has expired", status: row.status },
        409,
      );
    }

    // Normalize identity for the audit ledger + the cap checks. recipient is empty
    // for the Close branch (those rows carry a leadId in draft_payload, no recipient).
    const channel = String(row.channel);
    const recipient =
      typeof row.recipient === "string" ? row.recipient.trim() : "";
    const recipientHash = recipient
      ? await hashRecipient(channel, recipient)
      : null;

    // Append-only audit of the SEND DECISION — the actual send is the most
    // security-critical event in the system and was previously unlogged (the
    // orchestrator only audits the DRAFT/tool-dispatch). Written via the USER-scoped
    // `db` client: log_assistant_audit is SECURITY DEFINER and stamps actor :=
    // auth.uid() + imo := get_my_imo_id() server-side, so it MUST NOT use the admin
    // client (that would null auth.uid() and misattribute the row). Best-effort — an
    // audit-write failure must never change the send outcome. Vocabulary mirrors the
    // master-plan spec: surface ∈ text|voice|desktop|system (the executor is a
    // backend, non-UI actor => "system"); decision ∈ success|denied|error.
    const audit = async (
      event: string,
      decision: string,
      reason: string | null,
      result?: unknown,
    ) => {
      try {
        await db.rpc("log_assistant_audit", {
          p_surface: "system",
          p_event: event,
          p_tool_name: row.tool_name,
          p_action_class: "outbound",
          p_decision: decision,
          p_decision_reason: reason,
          p_action_request_id: actionRequestId,
          p_params_redacted: { channel },
          p_result_redacted: result ? redact(result) : null,
          p_recipient_hash: recipientHash,
        });
      } catch (e) {
        // Best-effort: never break execution on an audit-write failure — but DO log it,
        // so the gap this change set out to close (an un-audited REAL send) is observable
        // instead of silent.
        console.error(
          "assistant-action-execute: log_assistant_audit failed",
          e instanceof Error ? e.message : String(e),
        );
      }
    };

    // Pre-send policy gates for external channels (sms/email). ALL read-only and run
    // BEFORE the claim, so a rejection leaves the row `approved` (retryable) and never
    // burns the incrementing per-call counter below. ORDER MATTERS: the recipient
    // allowlist is the strongest signal (a non-contact is NEVER allowed), so it runs
    // first — otherwise a non-contact send while at a cap would return a misleading
    // "try tomorrow" cap message and audit the wrong reason. Checking pre-claim is safe:
    // the content-freeze trigger makes recipient immutable once the row is approved, so
    // this is exactly the recipient that will be sent. (Close note/task carry no
    // recipient and use the per-user-key boundary instead, so they skip this block.)
    if (channel === "sms" || channel === "email") {
      if (!recipient) {
        await audit("action_blocked", "denied", "no_recipient");
        return json(
          {
            error: "No recipient was provided for this action.",
            status: row.status,
          },
          400,
        );
      }

      // M2 recipient authorization: only send to a client, recruiting lead, or team
      // member. assistant_recipient_is_allowed is SECURITY INVOKER, so RLS defines the
      // allowed set (mirrors the read tools' scope).
      const { data: allowed, error: authErr } = await db.rpc(
        "assistant_recipient_is_allowed",
        { p_channel: channel, p_recipient: recipient },
      );
      if (authErr) {
        await audit("action_failed", "error", "recipient_check_error");
        return json({ error: "Could not verify the recipient." }, 502);
      }
      if (allowed !== true) {
        await audit("action_blocked", "denied", "recipient_not_allowed");
        return json(
          {
            error:
              "The recipient isn't one of your contacts, leads, or team members, so the assistant won't send to them.",
            status: row.status,
          },
          403,
        );
      }

      // COUNT-based caps (committed-send based). Uses the USER-scoped `db` client:
      // assistant_send_caps is SECURITY DEFINER and resolves auth.uid()/get_my_imo_id()
      // server-side.
      const { data: capsData, error: capsErr } = await db
        .rpc("assistant_send_caps", {
          p_channel: channel,
          p_recipient: recipient,
        })
        .maybeSingle();
      // Cast: assistant_send_caps is newer than the committed generated types, so
      // PostgREST returns it untyped here.
      const caps = capsData as {
        distinct_recipients_24h?: number | null;
        recipient_already_24h?: boolean | null;
        imo_sends_24h?: number | null;
      } | null;
      if (capsErr || !caps) {
        // Fail-open on a limiter fault (consistent with check_rate_limit), but write a
        // ledger row so the window in which BOTH COUNT caps were inert is reconstructable
        // — otherwise a cap-RPC outage silently disables the whole new defense layer.
        console.error(
          "assistant-action-execute: assistant_send_caps unavailable",
          capsErr?.message ?? "no row returned",
        );
        await audit("cap_check_error", "error", "caps_unavailable");
      } else {
        const distinctCap = distinctRecipientDailyCap(channel);
        const distinctUsed = Number(caps.distinct_recipients_24h ?? 0);
        const recipientAlready = caps.recipient_already_24h === true;
        const imoUsed = Number(caps.imo_sends_24h ?? 0);
        const imoCeiling = imoDailySendCeiling();

        // Distinct-recipient cap: a repeat to someone already messaged today is fine
        // (adds no NEW distinct recipient); only a NEW recipient beyond the cap blocks.
        if (
          distinctCap !== null &&
          !recipientAlready &&
          distinctUsed >= distinctCap
        ) {
          await audit("action_blocked", "denied", "distinct_recipient_cap");
          return json(
            {
              error: `Daily distinct-recipient limit reached for ${channel} (${distinctCap}/day). Try again tomorrow.`,
              status: row.status,
            },
            429,
          );
        }
        // IMO-wide ceiling. NOTE: when get_my_imo_id() is NULL (a tenantless caller —
        // e.g. a super-admin with no imo_id), assistant_send_caps returns imo_sends_24h=0
        // so this never trips. Intentional: there is no tenant to aggregate, and such a
        // caller is still bounded by the per-user distinct cap + the per-call counter.
        if (imoUsed >= imoCeiling) {
          await audit("action_blocked", "denied", "imo_send_ceiling");
          return json(
            {
              error: `Your organization reached its daily assistant-send ceiling (${imoCeiling}/day). Try again later.`,
              status: row.status,
            },
            429,
          );
        }
      }
    }

    // Per-action-class daily send cap (defense-in-depth — sends run out-of-band of the
    // orchestrator's buckets). Checked BEFORE the claim so a capped send stays `approved`
    // and is retryable once the 24h window resets. The limiter RPC is service_role-only,
    // so use the admin client. Runs AFTER the read-only COUNT caps above: this counter
    // increments on every call, so it must be the LAST pre-claim gate.
    const dailyCap = actionDailyCap(channel);
    if (dailyCap !== null) {
      const rl = await checkRateLimit(createSupabaseAdminClient(), {
        key: actionRateKey(channel, user.id),
        maxRequests: dailyCap,
        windowSeconds: ACTION_RATE_WINDOW_SECONDS,
      });
      if (!rl.allowed) {
        await audit("action_blocked", "denied", "daily_cap");
        return json(
          {
            error: `Daily ${channel} send limit reached (${dailyCap}/day). Try again later.`,
            retry_after_seconds: rl.retryAfterSeconds,
            status: row.status,
          },
          429,
        );
      }
    }

    // Race-safe transition approved -> executing (conditional on still being
    // approved AND never executed). The executed_at guard makes execution
    // idempotent: even if a row's status were reset to approved, a row that has
    // already sent (executed_at set) can never be claimed again.
    const { data: claimed } = await db
      .from("assistant_action_requests")
      .update({ status: "executing" })
      .eq("id", actionRequestId)
      .eq("status", "approved")
      .is("executed_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) {
      return json({ error: "Action is already being processed" }, 409);
    }

    const payload = (row.draft_payload ?? {}) as Record<string, unknown>;

    const fail = async (
      message: string,
      opts?: { result?: unknown; reason?: string; blocked?: boolean },
    ) => {
      await db
        .from("assistant_action_requests")
        .update({
          status: "failed",
          error: message,
          result_redacted: opts?.result ? redact(opts.result) : null,
        })
        .eq("id", actionRequestId);
      // A "blocked" fail (e.g. suppressed/STOP) is a policy denial, not a transport
      // error — record it as such so the ledger distinguishes them.
      await audit(
        opts?.blocked ? "action_blocked" : "action_failed",
        opts?.blocked ? "denied" : "error",
        opts?.reason ?? null,
        opts?.result,
      );
      return json({ ok: false, status: "failed", error: message }, 200);
    };

    // ── Close write actions (note/task) ────────────────────────────────────
    // These act with the caller's OWN Close key against a lead in their OWN Close
    // org, so the email/phone recipient + allowed-set check does NOT apply (the
    // boundary is the per-user key, and the human approved this exact lead+text,
    // which the content-freeze trigger has made immutable since approval). Close rows
    // carry no recipient, so they are never gated by the sms/email pre-claim block above.
    if (row.channel === "close_note" || row.channel === "close_task") {
      const leadId =
        typeof payload.leadId === "string" ? payload.leadId.trim() : "";
      const text = typeof payload.body === "string" ? payload.body.trim() : "";
      if (!leadId) return await fail("The Close draft had no lead id.");
      if (!text) return await fail("The Close draft had no text.");

      // Fetch the key for the JWT-verified caller only (never a payload field).
      const apiKey = await getUserCloseKey(user.id);
      if (!apiKey) return await fail("Close isn't connected for your account.");

      try {
        let created: { id?: string };
        if (row.channel === "close_note") {
          created = await closePost<{ id?: string }>(
            apiKey,
            "/activity/note/",
            {
              lead_id: leadId,
              note: text,
            },
          );
        } else {
          const taskBody: Record<string, unknown> = {
            _type: "lead",
            lead_id: leadId,
            text,
          };
          const dueDate =
            typeof payload.dueDate === "string" ? payload.dueDate.trim() : "";
          if (dueDate) taskBody.date = dueDate;
          created = await closePost<{ id?: string }>(
            apiKey,
            "/task/",
            taskBody,
          );
        }

        await db
          .from("assistant_action_requests")
          .update({
            status: "executed",
            executed_at: new Date().toISOString(),
            // Only the Close object id — never the note/task text (may carry PII).
            result_redacted: { closeId: created?.id ?? null },
          })
          .eq("id", actionRequestId);

        await audit("action_executed", "success", null, {
          closeId: created?.id ?? null,
        });
        return json({
          ok: true,
          status: "executed",
          channel: row.channel,
          closeId: created?.id ?? null,
        });
      } catch (e) {
        if (isCloseApiError(e)) {
          if (e.code === "CLOSE_AUTH_ERROR")
            return await fail("Your Close API key is invalid or expired.");
          if (e.status === 404)
            return await fail("That Close lead no longer exists.");
        }
        return await fail("Close rejected the write.");
      }
    }

    // (recipient presence + M2 allowlist were verified PRE-CLAIM above for sms/email;
    // content-freeze keeps `recipient` immutable from approval onward, so the pre-claim
    // check is exactly the recipient sent here. Close rows never reach this point.)

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const callFn = async (fn: string, fnBody: Record<string, unknown>) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fnBody),
      });
      const data = await res.json().catch(() => ({}));
      return { okHttp: res.ok, data };
    };

    let sent: {
      okHttp: boolean;
      data: { success?: boolean; error?: string; suppressed?: boolean };
    };

    if (row.channel === "sms") {
      const text = typeof payload.body === "string" ? payload.body : "";
      if (!text) return await fail("SMS draft had no body.");
      sent = await callFn("send-sms", {
        to: recipient,
        message: text,
        trigger: "assistant",
      });
    } else if (row.channel === "email") {
      const subject =
        typeof payload.subject === "string" ? payload.subject : "";
      const text = typeof payload.body === "string" ? payload.body : "";
      if (!subject || !text)
        return await fail("Email draft was missing subject or body.");
      sent = await callFn("send-email", {
        to: [recipient],
        subject,
        html: bodyToHtml(text),
        text,
        from: SYSTEM_FROM,
        replyTo: user.email ?? undefined,
      });
    } else {
      return await fail(`Unsupported channel: ${row.channel}`);
    }

    if (!sent.okHttp || sent.data?.success !== true) {
      // send-sms returns 200 + {success:false, suppressed:true} for a STOP/opt-out
      // recipient — a policy block, NOT a transport failure. Distinguish it so the
      // row is never mislabeled "executed" (the process-bulk-campaign skipped:true
      // swallow bug) AND the audit ledger records the opt-out as a denial.
      const suppressed = sent.data?.suppressed === true;
      return await fail(sent.data?.error ?? "The send failed.", {
        result: sent.data,
        blocked: suppressed,
        reason: suppressed ? "suppressed" : "send_failed",
      });
    }

    await db
      .from("assistant_action_requests")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
        result_redacted: redact(sent.data),
      })
      .eq("id", actionRequestId);

    await audit("action_executed", "success", null, sent.data);
    return json({ ok: true, status: "executed", channel: row.channel });
  } catch (e) {
    console.error("assistant-action-execute error", e);
    return json({ error: "Failed to execute action." }, 500);
  }
});
