// Smoke test: get_policy_dashboard_metrics RPC end-to-end as the E2E user.
//
// Signs in with the designated .env.local E2E creds (a TEST account — never a
// real user's), calls the RPC the Policies page now uses, and prints the row.
// Verifies auth.uid() scoping, arg passing, and return shape against live data.
//
//   node scripts/smoke/test-dashboard-metrics-rpc.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

if (!url || !anon || !email || !password) {
  console.error("Missing env: source .env and .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});

const { error: authErr } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (authErr) {
  console.error("Sign-in failed:", authErr.message);
  process.exit(1);
}

// Default (no filters) — should match the user's whole book.
const { data, error } = await supabase.rpc("get_policy_dashboard_metrics", {
  p_date_field: "submit_date",
});

if (error) {
  await supabase.auth.signOut();
  console.error("RPC error:", error);
  process.exit(1);
}

const row = Array.isArray(data) ? data[0] : data;
console.log("get_policy_dashboard_metrics →", JSON.stringify(row, null, 2));

// Spot-check the known values for the E2E user's book.
const earned = Number(row?.earned_commission ?? 0);
const pending = Number(row?.pending_commission ?? 0);
const total = Number(row?.total_policies ?? 0);
console.log(
  `\nSummary: total=${total} earned=$${earned.toFixed(2)} pending=$${pending.toFixed(2)}`,
);

// Page-scoped commission fetch (mirrors CommissionRepository.findByPolicyIds /
// useCommissionsByPolicyIds) — the policies list now loads commissions only for
// the visible page instead of the whole book.
const { data: pagePols } = await supabase
  .from("policies")
  .select("id")
  .limit(5);
const pageIds = (pagePols ?? []).map((p) => p.id);
const { data: pageComms, error: commErr } = await supabase
  .from("commissions")
  .select(
    "*, policy:policies(policy_number,effective_date,lifecycle_status,cancellation_date)",
  )
  .in("policy_id", pageIds)
  .order("created_at", { ascending: false });
if (commErr) {
  await supabase.auth.signOut();
  console.error("by-policy-ids query error:", commErr);
  process.exit(1);
}
console.log(
  `\nPage-scoped: ${pageIds.length} policy ids → ${pageComms?.length ?? 0} commissions (RLS-scoped).`,
);

await supabase.auth.signOut();
