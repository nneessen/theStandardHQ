// scripts/e2e-team-access.mjs
//
// End-to-end test for the account-setup + team-access edge functions against
// LOCAL Supabase. Creates throwaway users (upline / downline / outsider / newbie),
// exercises every function incl. the security-critical authorization, asserts, and
// cleans up. Requires `supabase functions serve` running.
//
// Usage: node scripts/e2e-team-access.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const fnUrl = (name) => `${URL}/functions/v1/${name}`;
const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const created = [];
async function mkUser(meta = {}) {
  const email = `e2e_${Math.random().toString(36).slice(2)}@example.com`;
  const password = "TestPass12345!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw new Error("create: " + error.message);
  created.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function signIn(email, password) {
  const c = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error("signin: " + error.message);
  return data.session.access_token;
}

async function callFn(name, token, body) {
  const headers = { "Content-Type": "application/json", apikey: ANON_KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(fnUrl(name), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { status: r.status, body: json };
}

const out = {};
try {
  // ---- setup: upline (caller), downline (target), same-IMO outsider ----
  const caller = await mkUser();
  const { data: cp } = await admin
    .from("user_profiles")
    .select("imo_id")
    .eq("id", caller.id)
    .single();
  const imo = cp.imo_id;

  const target = await mkUser({ imo_id: imo });
  const outsider = await mkUser({ imo_id: imo });
  await admin
    .from("user_profiles")
    .update({
      upline_id: caller.id,
      hierarchy_path: `${caller.id}.${target.id}`,
      imo_id: imo,
    })
    .eq("id", target.id);

  const callerToken = await signIn(caller.email, caller.password);
  const outsiderToken = await signIn(outsider.email, outsider.password);

  // ---- resend ----
  out.resend_by_upline = await callFn("resend-account-setup", callerToken, {
    user_id: target.id,
  });
  out.resend_by_outsider_should_403 = await callFn(
    "resend-account-setup",
    outsiderToken,
    { user_id: target.id },
  );
  out.resend_no_auth_should_401 = await callFn("resend-account-setup", null, {
    user_id: target.id,
  });

  // ---- disable / re-enable ----
  out.disable_by_upline = await callFn("set-member-access", callerToken, {
    user_id: target.id,
    action: "disable",
    reason: "e2e",
  });
  {
    const { data: u } = await admin.auth.admin.getUserById(target.id);
    const { data: p } = await admin
      .from("user_profiles")
      .select("access_disabled_at")
      .eq("id", target.id)
      .single();
    out.after_disable = {
      banned: !!u.user.banned_until,
      access_disabled_at: !!p.access_disabled_at,
    };
  }
  out.disable_by_outsider_should_403 = await callFn(
    "set-member-access",
    outsiderToken,
    { user_id: target.id, action: "disable" },
  );
  out.enable_by_upline = await callFn("set-member-access", callerToken, {
    user_id: target.id,
    action: "enable",
  });
  {
    const { data: u } = await admin.auth.admin.getUserById(target.id);
    const { data: p } = await admin
      .from("user_profiles")
      .select("access_disabled_at")
      .eq("id", target.id)
      .single();
    out.after_enable = {
      banned: !!u.user.banned_until,
      access_disabled_at: !!p.access_disabled_at,
    };
  }

  // ---- set-account-password (public) ----
  const newbie = await mkUser({ imo_id: imo });
  const { data: up } = await admin.rpc("upsert_account_setup_token", {
    p_user_id: newbie.id,
    p_email: newbie.email,
    p_created_by: caller.id,
    p_enforce_cap: false,
  });
  const token = up.token;
  out.set_password = await callFn("set-account-password", null, {
    token,
    password: "BrandNew12345!",
  });
  try {
    const t = await signIn(newbie.email, "BrandNew12345!");
    out.newbie_login_with_new_password = !!t;
  } catch (e) {
    out.newbie_login_with_new_password = "FAIL: " + e.message;
  }
  out.set_password_again_should_fail = await callFn(
    "set-account-password",
    null,
    { token, password: "Another12345!" },
  );

  console.log(JSON.stringify(out, null, 2));
} finally {
  for (const id of created) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log("cleaned up", created.length, "users");
}
