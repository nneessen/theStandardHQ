// assistant-action-execute — performs an approved external send (email/sms).
//
// This is the ONLY place an assistant-drafted message is actually sent, and it runs
// only after a human approved the action in the UI. It re-verifies (defense in depth)
// that the action row is `approved`, owned by the caller, and not expired, then does a
// race-safe transition to `executing` and calls the existing send-email / send-sms
// functions. Result is logged (redacted) and the row is set executed|failed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { canExecute } from "../assistant-orchestrator/core/state-machine.ts";
import { canAccessAssistant } from "../assistant-orchestrator/core/access.ts";
import { redact } from "../assistant-orchestrator/core/redaction.ts";
import type { ActionStatus } from "../assistant-orchestrator/core/types.ts";

// Domain-valid sender; replies route to the acting user.
const SYSTEM_FROM = "The Standard HQ <noreply@thestandardhq.com>";

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
    const recipient =
      typeof row.recipient === "string" ? row.recipient.trim() : "";

    const fail = async (message: string, result?: unknown) => {
      await db
        .from("assistant_action_requests")
        .update({
          status: "failed",
          error: message,
          result_redacted: result ? redact(result) : null,
        })
        .eq("id", actionRequestId);
      return json({ ok: false, status: "failed", error: message }, 200);
    };

    if (!recipient)
      return await fail("No recipient was provided for this action.");

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

    let sent: { okHttp: boolean; data: { success?: boolean; error?: string } };

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
      return await fail(sent.data?.error ?? "The send failed.", sent.data);
    }

    await db
      .from("assistant_action_requests")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
        result_redacted: redact(sent.data),
      })
      .eq("id", actionRequestId);

    return json({ ok: true, status: "executed", channel: row.channel });
  } catch (e) {
    console.error("assistant-action-execute error", e);
    return json({ error: "Failed to execute action." }, 500);
  }
});
