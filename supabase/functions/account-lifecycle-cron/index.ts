// supabase/functions/account-lifecycle-cron/index.ts
// ============================================================================
// Daily lifecycle sweep for the platform-sunset flow (service-role only).
// Invoked by pg_cron via pg_net (Migration G). Four bounded, best-effort tasks:
//   1. Drain pending export bundles  -> invoke generate-user-export-bundle.
//   2. Day-3 / Day-6 reminder emails -> invoke send-email (neutral copy).
//   3. Day-7 auto-purge stragglers   -> invoke confirm-and-wipe-account.
//   4. 30-day recovery-archive GC    -> delete recovery/{user}/ objects.
//
// Every task is independent and failure-isolated: one task's error is logged
// and the sweep continues, so a single bad row never blocks the rest.
//
// NO STRIPE. Emails carry zero "Epic Life" / "platform continues" wording.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  RECOVERY_BUCKET,
  AUTO_PURGE_AFTER_DAYS,
} from "../_shared/sunset-constants.ts";
import { listAllPaths, removeAll } from "../_shared/storage-recursive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DRAIN_LIMIT = 25; // export bundles per tick
const PURGE_LIMIT = 25; // auto-purges per tick
const BATCH = 5; // concurrency within a task
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = new Set([3, 6]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function inBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

// Neutral, opaque transactional copy — no mention of other tenants, no hint the
// platform continues for anyone else. Framed purely as "your account is closing".
function reminderEmail(deadline: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Action needed: export your data before your account closes";
  const text =
    `We're winding down access to your account.\n\n` +
    `Please sign in and download a copy of your data before ${deadline}. ` +
    `After that date, your account and all of its data will be permanently removed and cannot be recovered.\n\n` +
    `To export and close your account, sign in and follow the on-screen instructions.`;
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5">` +
    `<p>We're winding down access to your account.</p>` +
    `<p>Please sign in and download a copy of your data before <strong>${deadline}</strong>. ` +
    `After that date, your account and all of its data will be permanently removed and cannot be recovered.</p>` +
    `<p>To export and close your account, sign in and follow the on-screen instructions.</p>` +
    `</div>`;
  return { subject, html, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");

  // Service-role only.
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.slice(7) !== SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const summary = {
    exportsDrained: 0,
    remindersSent: 0,
    autoPurged: 0,
    recoveryArchivesGced: 0,
    errors: [] as string[],
  };

  const nowIso = new Date().toISOString();

  // ── Shared: which IMOs are revoked, and since when ───────────────────────
  const { data: revokedImos } = await admin
    .from("imos")
    .select("id, access_revoked_at")
    .not("access_revoked_at", "is", null)
    .lte("access_revoked_at", nowIso);
  const revokedAtById = new Map<string, string>(
    (revokedImos ?? []).map((i) => [i.id, i.access_revoked_at as string]),
  );
  const revokedImoIds = [...revokedAtById.keys()];

  // ── Task 1: drain pending export bundles ─────────────────────────────────
  try {
    const { data: pending } = await admin
      .from("data_export_log")
      .select("id, user_id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(DRAIN_LIMIT);
    await inBatches(pending ?? [], BATCH, async (row) => {
      const { error } = await admin.functions.invoke(
        "generate-user-export-bundle",
        {
          body: { userId: row.user_id, exportLogId: row.id },
        },
      );
      if (error) {
        summary.errors.push(`export ${row.user_id}: ${error.message}`);
      } else {
        summary.exportsDrained++;
      }
    });
  } catch (e) {
    summary.errors.push(
      `drain task: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // ── Revoked, still-existing, non-super-admin users (for tasks 2 & 3) ─────
  let revokedUsers: { id: string; email: string | null; imo_id: string }[] = [];
  if (revokedImoIds.length > 0) {
    const { data } = await admin
      .from("user_profiles")
      .select("id, email, imo_id")
      .in("imo_id", revokedImoIds)
      .or("is_super_admin.is.null,is_super_admin.eq.false");
    revokedUsers = (data ?? []) as typeof revokedUsers;
  }

  // ── Task 2: day-3 / day-6 reminder emails ────────────────────────────────
  try {
    const dueReminders = revokedUsers.filter((u) => {
      if (!u.email) return false;
      const revokedAt = revokedAtById.get(u.imo_id);
      return revokedAt ? REMINDER_DAYS.has(daysSince(revokedAt)) : false;
    });
    await inBatches(dueReminders, BATCH, async (u) => {
      const revokedAt = revokedAtById.get(u.imo_id)!;
      const deadline = new Date(
        new Date(revokedAt).getTime() + AUTO_PURGE_AFTER_DAYS * DAY_MS,
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const { subject, html, text } = reminderEmail(deadline);
      const { error } = await admin.functions.invoke("send-email", {
        body: {
          to: [u.email],
          subject,
          html,
          text,
          from: `The Standard HQ <noreply@${MAILGUN_DOMAIN ?? "thestandardhq.com"}>`,
        },
      });
      if (error) {
        summary.errors.push(`reminder ${u.id}: ${error.message}`);
      } else {
        summary.remindersSent++;
      }
    });
  } catch (e) {
    summary.errors.push(
      `reminder task: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // ── Task 3: day-7 auto-purge stragglers ──────────────────────────────────
  try {
    const stragglers = revokedUsers
      .filter((u) => {
        const revokedAt = revokedAtById.get(u.imo_id);
        return revokedAt
          ? daysSince(revokedAt) >= AUTO_PURGE_AFTER_DAYS
          : false;
      })
      .slice(0, PURGE_LIMIT);
    await inBatches(stragglers, BATCH, async (u) => {
      const { error } = await admin.functions.invoke(
        "confirm-and-wipe-account",
        {
          body: { userId: u.id, reason: "auto_purge_7d" },
        },
      );
      if (error) {
        summary.errors.push(`purge ${u.id}: ${error.message}`);
      } else {
        summary.autoPurged++;
      }
    });
  } catch (e) {
    summary.errors.push(
      `purge task: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // ── Task 4: 30-day recovery-archive GC ───────────────────────────────────
  try {
    const { data: expired } = await admin
      .from("account_deletion_log")
      .select("id, recovery_archive_path")
      .not("recovery_archive_path", "is", null)
      .lt("recovery_expires_at", nowIso)
      .limit(PURGE_LIMIT);
    await inBatches(expired ?? [], BATCH, async (row) => {
      const paths = await listAllPaths(
        admin,
        RECOVERY_BUCKET,
        row.recovery_archive_path,
      );
      await removeAll(admin, RECOVERY_BUCKET, paths);
      await admin
        .from("account_deletion_log")
        .update({ recovery_archive_path: null })
        .eq("id", row.id);
      summary.recoveryArchivesGced++;
    });
  } catch (e) {
    summary.errors.push(
      `recovery GC task: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  console.log("[account-lifecycle-cron] summary:", JSON.stringify(summary));
  // L1: surface a sweep where any task errored as a non-2xx so a fully- (or
  // partly-) failing run is visible in cron.job_run_details instead of a silent
  // green 200. Tasks are still failure-isolated above; this only affects the
  // reported status, not the work done.
  const degraded = summary.errors.length > 0;
  return json(
    { status: degraded ? "degraded" : "ok", ...summary },
    degraded ? 500 : 200,
  );
});
