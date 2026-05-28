// supabase/functions/confirm-and-wipe-account/index.ts
// ============================================================================
// RED BUTTON — Switch B (IRREVERSIBLE): permanent per-user account wipe.
// ============================================================================
// Wraps the registry-driven wipe_user_business_data() RPC with the storage /
// auth.users / audit-log side effects the RPC intentionally does NOT touch:
//   1. Copy the frozen export snapshot -> recovery/{user}/ (30-day archive).
//   2. Purge the user's objects from the private buckets.
//   3. rpc('wipe_user_business_data', { p_user_id, p_reassign_to_user_id }).
//   4. auth.admin.deleteUser(user).
//   5. INSERT/UPDATE account_deletion_log (survives the wipe — FK-less).
//
// Callers:
//   - authenticated user : self only ("my data is correct -> delete"), self_confirmed
//   - authenticated super-admin : may wipe a specified userId
//   - service_role : the day-7 auto-purge sweep (auto_purge_7d)
//
// IDEMPOTENT across partial failures: if the profile is already gone we skip the
// wipe RPC but still retry auth.deleteUser and UPDATE (never re-INSERT) the log.
//
// NO STRIPE. Subscription cancellation/refunds are manual (owner, Stripe
// dashboard). The wipe RPC also refuses to touch a super-admin or a non-revoked
// IMO — so this can never wipe the owner or a live (Epic Life) user by mistake.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  PRIVATE_USER_BUCKETS,
  RECOVERY_BUCKET,
  SNAPSHOT_PREFIX,
  RECOVERY_PREFIX,
  RECOVERY_TTL_DAYS,
} from "../_shared/sunset-constants.ts";
import { listAllPaths, removeAll } from "../_shared/storage-recursive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DeletionReason = "self_confirmed" | "auto_purge_7d";

interface WipeBody {
  userId?: string;
  reason?: DeletionReason;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Auth: service_role | super-admin (any user) | user (self only) ───────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return json({ error: "Unauthorized" }, 401);
  const token = authHeader.slice(7);

  let body: WipeBody;
  try {
    body = await req.json().catch(() => ({}) as WipeBody);
  } catch {
    body = {};
  }

  const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
  let targetUserId: string;
  let reason: DeletionReason;

  if (isServiceRole) {
    if (!body.userId) return json({ error: "userId required" }, 400);
    targetUserId = body.userId;
    reason =
      body.reason === "self_confirmed" ? "self_confirmed" : "auto_purge_7d";
  } else {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const { data: callerProfile } = await admin
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", callerId)
      .maybeSingle();

    if (callerProfile?.is_super_admin && body.userId) {
      targetUserId = body.userId; // super-admin may wipe a named user
    } else {
      targetUserId = callerId; // everyone else: self only
    }
    reason = "self_confirmed";
  }

  try {
    // ── Profile + prior-deletion-log lookups (idempotency basis) ───────────
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id, email, full_name, imo_id, is_super_admin")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profile?.is_super_admin) {
      return json({ error: "Refusing to wipe a super-admin" }, 403);
    }

    const { data: priorLog } = await admin
      .from("account_deletion_log")
      .select("id, auth_user_deleted, recovery_archive_path, manifest")
      .eq("user_id", targetUserId)
      .order("deleted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fully done already.
    if (priorLog?.auth_user_deleted === true) {
      return json({
        status: "noop",
        reason: "already_deleted",
        userId: targetUserId,
      });
    }

    // ── Resolve a distinct super-admin to inherit shared content ───────────
    const { data: reassign } = await admin
      .from("user_profiles")
      .select("id")
      .eq("is_super_admin", true)
      .neq("id", targetUserId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const reassignId = reassign?.id ?? null;

    // ── 1. Snapshot -> recovery archive (best-effort) ──────────────────────
    let recoveryPath: string | null = priorLog?.recovery_archive_path ?? null;
    let recoveryExpiresAt: string | null = null;
    if (!recoveryPath) {
      const snapPrefix = `${SNAPSHOT_PREFIX}/${targetUserId}`;
      const recPrefix = `${RECOVERY_PREFIX}/${targetUserId}`;
      const snapFiles = await listAllPaths(admin, RECOVERY_BUCKET, snapPrefix);
      if (snapFiles.length === 0) {
        // No staging snapshot to copy. Either nothing was ever exported, OR a
        // prior run already moved it to recovery/ but failed before writing the
        // audit row — leaving an orphan the day-30 GC can't see (it filters on
        // recovery_expires_at). Adopt an existing recovery folder so the path +
        // expiry get recorded and the GC can later reclaim it.
        const existing = await listAllPaths(admin, RECOVERY_BUCKET, recPrefix);
        if (existing.length > 0) {
          recoveryPath = recPrefix;
          recoveryExpiresAt = new Date(
            Date.now() + RECOVERY_TTL_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString();
        }
      } else {
        // All-or-nothing: a partial recovery archive is worse than none — we'd
        // set recoveryArchivePath and the user would believe a complete copy
        // exists.
        const copiedDests: string[] = [];
        let copyFailed = false;
        for (const src of snapFiles) {
          const dest = src.replace(snapPrefix, recPrefix);
          const { error: cpErr } = await admin.storage
            .from(RECOVERY_BUCKET)
            .copy(src, dest);
          if (cpErr) {
            console.error(
              `[confirm-and-wipe-account] recovery copy ${src} -> ${dest} failed: ${cpErr.message}`,
            );
            copyFailed = true;
            break;
          }
          copiedDests.push(dest);
        }
        if (!copyFailed) {
          // Every file copied: commit the archive, free the staging snapshot.
          recoveryPath = recPrefix;
          recoveryExpiresAt = new Date(
            Date.now() + RECOVERY_TTL_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString();
          await removeAll(admin, RECOVERY_BUCKET, snapFiles);
        } else if (copiedDests.length > 0) {
          // Partial copy: roll back the half-built recovery folder and KEEP the
          // snapshot intact (data-safe). recoveryPath stays null — we never claim
          // an archive we didn't fully create. The wipe itself still proceeds.
          console.error(
            `[confirm-and-wipe-account] partial recovery copy for ${targetUserId}; rolling back ${copiedDests.length} file(s), keeping snapshot`,
          );
          await removeAll(admin, RECOVERY_BUCKET, copiedDests);
        }
      }
    }

    // ── 2. Registry-driven business-data wipe (guarded; BEFORE storage purge)
    // The wipe RPC refuses a non-revoked IMO. Running it before the bucket purge
    // means that if the IMO was restored mid-flight (e.g. between the cron
    // batching stragglers and this per-user call), the RPC throws and we bail
    // with the user's storage still intact — instead of destroying their
    // documents and then leaving an unhealable half-wipe (files gone, DB rows +
    // login remaining, and the wipe can never re-run once access is restored).
    let manifest: unknown = priorLog?.manifest ?? { status: "noop" };
    if (profile) {
      if (!reassignId) {
        return json(
          {
            error:
              "No distinct super-admin available to inherit shared content",
          },
          500,
        );
      }
      const { data: wipeResult, error: wipeErr } = await admin.rpc(
        "wipe_user_business_data",
        { p_user_id: targetUserId, p_reassign_to_user_id: reassignId },
      );
      if (wipeErr)
        throw new Error(`wipe_user_business_data: ${wipeErr.message}`);
      manifest = wipeResult;
    }

    // ── 3. Purge the user's private-bucket objects (only AFTER the guarded
    // wipe above succeeded, or the profile was already gone from a prior run —
    // both mean the wipe is legitimate). Idempotent: re-running removes whatever
    // remains.
    for (const bucket of PRIVATE_USER_BUCKETS) {
      const paths = await listAllPaths(admin, bucket, targetUserId);
      await removeAll(admin, bucket, paths);
    }

    // ── 4. Delete the auth.users row (idempotent — "not found" = success) ──
    const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId);
    const authDeleted = !delErr || /not.?found/i.test(delErr.message ?? "");
    if (delErr && !authDeleted) {
      console.error(
        "[confirm-and-wipe-account] deleteUser failed:",
        delErr.message,
      );
    }

    // ── 5. Audit log (UPDATE existing row on retry; never re-INSERT) ───────
    const logRow = {
      user_id: targetUserId,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      imo_id: profile?.imo_id ?? null,
      deletion_reason: reason,
      auth_user_deleted: authDeleted,
      recovery_archive_path: recoveryPath,
      recovery_expires_at: recoveryExpiresAt,
      manifest,
    };
    if (priorLog?.id) {
      // Only write recovery_expires_at when this run actually created the
      // archive — otherwise a later successful copy would set the path but
      // leave the timestamp null, and the day-30 GC (which filters on
      // recovery_expires_at < now) would never reclaim those files.
      const updatePayload: Record<string, unknown> = {
        auth_user_deleted: authDeleted,
        manifest,
        recovery_archive_path: recoveryPath,
      };
      if (recoveryExpiresAt)
        updatePayload.recovery_expires_at = recoveryExpiresAt;
      await admin
        .from("account_deletion_log")
        .update(updatePayload)
        .eq("id", priorLog.id);
    } else {
      await admin.from("account_deletion_log").insert(logRow);
    }

    console.log(
      `[confirm-and-wipe-account] wiped user=${targetUserId} reason=${reason} authDeleted=${authDeleted} recovery=${recoveryPath ?? "none"}`,
    );

    return json({
      status: "wiped",
      userId: targetUserId,
      reason,
      authUserDeleted: authDeleted,
      recoveryArchivePath: recoveryPath,
      recoveryExpiresAt,
      manifest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[confirm-and-wipe-account] failed:", message);
    return json({ status: "failed", error: message }, 500);
  }
});
