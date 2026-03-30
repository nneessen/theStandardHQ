import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  dotenv.config({ path: envFile, override: false });
}

const DEFAULT_LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const DEFAULT_LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlLWRlbW8iLCJyb2xlIjoiYW5vbiIsImV4cCI6MTk4MzgxMjk5Nn0.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEFAULT_LOCAL_EMAIL = "local.agent@thestandardhq.test";
const DEFAULT_LOCAL_PASSWORD = "LocalUser2026!Reset1";

const localSupabaseUrl =
  process.env.LOCAL_SUPABASE_URL ||
  process.env.VITE_LOCAL_SUPABASE_URL ||
  DEFAULT_LOCAL_SUPABASE_URL;
const localSupabaseAnonKey =
  process.env.LOCAL_SUPABASE_ANON_KEY ||
  process.env.VITE_LOCAL_SUPABASE_ANON_KEY ||
  DEFAULT_LOCAL_SUPABASE_ANON_KEY;
const email =
  process.env.CLOSE_KPI_SMOKE_EMAIL ||
  process.env.LOCAL_BOOTSTRAP_ACTIVE_AGENT_EMAIL ||
  DEFAULT_LOCAL_EMAIL;
const password =
  process.env.CLOSE_KPI_SMOKE_PASSWORD ||
  process.env.LOCAL_BOOTSTRAP_ACTIVE_AGENT_PASSWORD ||
  DEFAULT_LOCAL_PASSWORD;

const supabase = createClient(localSupabaseUrl, localSupabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const authResult = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (authResult.error || !authResult.data.session) {
  throw new Error(
    `Local sign-in failed for ${email}: ${authResult.error?.message ?? "missing session"}`,
  );
}

const accessToken = authResult.data.session.access_token;
const userId = authResult.data.session.user.id;

const insightsResult = await supabase.functions.invoke("close-lead-heat-score", {
  headers: { Authorization: `Bearer ${accessToken}` },
  body: { action: "get_portfolio_insights" },
});

if (insightsResult.error) {
  throw new Error(
    insightsResult.error.message || "close-lead-heat-score invoke failed",
  );
}

if (insightsResult.data?.error) {
  throw new Error(insightsResult.data.error);
}

const leadQuery = await supabase
  .from("lead_heat_scores")
  .select("display_name, score, signals", { count: "exact" })
  .eq("user_id", userId)
  .not("signals->>hasWonOpportunity", "eq", "true")
  .not("signals->>currentStatusLabel", "ilike", "%sold%")
  .not("signals->>currentStatusLabel", "ilike", "%won%")
  .not("signals->>currentStatusLabel", "ilike", "%policy pending%")
  .not("signals->>currentStatusLabel", "ilike", "%policy issued%")
  .not("signals->>currentStatusLabel", "ilike", "%issued%")
  .not("signals->>currentStatusLabel", "ilike", "%bound%")
  .not("signals->>currentStatusLabel", "ilike", "%in force%")
  .not("signals->>currentStatusLabel", "ilike", "%active policy%")
  .order("score", { ascending: false })
  .limit(10);

if (leadQuery.error) {
  throw new Error(leadQuery.error.message);
}

const leakedStatuses = (leadQuery.data ?? [])
  .filter((row) => {
    const signals = row.signals ?? {};
    const status =
      typeof signals.currentStatusLabel === "string"
        ? signals.currentStatusLabel.toLowerCase()
        : "";

    return (
      signals.hasWonOpportunity === true ||
      [
        "sold",
        "won",
        "policy pending",
        "policy issued",
        "issued",
        "bound",
        "in force",
        "active policy",
      ].some((pattern) => status.includes(pattern))
    );
  })
  .map((row) => ({
    displayName: row.display_name,
    status: row.signals?.currentStatusLabel ?? null,
    score: row.score,
  }));

console.log(
  JSON.stringify(
    {
      localSupabaseUrl,
      signedInAs: email,
      userId,
      portfolioInsights: {
        overall: insightsResult.data?.analysis?.overall ?? "",
        recommendations: insightsResult.data?.recommendations?.length ?? 0,
        anomalies: insightsResult.data?.anomalies?.length ?? 0,
        analyzedAt: insightsResult.data?.analyzed_at ?? null,
      },
      leadRankings: {
        totalFiltered: leadQuery.count ?? 0,
        topStatuses: (leadQuery.data ?? []).slice(0, 5).map((row) => ({
          displayName: row.display_name,
          status: row.signals?.currentStatusLabel ?? null,
          score: row.score,
        })),
        leakedStatuses,
      },
    },
    null,
    2,
  ),
);
