// supabase/functions/generate-user-export-bundle/index.ts
// ============================================================================
// Build a user's full data-export bundle (xlsx + csv.zip + json manifest).
// ============================================================================
// Driven by the owned-tables registry (EXPORTED_TABLES) — the same registry the
// wipe uses, so `export ⊆ wipe` holds. Reads ALWAYS go through the service-role
// admin client: a revoked user's own JWT is denied at the RLS gate, so even a
// self-service call must read their rows with service-role.
//
// Callers (mirrors send-email's dual-caller auth):
//   - service_role  : the lifecycle cron drain (any userId; may pass exportLogId)
//   - authenticated : the sunset page (self only — userId is forced to caller.id)
//
// Output -> Storage `account-recovery-archives/snapshots/{userId}/` (Migration F).
// Returns short-lived signed URLs so the (RLS-denied) user can download directly.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";
import { EXPORTED_TABLES } from "../_shared/owned-tables.ts";
import {
  RECOVERY_BUCKET,
  SNAPSHOT_PREFIX,
} from "../_shared/sunset-constants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateBody {
  userId: string;
  exportLogId?: string; // cron passes the pending row id to update
  // Sunset page sets this: if the most-recent bundle is already `ready` (cron
  // pre-built it), return fresh signed URLs for it instead of rebuilding 30
  // table reads + xlsx serialization (the part most at risk of the ~150s limit
  // for a heavy user). The cron drain never sets it — it wants a fresh build.
  skipIfReady?: boolean;
}

const SNAPSHOT_FILES = [
  { name: "account-export.xlsx" },
  { name: "account-export-csv.zip" },
  { name: "manifest.json" },
];

// Build 1-hour signed URLs for the three bundle files at snapshots/{user}/.
async function signBundle(
  // deno-lint-ignore no-explicit-any
  admin: any,
  base: string,
): Promise<Record<string, string | null>> {
  const signed: Record<string, string | null> = {};
  for (const f of SNAPSHOT_FILES) {
    const { data } = await admin.storage
      .from(RECOVERY_BUCKET)
      .createSignedUrl(`${base}/${f.name}`, 60 * 60);
    signed[f.name] = data?.signedUrl ?? null;
  }
  return signed;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Excel sheet names: <=31 chars, none of []:*?/\
function safeSheetName(label: string, used: Set<string>): string {
  let name = (label || "Sheet")
    .replace(/[[\]:*?/\\]/g, " ")
    .slice(0, 31)
    .trim();
  if (!name) name = "Sheet";
  let candidate = name;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${i++}`;
    candidate = name.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// Cell-safe value: stringify objects/arrays (jsonb columns), blank for null.
function cell(v: unknown): string | number | boolean {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}

// rows[] -> array-of-arrays with a header row = union of keys across all rows.
function rowsToAoa(
  rows: Record<string, unknown>[],
): (string | number | boolean)[][] {
  if (!rows || rows.length === 0) return [["(no records)"]];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  const aoa: (string | number | boolean)[][] = [keys];
  for (const r of rows) aoa.push(keys.map((k) => cell(r[k])));
  return aoa;
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

  // ── Auth: service_role (any user) OR authenticated user (self only) ──────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);

  let callerId: string | null = null; // null => trusted service-role
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    callerId = userData.user.id;
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Self-JWT callers can only export their own data; service-role trusts body.
  const targetUserId = callerId ?? body.userId;
  if (!targetUserId) return json({ error: "userId required" }, 400);
  if (callerId && body.userId && body.userId !== callerId) {
    return json({ error: "Forbidden: can only export your own data" }, 403);
  }

  // ── Resolve the data_export_log row to update (or create one) ────────────
  let logId = body.exportLogId ?? null;
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email, first_name, last_name, imo_id")
    .eq("id", targetUserId)
    .maybeSingle();

  // user_profiles has no `full_name` column (computed from first/last in the
  // app); selecting it 400s and nulls the whole profile lookup.
  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;

  if (!logId) {
    const { data: existing } = await admin
      .from("data_export_log")
      .select("id, status, bundle_storage_path")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      logId = existing.id;
      // Fast path: cron already built this bundle — just re-sign it.
      if (
        body.skipIfReady &&
        existing.status === "ready" &&
        existing.bundle_storage_path
      ) {
        return json({
          status: "ready",
          userId: targetUserId,
          exportLogId: existing.id,
          storagePath: existing.bundle_storage_path,
          signedUrls: await signBundle(admin, existing.bundle_storage_path),
          reused: true,
        });
      }
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("data_export_log")
        .insert({
          user_id: targetUserId,
          email: profile?.email ?? null,
          full_name: fullName,
          imo_id: profile?.imo_id ?? null,
          status: "generating",
          trigger: callerId ? "self_service" : "activation_prescan",
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        return json(
          { error: `Could not create export log: ${insErr?.message}` },
          500,
        );
      }
      logId = inserted.id;
    }
  }

  if (logId) {
    await admin
      .from("data_export_log")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", logId);
  }

  try {
    // ── Pull every exported table for this user (service-role bypasses RLS) ─
    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    const csvFiles: Record<string, Uint8Array> = {};
    const counts: Record<string, number> = {};

    for (const t of EXPORTED_TABLES) {
      const { data: rows, error } = await admin
        .from(t.table)
        .select("*")
        .eq(t.ownerColumn, targetUserId);
      if (error) {
        // A missing/renamed table shouldn't sink the whole bundle; log + skip.
        console.error(`[export] ${t.table} read failed: ${error.message}`);
        counts[t.table] = -1;
        continue;
      }
      const list = (rows ?? []) as Record<string, unknown>[];
      counts[t.table] = list.length;

      const aoa = rowsToAoa(list);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        safeSheetName(t.sheet ?? t.table, usedNames),
      );
      if (list.length > 0) {
        csvFiles[`${t.table}.csv`] = strToU8(XLSX.utils.sheet_to_csv(ws));
      }
    }

    const generatedAt = new Date().toISOString();
    const manifest = {
      userId: targetUserId,
      email: profile?.email ?? null,
      fullName: fullName,
      imoId: profile?.imo_id ?? null,
      generatedAt,
      tables: counts,
      note: "Complete export of your account data. Tables with no records are included as empty sheets.",
    };
    const manifestBytes = strToU8(JSON.stringify(manifest, null, 2));
    csvFiles["manifest.json"] = manifestBytes;

    const xlsxBytes = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    }) as Uint8Array;
    const zipBytes = zipSync(csvFiles);

    // ── Upload to snapshots/{userId}/ (stable names; re-runs overwrite) ─────
    const base = `${SNAPSHOT_PREFIX}/${targetUserId}`;
    const uploads: { path: string; data: Uint8Array; contentType: string }[] = [
      {
        path: `${base}/account-export.xlsx`,
        data: xlsxBytes,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      {
        path: `${base}/account-export-csv.zip`,
        data: zipBytes,
        contentType: "application/zip",
      },
      {
        path: `${base}/manifest.json`,
        data: manifestBytes,
        contentType: "application/json",
      },
    ];

    for (const u of uploads) {
      const { error: upErr } = await admin.storage
        .from(RECOVERY_BUCKET)
        // Copy into a fresh ArrayBuffer-backed array so the Blob part type is
        // ArrayBuffer (not the SharedArrayBuffer-or-ArrayBuffer union XLSX.write
        // / fflate return) — see deno check TS2322.
        .upload(
          u.path,
          new Blob([new Uint8Array(u.data)], { type: u.contentType }),
          {
            upsert: true,
            contentType: u.contentType,
          },
        );
      if (upErr) throw new Error(`upload ${u.path} failed: ${upErr.message}`);
    }

    const totalBytes =
      xlsxBytes.byteLength + zipBytes.byteLength + manifestBytes.byteLength;

    // Short-lived signed URLs so the RLS-denied user can download directly.
    const signed = await signBundle(admin, base);

    if (logId) {
      await admin
        .from("data_export_log")
        .update({
          status: "ready",
          format: "xlsx,csv,json",
          bundle_storage_path: base,
          bundle_bytes: totalBytes,
          generated_at: generatedAt,
          error: null,
          updated_at: generatedAt,
        })
        .eq("id", logId);
    }

    console.log(
      `[generate-user-export-bundle] ready user=${targetUserId} bytes=${totalBytes} logId=${logId}`,
    );

    return json({
      status: "ready",
      userId: targetUserId,
      exportLogId: logId,
      bytes: totalBytes,
      storagePath: base,
      signedUrls: signed,
      tables: counts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-user-export-bundle] failed:", message);
    if (logId) {
      await admin
        .from("data_export_log")
        .update({
          status: "failed",
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    return json({ status: "failed", error: message }, 500);
  }
});
