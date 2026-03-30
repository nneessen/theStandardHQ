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
const rangePreset = process.env.CLOSE_KPI_SMOKE_RANGE || "last_90_days";

const supabase = createClient(localSupabaseUrl, localSupabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { from, to } = getDateRangeBounds(rangePreset);

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

const metadata = await invokeCloseKpi({
  accessToken,
  body: { action: "get_metadata" },
});

const rollupFirst = await invokeCloseKpi({
  accessToken,
  body: {
    action: "get_prebuilt_dashboard_rollup",
    dateRange: rangePreset,
    from,
    to,
  },
});

const rollupSecond = await invokeCloseKpi({
  accessToken,
  body: {
    action: "get_prebuilt_dashboard_rollup",
    dateRange: rangePreset,
    from,
    to,
  },
});

console.log(
  JSON.stringify(
    {
      localSupabaseUrl,
      signedInAs: email,
      dateRange: { preset: rangePreset, from, to },
      metadata: {
        statuses: metadata.statuses?.length ?? 0,
        smartViews: metadata.smartViews?.length ?? 0,
        pipelines: metadata.pipelines?.length ?? 0,
        sampleStatusLabels: (metadata.statuses ?? [])
          .slice(0, 5)
          .map((status) => status.label),
        sampleSmartViews: (metadata.smartViews ?? [])
          .slice(0, 5)
          .map((smartView) => smartView.name),
      },
      firstRollup: summarizeRollup(rollupFirst),
      secondRollup: summarizeRollup(rollupSecond),
    },
    null,
    2,
  ),
);

async function invokeCloseKpi({ accessToken, body }) {
  const { data, error } = await supabase.functions.invoke("close-kpi-data", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });

  if (error) {
    throw new Error(error.message || "close-kpi-data invocation failed");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

function summarizeRollup(rollup) {
  return {
    cacheHit: rollup.cacheHit,
    fetchedAt: rollup.fetchedAt,
    expiresAt: rollup.expiresAt,
    widgets: {
      totalLeads: rollup.widgets?.total_leads?.value ?? null,
      newLeads: rollup.widgets?.new_leads?.value ?? null,
      statusBuckets: rollup.widgets?.status_dist?.items?.length ?? 0,
      totalCalls: rollup.widgets?.call_analytics?.total ?? null,
      totalOutboundCalls: rollup.widgets?.call_analytics?.outbound ?? null,
      speedToLeadAvgMinutes: rollup.widgets?.speed_to_lead?.avgMinutes ?? null,
      contactCadenceAvgHours:
        rollup.widgets?.contact_cadence?.avgGapHours ?? null,
      dialAttemptsAvg: rollup.widgets?.dial_attempts?.avgAttempts ?? null,
      opportunityPipelineValue:
        rollup.widgets?.opp_funnel?.totalValue ?? null,
      vmRateRows: rollup.widgets?.vm_rate?.rows?.length ?? 0,
      crossRefRows: rollup.widgets?.cross_ref?.rows?.length ?? 0,
    },
  };
}

function getDateRangeBounds(preset) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  switch (preset) {
    case "last_30_days": {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "last_90_days": {
      const start = new Date(now);
      start.setDate(now.getDate() - 90);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString().split("T")[0], to: today };
    }
    default:
      return { from: today, to: today };
  }
}
