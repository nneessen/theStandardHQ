// Diagnostic: dumps the raw s_query for a smart view via close-lead-drop's
// debug_smart_view action. Use this to see exactly what Close returned for
// Mortgage S2VM (or any other smart view) so we can confirm whether its
// object_type scope is being stripped.
//
// Usage:
//   node scripts/debug-lead-drop-smart-view.mjs "S2VM"
//   node scripts/debug-lead-drop-smart-view.mjs            # no filter → list all
//
// Reads credentials from .env (REMOTE) by default. Set
// USE_LOCAL=1 to hit the local stack instead.

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  dotenv.config({ path: envFile, override: false });
}

// Default to REMOTE. Local dev's `.env.local` sets VITE_SUPABASE_URL to
// 127.0.0.1, so you can't sign in as a prod user — and the whole point of
// this diagnostic is to inspect prod Close data. Pass USE_LOCAL=1 to override.
const useLocal = process.env.USE_LOCAL === "1";

const supabaseUrl = useLocal
  ? process.env.LOCAL_SUPABASE_URL ||
    process.env.VITE_LOCAL_SUPABASE_URL ||
    "http://127.0.0.1:54321"
  : process.env.REMOTE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL;

const supabaseAnonKey = useLocal
  ? process.env.LOCAL_SUPABASE_ANON_KEY ||
    process.env.VITE_LOCAL_SUPABASE_ANON_KEY
  : process.env.REMOTE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

const email =
  process.env.DEBUG_AGENT_EMAIL ||
  process.env.LOCAL_BOOTSTRAP_ACTIVE_AGENT_EMAIL;
const password =
  process.env.DEBUG_AGENT_PASSWORD ||
  process.env.LOCAL_BOOTSTRAP_ACTIVE_AGENT_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
  console.error(
    "Missing credentials. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, DEBUG_AGENT_EMAIL, DEBUG_AGENT_PASSWORD in .env — or pass USE_LOCAL=1 with LOCAL_* equivalents.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const auth = await supabase.auth.signInWithPassword({ email, password });
if (auth.error) {
  console.error("Sign-in failed:", auth.error.message);
  process.exit(1);
}

async function callFn(action, params = {}) {
  const { data, error } = await supabase.functions.invoke("close-lead-drop", {
    body: { action, ...params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

const nameFilter = (process.argv[2] || "").toLowerCase();

console.log(`[debug] supabase=${supabaseUrl} user=${email}`);
console.log(`[debug] listing smart views${nameFilter ? ` matching "${nameFilter}"` : ""}…`);

const { smart_views } = await callFn("get_smart_views");
const matches = nameFilter
  ? smart_views.filter((sv) => sv.name.toLowerCase().includes(nameFilter))
  : smart_views;

console.log(`[debug] ${matches.length}/${smart_views.length} smart views matched`);
const doTrace = process.argv.includes("--trace");

for (const sv of matches) {
  console.log(`\n── ${sv.name} (${sv.id}) ─────────────────────`);

  if (doTrace) {
    // Exhaustive: walks /data/search/ pagination AND hits /lead/?saved_search_id=
    // (the UI's source of truth) to pinpoint where the 255 overflow comes from.
    const trace = await callFn("trace_preview", { smart_view_id: sv.id });
    console.log(JSON.stringify(trace, null, 2));
  } else {
    const result = await callFn("debug_smart_view", { smart_view_id: sv.id });
    console.log(JSON.stringify(result, null, 2));

    try {
      const preview = await callFn("preview_leads", {
        smart_view_id: sv.id,
        cursor: null,
        _limit: 100,
      });
      console.log(
        `   preview → leads=${preview.leads.length} has_more=${preview.has_more} total=${preview.total}`,
      );
    } catch (e) {
      console.log(`   preview failed: ${e.message}`);
    }
  }
}

await supabase.auth.signOut();
