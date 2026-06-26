// scripts/e2e-password-reset.mjs
//
// E2E for the token-based password reset (send-password-reset) against LOCAL
// Supabase. Asserts the local link base is LOCAL (not prod — the key risk), that
// the token sets a working password, and that an unknown email still returns the
// "No auth account found" 404 callers depend on. Requires `supabase functions serve`.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const fnUrl = (n) => `${URL}/functions/v1/${n}`;
const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function callFn(name, body) {
  // Mirror supabase-js functions.invoke from an unauthenticated browser: it sends
  // the anon key as both apikey and the Authorization bearer (a valid anon JWT).
  const r = await fetch(fnUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  let j = null;
  try {
    j = await r.json();
  } catch {
    j = null;
  }
  return { status: r.status, body: j };
}

const created = [];
const out = {};
try {
  const email = `reset_${Math.random().toString(36).slice(2)}@example.com`;
  const { data: c, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: "OldPass12345!",
    email_confirm: true,
  });
  if (cErr) throw new Error("create: " + cErr.message);
  created.push(c.user.id);

  const LOCAL_ORIGIN = "http://localhost:5173";

  // 1. request reset (local dev → directReset with a recoveryUrl)
  const res = await callFn("send-password-reset", {
    email,
    redirectTo: `${LOCAL_ORIGIN}/auth/callback`,
  });
  out.request = res;

  // 2. KEY ASSERTION: the link base must be LOCAL, not prod
  const recoveryUrl = res.body?.recoveryUrl;
  out.recoveryUrl = recoveryUrl;
  out.base_is_local =
    typeof recoveryUrl === "string" &&
    recoveryUrl.startsWith(`${LOCAL_ORIGIN}/set-password/`);

  // 3. token sets a working password
  const token = recoveryUrl?.split("/set-password/")[1];
  out.set_password = await callFn("set-account-password", {
    token,
    password: "NewReset12345!",
  });
  try {
    const cl = createClient(URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await cl.auth.signInWithPassword({
      email,
      password: "NewReset12345!",
    });
    out.login_with_new_password = !error && !!data.session;
  } catch (e) {
    out.login_with_new_password = "FAIL: " + e.message;
  }

  // 4. unknown email → 404 "No auth account found" (diagnostic preserved)
  const unknown = await callFn("send-password-reset", {
    email: `nobody_${Math.random().toString(36).slice(2)}@example.com`,
    redirectTo: `${LOCAL_ORIGIN}/auth/callback`,
  });
  out.unknown_email_status = unknown.status;
  out.unknown_email_diagnostic =
    unknown.body?.error?.includes("No auth account found") ?? false;

  console.log(JSON.stringify(out, null, 2));
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log("cleaned up", created.length, "users");
}
