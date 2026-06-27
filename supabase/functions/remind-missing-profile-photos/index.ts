// remind-missing-profile-photos — daily cron job.
//
// Invoked by the pg_cron function invoke_profile_photo_reminders() via pg_net with the
// service-role key. Nudges agents who still have NO profile photo (in-app notification + email)
// so their photo is available for AOTW / "welcome new agent" graphics.
//
// SCOPE — "just my team": the roster query (get_agents_needing_photo_reminder) only returns agents
// whose IMO has a CONNECTED Instagram integration, so no other tenant is ever emailed. Cadence is
// weekly per agent (photo_reminder_last_sent_at), enforced by the SQL roster + mark fn — so a daily
// run only emails agents actually due. Returns { reminded }.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";

// The bearer's `role` claim. The gateway's verify_jwt already guarantees a valid PROJECT token
// reached us; we only need to confirm it's the service role (the cron) and not a logged-in user.
// Decoding the claim (rather than exact-matching the service key) stays correct even if the cron's
// app_config key and this function's env key diverge.
function bearerRole(auth: string): string | null {
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const payload = JSON.parse(atob(m[1].split(".")[1] ?? ""));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function reminderEmailHtml(firstName: string | null, link: string): string {
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2933;line-height:1.5;">
  <p>${hi}</p>
  <p>You don't have a profile photo yet. Adding one lets us feature you in your agency's
  Instagram posts — your "welcome to the team" graphic, the Agent of the Week spotlight, and more.</p>
  <p style="margin:24px 0;">
    <a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Upload your photo</a>
  </p>
  <p style="color:#6b7280;font-size:13px;">It takes about a minute — Settings &rarr; Profile &rarr; Profile Photo.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  <p style="color:#9aa5b1;font-size:12px;">You're receiving this because your agency account doesn't have a profile photo on file. Once you upload one, these reminders stop.</p>
  </body></html>`;
}

serve(async (req) => {
  // Service-job only — the cron calls with the service-role key. A logged-in user's JWT also clears
  // verify_jwt, so gate on the role claim being service_role.
  const auth = req.headers.get("Authorization") ?? "";
  if (bearerRole(auth) !== "service_role") {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createSupabaseAdminClient();

  const { data: agents, error } = await admin.rpc(
    "get_agents_needing_photo_reminder",
    { p_limit: 200 },
  );
  if (error) {
    console.error("[remind-missing-profile-photos] roster error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Absolute link for the email; the in-app notification uses a relative path.
  // The public app URL is configuration, NEVER a hardcoded domain — a wrong guess ships
  // dead 404 links in real email. Single source of truth: app_config.app_url, then the
  // SITE_URL env. If neither is set, SKIP the email (a missing reminder beats a broken one).
  const { data: cfg } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "app_url")
    .maybeSingle();
  const appUrl = String(cfg?.value ?? Deno.env.get("SITE_URL") ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (!appUrl) {
    console.error(
      "[remind-missing-profile-photos] no app_url configured (app_config.app_url or SITE_URL) — skipping to avoid emailing a broken link",
    );
    return new Response(
      JSON.stringify({ reminded: 0, skipped: "missing app_url" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  const emailLink = `${appUrl}/settings?tab=agents`;

  let reminded = 0;
  for (const a of (agents ?? []) as Array<{
    user_id: string;
    email: string;
    first_name: string | null;
  }>) {
    // in-app (best effort)
    const { error: nErr } = await admin.rpc("create_notification", {
      p_user_id: a.user_id,
      p_type: "profile_photo_reminder",
      p_title: "Add your profile photo",
      p_message:
        "Upload a profile photo so you can be featured in your agency's posts.",
      p_metadata: { link: "/settings?tab=agents" },
      p_expires_at: null,
    });
    if (nErr) console.error("[remind] notify failed", a.user_id, nErr);

    // email (best effort)
    const { error: eErr } = await admin.functions.invoke(
      "send-automated-email",
      {
        body: {
          to: a.email,
          subject: "Add your profile photo",
          html: reminderEmailHtml(a.first_name, emailLink),
          isMarketing: false,
        },
      },
    );
    if (eErr) console.error("[remind] email failed", a.user_id, eErr);

    // Stamp regardless of partial failure so we never daily-spam — a fully-failed agent just waits
    // for the next weekly window (logged above).
    await admin.rpc("mark_photo_reminder_sent", { p_user_id: a.user_id });
    reminded++;
  }

  return new Response(JSON.stringify({ reminded }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
