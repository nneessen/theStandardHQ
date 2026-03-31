// supabase/functions/close-lead-heat-score/index.ts
// AI-powered lead heat scoring edge function for Close CRM.
// Dispatches actions: score_all, score_incremental, analyze_portfolio,
// analyze_lead, score_all_users (cron entry point).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";
import { scoreLead, getHeatLevel } from "./scoring-engine.ts";
import { extractSignals } from "./signal-extractor.ts";
import {
  analyzePortfolio,
  analyzeLeadDeepDive,
  buildPortfolioSummary,
} from "./ai-analyzer.ts";
import { detectOutcomes } from "./outcome-detector.ts";
import type {
  AgentWeights,
  CloseLead,
  CloseActivity,
  CloseStatusChange,
  CloseOpportunity,
  LeadSignals,
  ScoreBreakdown,
} from "./types.ts";
import { DEFAULT_AGENT_WEIGHTS as DEFAULTS } from "./types.ts";

// ─── CORS (matches close-kpi-data) ───────────────────────────────────

const ALLOWED_ORIGINS = [
  "https://app.thestandardhq.com",
  "https://www.thestandardhq.com",
  "https://thestandardhq.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3003",
  "http://127.0.0.1:3004",
];

function isLoopbackValue(value?: string | null) {
  if (!value) return false;
  return value.includes("127.0.0.1") || value.includes("localhost");
}

function corsHeaders(req?: Request) {
  const reqOrigin = req?.headers.get("origin") ?? "";
  const isLocal =
    isLoopbackValue(Deno.env.get("SUPABASE_URL")) ||
    isLoopbackValue(reqOrigin) ||
    isLoopbackValue(req?.url);
  let origin = "*";
  if (reqOrigin && isLoopbackValue(reqOrigin)) {
    origin = reqOrigin;
  } else if (!isLocal && req) {
    origin = ALLOWED_ORIGINS.includes(reqOrigin)
      ? reqOrigin
      : ALLOWED_ORIGINS[0];
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// deno-lint-ignore no-explicit-any
function jsonResponse(data: any, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── Close API v1 Client (matches close-kpi-data) ────────────────────

const CLOSE_API_BASE = "https://api.close.com/api/v1";

async function closeGet(apiKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${CLOSE_API_BASE}${path}`, {
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (res.status === 401) {
    throw Object.assign(new Error("Close API key is expired or invalid"), {
      code: "CLOSE_AUTH_ERROR",
      status: 401,
    });
  }
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "2", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    const retryRes = await fetch(`${CLOSE_API_BASE}${path}`, {
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!retryRes.ok)
      throw Object.assign(new Error("Close API rate limit"), {
        code: "CLOSE_RATE_LIMIT",
        status: 429,
      });
    return retryRes.json();
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw Object.assign(new Error(`Close API ${res.status}: ${errText}`), {
      code: "CLOSE_ERROR",
      status: res.status,
    });
  }
  return res.json();
}

// ─── Pagination Helper ────────────────────────────────────────────────

interface PaginatedResponse {
  data: unknown[];
  has_more: boolean;
  total_results?: number;
}

async function closeGetAll(
  apiKey: string,
  basePath: string,
  maxItems = 2000,
): Promise<{ items: unknown[]; truncated: boolean }> {
  const all: unknown[] = [];
  let skip = 0;
  const limit = 100;
  let truncated = false;

  while (all.length < maxItems) {
    const sep = basePath.includes("?") ? "&" : "?";
    const path = `${basePath}${sep}_skip=${skip}&_limit=${limit}`;
    const page = (await closeGet(apiKey, path)) as PaginatedResponse;
    all.push(...(page.data ?? []));
    if (!page.has_more || (page.data?.length ?? 0) < limit) break;
    skip += limit;
  }
  // If we hit maxItems but the API had more data, mark as truncated
  if (all.length >= maxItems) {
    truncated = true;
    all.length = maxItems; // trim to exact limit
  }
  return { items: all, truncated };
}

// ─── Status Label Resolver ────────────────────────────────────────────

async function fetchStatusLabels(apiKey: string): Promise<Map<string, string>> {
  const result = (await closeGet(apiKey, "/status/lead/")) as {
    data: { id: string; label: string }[];
  };
  const map = new Map<string, string>();
  for (const s of result.data ?? []) {
    map.set(s.id, s.label);
  }
  return map;
}

const PORTFOLIO_ANALYSIS_MODEL = "claude-haiku-4-5-20251001";
const PORTFOLIO_ANALYSIS_TTL_MS = 4 * 60 * 60 * 1000;
const CLOSED_WON_STATUS_PATTERNS = [
  "sold",
  "won -",
  "policy pending",
  "policy issued",
  "issued and paid",
  "bound",
  "in force",
  "active policy",
];

function isRankablePortfolioLead(signals: LeadSignals | null | undefined) {
  if (!signals) return true;

  const currentStatusLabel =
    signals.currentStatusLabel?.trim().toLowerCase() ?? "";
  const hasWonOpportunity = signals.hasWonOpportunity === true;

  return (
    !hasWonOpportunity &&
    !CLOSED_WON_STATUS_PATTERNS.some((pattern) =>
      currentStatusLabel.includes(pattern),
    )
  );
}

function emptyPortfolioInsightsRow() {
  return {
    analysis: {},
    anomalies: [],
    recommendations: [],
    weight_adjustments: [],
  };
}

async function materializePortfolioInsights(
  userId: string,
  // deno-lint-ignore no-explicit-any
  dataClient: any,
  options?: {
    now?: Date;
    scoredLeads?: {
      closeLeadId: string;
      displayName: string;
      score: number;
      breakdown: ScoreBreakdown;
      signals: LeadSignals;
    }[];
    weightsRow?: { weights: AgentWeights; version: number } | null;
    outcomeRows?: {
      close_lead_id: string;
      outcome_type: string;
      signals_at_outcome: LeadSignals | null;
    }[];
  },
) {
  const now = options?.now ?? new Date();

  const { data: existingAnalysis, error: existingAnalysisError } =
    await dataClient
      .from("lead_heat_ai_portfolio_analysis")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

  if (existingAnalysisError) {
    console.warn(
      "[lead-heat-score] Failed to read existing portfolio analysis:",
      existingAnalysisError.message,
    );
  }

  const analysisExpired =
    !existingAnalysis || new Date(existingAnalysis.expires_at) < now;

  if (existingAnalysis && !analysisExpired) {
    return {
      analysis: existingAnalysis,
      aiCallsMade: 0,
      generated: false,
    };
  }

  const weightsRow =
    options?.weightsRow ??
    (
      await dataClient
        .from("lead_heat_agent_weights")
        .select("weights, version")
        .eq("user_id", userId)
        .maybeSingle()
    ).data ??
    null;
  const weights: AgentWeights = weightsRow?.weights ?? DEFAULTS;

  const trainingOutcomeRows =
    options?.outcomeRows ??
    (
      await dataClient
        .from("lead_heat_outcomes")
        .select("close_lead_id, outcome_type, signals_at_outcome")
        .eq("user_id", userId)
        .in("outcome_type", ["won", "lost"])
        .gte(
          "occurred_at",
          new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        )
    ).data ??
    [];

  const scoredLeads =
    options?.scoredLeads ??
    (
      await dataClient
        .from("lead_heat_scores")
        .select("close_lead_id, display_name, score, breakdown, signals")
        .eq("user_id", userId)
    ).data?.map(
      // deno-lint-ignore no-explicit-any
      (row: any) => ({
        closeLeadId: row.close_lead_id,
        displayName: row.display_name,
        score: row.score,
        breakdown: row.breakdown as ScoreBreakdown,
        signals: row.signals as LeadSignals,
      }),
    ) ??
    [];

  const rankableScoredLeads = scoredLeads.filter(
    (lead: {
      score: number;
      signals: LeadSignals;
      breakdown: ScoreBreakdown;
    }) => isRankablePortfolioLead(lead.signals),
  );

  if (rankableScoredLeads.length < 10) {
    return {
      analysis: existingAnalysis ?? emptyPortfolioInsightsRow(),
      aiCallsMade: 0,
      generated: false,
    };
  }

  const { data: allOutcomes, error: outcomesError } = await dataClient
    .from("lead_heat_outcomes")
    .select("outcome_type, signals_at_outcome, breakdown_at_outcome")
    .eq("user_id", userId)
    .gte(
      "occurred_at",
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    );

  if (outcomesError) {
    throw new Error(outcomesError.message);
  }

  const portfolioSummary = buildPortfolioSummary(
    rankableScoredLeads.map(
      (lead: {
        score: number;
        signals: LeadSignals;
        breakdown: ScoreBreakdown;
      }) => ({
        score: lead.score,
        heatLevel: getHeatLevel(lead.score),
        signals: lead.signals,
        breakdown: lead.breakdown,
      }),
    ),
    allOutcomes ?? [],
    weights,
  );

  const { result: aiResult, tokensUsed } =
    await analyzePortfolio(portfolioSummary);

  const analysisPayload = {
    overall: aiResult.overallAssessment ?? "",
    insights: aiResult.insights ?? [],
  };

  const portfolioAnalysisRow = {
    user_id: userId,
    analysis: analysisPayload,
    anomalies: aiResult.anomalies ?? [],
    recommendations: aiResult.recommendations ?? [],
    weight_adjustments: aiResult.weightAdjustments ?? [],
    model_used: PORTFOLIO_ANALYSIS_MODEL,
    tokens_used: tokensUsed,
    analyzed_at: now.toISOString(),
    expires_at: new Date(
      now.getTime() + PORTFOLIO_ANALYSIS_TTL_MS,
    ).toISOString(),
  };

  const { data: savedAnalysis, error: saveAnalysisError } = await dataClient
    .from("lead_heat_ai_portfolio_analysis")
    .upsert(portfolioAnalysisRow, { onConflict: "user_id" })
    .select("*")
    .single();

  if (saveAnalysisError) {
    throw new Error(saveAnalysisError.message);
  }

  if (aiResult.weightAdjustments?.length > 0) {
    const newWeights = { ...weights };
    for (const adj of aiResult.weightAdjustments) {
      if (newWeights[adj.signalKey]) {
        const current = newWeights[adj.signalKey].multiplier;
        const target = Math.max(0.3, Math.min(2.0, adj.recommendedMultiplier));
        const change = Math.max(-0.15, Math.min(0.15, target - current));
        newWeights[adj.signalKey] = {
          multiplier: Math.round((current + change) * 100) / 100,
        };
      }
    }

    const currentVersion = weightsRow?.version ?? 0;
    if (currentVersion > 0) {
      const { error: weightError } = await dataClient
        .from("lead_heat_agent_weights")
        .update({
          weights: newWeights,
          version: currentVersion + 1,
          sample_size: trainingOutcomeRows.length,
          last_trained_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId)
        .eq("version", currentVersion);

      if (weightError) {
        console.warn(
          "[lead-heat-score] Weight update skipped: version conflict or error",
        );
      }
    } else {
      await dataClient.from("lead_heat_agent_weights").upsert(
        {
          user_id: userId,
          weights: newWeights,
          version: 1,
          sample_size: trainingOutcomeRows.length,
          last_trained_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" },
      );
    }
  }

  return {
    analysis: savedAnalysis ?? portfolioAnalysisRow,
    aiCallsMade: 1,
    generated: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ACTION: score_all — full rescore of all leads for a user
// ═══════════════════════════════════════════════════════════════════════

async function handleScoreAll(
  apiKey: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  dataClient: any,
  // deno-lint-ignore no-explicit-any
  _params: any,
) {
  const startTime = Date.now();

  // Concurrency guard: skip if a recent scoring run is already running
  const { data: activeRun } = await dataClient
    .from("lead_heat_scoring_runs")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 25 * 60 * 1000).toISOString())
    .maybeSingle();

  if (activeRun) {
    return {
      runId: activeRun.id,
      leadsScored: 0,
      leadsTotal: 0,
      skipped: true,
      reason: "Already running",
    };
  }

  // Mark any stale "running" runs as failed (edge function timeout cleanup)
  await dataClient
    .from("lead_heat_scoring_runs")
    .update({
      status: "failed",
      error_message: "Stale run cleaned up",
      completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 25 * 60 * 1000).toISOString());

  // Create scoring run record
  const { data: run } = await dataClient
    .from("lead_heat_scoring_runs")
    .insert({ user_id: userId, run_type: "manual", status: "running" })
    .select("id")
    .single();
  const runId = run?.id;

  try {
    // 1. Fetch status labels for resolution
    const statusLabels = await fetchStatusLabels(apiKey);

    // 2. Fetch all leads
    const leadsResult = await closeGetAll(
      apiKey,
      "/lead/?_fields=id,display_name,status_id,date_created,custom",
      5000,
    );
    const leads = leadsResult.items as CloseLead[];
    const leadsTruncated = leadsResult.truncated;

    // 3. Load previous scores for trend + outcome detection
    const { data: previousScores } = await dataClient
      .from("lead_heat_scores")
      .select("close_lead_id, score, breakdown, signals")
      .eq("user_id", userId);

    const prevMap = new Map<
      string,
      {
        score: number;
        breakdown: ScoreBreakdown;
        signals: LeadSignals;
        oppSnapshot: { id: string; statusType: string }[];
      }
    >();
    for (const ps of previousScores ?? []) {
      // Extract opportunity snapshot stored from previous scoring run
      // deno-lint-ignore no-explicit-any
      const rawSignals = ps.signals as Record<string, any>;
      prevMap.set(ps.close_lead_id, {
        score: ps.score,
        breakdown: ps.breakdown,
        signals: ps.signals,
        oppSnapshot: Array.isArray(rawSignals?._oppSnapshot)
          ? rawSignals._oppSnapshot
          : [],
      });
    }

    // 4. Load agent weights (include version for optimistic locking)
    const { data: weightsRow } = await dataClient
      .from("lead_heat_agent_weights")
      .select("weights, version")
      .eq("user_id", userId)
      .maybeSingle();

    const weights: AgentWeights = weightsRow?.weights ?? DEFAULTS;

    // 5. Build source conversion rate map from outcomes
    const { data: outcomeRows } = await dataClient
      .from("lead_heat_outcomes")
      .select("close_lead_id, outcome_type, signals_at_outcome")
      .eq("user_id", userId)
      .in("outcome_type", ["won", "lost"])
      .gte(
        "occurred_at",
        new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      );

    const sourceConversionRates = computeSourceConversionRates(
      outcomeRows ?? [],
    );

    // 6. Batch-fetch activities for all leads
    // We fetch ALL recent activities rather than per-lead to minimize API calls
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const dateFilter = `date_created__gte=${thirtyDaysAgo}`;

    const [
      callsResult,
      emailsResult,
      smsResult,
      statusChangesResult,
      oppsResult,
    ] = await Promise.all([
      closeGetAll(
        apiKey,
        `/activity/call/?${dateFilter}&_fields=id,lead_id,date_created,direction,duration,disposition`,
        3000,
      ),
      closeGetAll(
        apiKey,
        `/activity/email/?${dateFilter}&_fields=id,lead_id,date_created,direction`,
        3000,
      ),
      closeGetAll(
        apiKey,
        `/activity/sms/?${dateFilter}&_fields=id,lead_id,date_created,direction`,
        3000,
      ),
      closeGetAll(
        apiKey,
        `/activity/status_change/lead/?${dateFilter}&_fields=id,lead_id,date_created,old_status_id,new_status_id,old_status_label,new_status_label`,
        3000,
      ),
      closeGetAll(
        apiKey,
        `/opportunity/?_fields=id,lead_id,value,status_type,status_label,date_created,date_won,date_lost`,
        2000,
      ),
    ]);

    const calls = callsResult.items as CloseActivity[];
    const emails = emailsResult.items as CloseActivity[];
    const sms = smsResult.items as CloseActivity[];
    const statusChanges = statusChangesResult.items as CloseStatusChange[];
    const opportunities = oppsResult.items as CloseOpportunity[];
    const activitiesTruncated =
      callsResult.truncated ||
      emailsResult.truncated ||
      smsResult.truncated ||
      statusChangesResult.truncated ||
      oppsResult.truncated;

    // 7. Score each lead
    const now = new Date();
    const scoredLeads: {
      closeLeadId: string;
      displayName: string;
      score: number;
      heatLevel: string;
      trend: string;
      previousScore: number | null;
      breakdown: ScoreBreakdown;
      signals: LeadSignals;
    }[] = [];
    // Track current opportunity states per lead for persistence (outcome detection next run)
    const oppSnapshotMap = new Map<
      string,
      { id: string; statusType: string }[]
    >();

    const allOutcomeEvents: {
      user_id: string;
      close_lead_id: string;
      outcome_type: string;
      score_at_outcome: number;
      breakdown_at_outcome: ScoreBreakdown;
      signals_at_outcome: LeadSignals;
      close_opp_id: string | null;
      opp_value: number | null;
      occurred_at: string;
    }[] = [];

    for (const lead of leads) {
      const signals = extractSignals(
        lead,
        calls,
        emails,
        sms,
        statusChanges,
        opportunities,
        sourceConversionRates,
        statusLabels,
        now,
      );

      const prev = prevMap.get(lead.id);
      const scored = scoreLead(signals, weights, prev?.score ?? null);
      scoredLeads.push(scored);

      // Detect outcomes for learning
      const leadOpps = opportunities.filter((o) => o.lead_id === lead.id);
      oppSnapshotMap.set(
        lead.id,
        leadOpps.map((o) => ({ id: o.id, statusType: o.status_type })),
      );
      const outcomes = detectOutcomes(
        signals,
        scored.score,
        scored.breakdown,
        leadOpps,
        prev
          ? {
              closeLeadId: lead.id,
              score: prev.score,
              breakdown: prev.breakdown,
              signals: prev.signals,
              previousOpps: prev.oppSnapshot,
            }
          : null,
      );

      for (const outcome of outcomes) {
        allOutcomeEvents.push({
          user_id: userId,
          close_lead_id: outcome.closeLeadId,
          outcome_type: outcome.outcomeType,
          score_at_outcome: outcome.scoreAtOutcome,
          breakdown_at_outcome: outcome.breakdownAtOutcome,
          signals_at_outcome: outcome.signalsAtOutcome,
          close_opp_id: outcome.closeOppId,
          opp_value: outcome.oppValue,
          occurred_at: now.toISOString(),
        });
      }
    }

    // 8. Calibrate: percentile-based heat bands (replaces fixed score thresholds)
    const calibrationMap = new Map<
      string,
      { percentileRank: number; heatLevel: string }
    >();
    if (scoredLeads.length >= 5) {
      const sorted = [...scoredLeads].sort((a, b) => b.score - a.score);
      const n = sorted.length;
      for (let i = 0; i < n; i++) {
        const percentileRank = Math.round(((n - i - 0.5) / n) * 100);
        let heatLevel: string;
        if (percentileRank >= 90) heatLevel = "hot";
        else if (percentileRank >= 75) heatLevel = "warming";
        else if (percentileRank >= 50) heatLevel = "neutral";
        else if (percentileRank >= 25) heatLevel = "cooling";
        else heatLevel = "cold";
        calibrationMap.set(sorted[i].closeLeadId, {
          percentileRank,
          heatLevel,
        });
      }
    }

    // 9. Upsert scores into DB (include opp snapshot + calibrated heat levels)
    const upsertRows = scoredLeads.map((s) => {
      const cal = calibrationMap.get(s.closeLeadId);
      return {
        user_id: userId,
        close_lead_id: s.closeLeadId,
        display_name: s.displayName,
        score: s.score,
        heat_level: cal?.heatLevel ?? s.heatLevel,
        trend: s.trend,
        previous_score: s.previousScore,
        breakdown: s.breakdown,
        signals: {
          ...s.signals,
          _oppSnapshot: oppSnapshotMap.get(s.closeLeadId) ?? [],
        },
        percentile_rank: cal?.percentileRank ?? null,
        scoring_model_version: "heuristic_v1",
        scored_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
    });

    // Batch upsert in chunks of 500
    for (let i = 0; i < upsertRows.length; i += 500) {
      const chunk = upsertRows.slice(i, i + 500);
      await dataClient
        .from("lead_heat_scores")
        .upsert(chunk, { onConflict: "user_id,close_lead_id" });
    }

    // 9. Insert outcome events
    if (allOutcomeEvents.length > 0) {
      // Insert outcomes individually to handle dedup constraint gracefully
      for (const event of allOutcomeEvents) {
        const { error: insertErr } = await dataClient
          .from("lead_heat_outcomes")
          .insert(event);
        if (insertErr && !insertErr.message?.includes("duplicate")) {
          console.error(
            "[lead-heat-score] Outcome insert error:",
            insertErr.message,
          );
        }
      }
    }

    // 10. Refresh AI portfolio analysis when expired
    let aiCallsMade = 0;
    try {
      const portfolioAnalysis = await materializePortfolioInsights(
        userId,
        dataClient,
        {
          now,
          scoredLeads,
          weightsRow,
          outcomeRows: outcomeRows ?? [],
        },
      );
      aiCallsMade = portfolioAnalysis.aiCallsMade;
    } catch (aiErr) {
      console.error(
        "[lead-heat-score] AI analysis failed:",
        (aiErr as Error).message,
      );
      // Non-fatal: scoring still succeeded, just no AI insights this run
    }

    const durationMs = Date.now() - startTime;

    // Update scoring run
    if (runId) {
      await dataClient
        .from("lead_heat_scoring_runs")
        .update({
          status: "completed",
          leads_scored: scoredLeads.length,
          leads_total: leads.length,
          ai_calls_made: aiCallsMade,
          duration_ms: durationMs,
          completed_at: now.toISOString(),
          is_truncated: leadsTruncated || activitiesTruncated,
        })
        .eq("id", runId);
    }

    return {
      runId,
      leadsScored: scoredLeads.length,
      leadsTotal: leads.length,
      isTruncated: leadsTruncated || activitiesTruncated,
      aiCallsMade,
      durationMs,
      outcomesDetected: allOutcomeEvents.length,
    };
  } catch (err) {
    if (runId) {
      await dataClient
        .from("lead_heat_scoring_runs")
        .update({
          status: "failed",
          error_message: (err as Error).message,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ACTION: analyze_lead — AI deep dive on a single lead (Tier 3)
// ═══════════════════════════════════════════════════════════════════════

async function handleAnalyzeLead(
  apiKey: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  dataClient: any,
  // deno-lint-ignore no-explicit-any
  params: any,
) {
  const { closeLeadId } = params;
  if (!closeLeadId) throw new Error("closeLeadId is required");

  // Validate Close lead ID format to prevent URL parameter injection
  if (
    typeof closeLeadId !== "string" ||
    !/^lead_[a-zA-Z0-9]+$/.test(closeLeadId)
  ) {
    throw Object.assign(new Error("Invalid closeLeadId format"), {
      code: "INVALID_INPUT",
      status: 400,
    });
  }

  // Load existing score
  const { data: existingScore } = await dataClient
    .from("lead_heat_scores")
    .select("*")
    .eq("user_id", userId)
    .eq("close_lead_id", closeLeadId)
    .single();

  if (!existingScore) {
    throw Object.assign(new Error("Lead not scored yet. Run scoring first."), {
      code: "LEAD_NOT_SCORED",
      status: 400,
    });
  }

  // Check cache (1hr TTL for AI insights — use dedicated timestamp, not updated_at)
  if (existingScore.ai_insights && existingScore.ai_insights_generated_at) {
    const insightsAge =
      Date.now() - new Date(existingScore.ai_insights_generated_at).getTime();
    if (insightsAge < 60 * 60 * 1000) {
      return { cached: true, ...existingScore.ai_insights };
    }
  }

  // Fetch activity timeline for this lead
  const [callsRes, emailsRes, smsRes, scRes] = await Promise.all([
    closeGetAll(
      apiKey,
      `/activity/call/?lead_id=${closeLeadId}&_fields=id,date_created,direction,duration,disposition`,
      100,
    ),
    closeGetAll(
      apiKey,
      `/activity/email/?lead_id=${closeLeadId}&_fields=id,date_created,direction`,
      100,
    ),
    closeGetAll(
      apiKey,
      `/activity/sms/?lead_id=${closeLeadId}&_fields=id,date_created,direction`,
      100,
    ),
    closeGetAll(
      apiKey,
      `/activity/status_change/lead/?lead_id=${closeLeadId}&_fields=id,date_created,old_status_label,new_status_label`,
      50,
    ),
  ]);

  // Build timeline
  const timeline: { date: string; type: string; description: string }[] = [];

  for (const call of callsRes.items as CloseActivity[]) {
    timeline.push({
      date: call.date_created,
      type: "Call",
      description: `${call.direction ?? "unknown"} call, disposition: ${call.disposition ?? "unknown"}, duration: ${call.duration ?? 0}s`,
    });
  }
  for (const email of emailsRes.items as CloseActivity[]) {
    timeline.push({
      date: email.date_created,
      type: "Email",
      description: `${email.direction ?? "unknown"} email`,
    });
  }
  for (const s of smsRes.items as CloseActivity[]) {
    timeline.push({
      date: s.date_created,
      type: "SMS",
      description: `${s.direction ?? "unknown"} SMS`,
    });
  }
  for (const sc of scRes.items as CloseStatusChange[]) {
    timeline.push({
      date: sc.date_created,
      type: "Status Change",
      description: `"${sc.old_status_label}" → "${sc.new_status_label}"`,
    });
  }

  // Sort most recent first
  timeline.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const { result, tokensUsed } = await analyzeLeadDeepDive({
    displayName: existingScore.display_name,
    score: existingScore.score,
    heatLevel: existingScore.heat_level,
    breakdown: existingScore.breakdown,
    signals: existingScore.signals,
    activityTimeline: timeline,
  });

  // Cache the AI insights on the score row (use dedicated timestamp for cache TTL)
  await dataClient
    .from("lead_heat_scores")
    .update({
      ai_insights: result,
      ai_insights_generated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("close_lead_id", closeLeadId);

  return { cached: false, tokensUsed, ...result };
}

// ═══════════════════════════════════════════════════════════════════════
// ACTION: score_all_users — cron entry point
// ═══════════════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function handleScoreAllUsers(dataClient: any) {
  // Score only users with their own close_config (their own Close API key).
  // Each agent has their own Close account — never use another user's key.
  const { data: activeConfigs, error } = await dataClient
    .from("close_config")
    .select("user_id, api_key_encrypted")
    .eq("is_active", true);

  if (error || !activeConfigs?.length) {
    return { usersProcessed: 0, message: "No active Close connections" };
  }

  const results: { userId: string; leadsScored: number; error?: string }[] = [];

  for (const config of activeConfigs) {
    try {
      const apiKey = await decrypt(config.api_key_encrypted);
      const result = await handleScoreAll(
        apiKey,
        config.user_id,
        dataClient,
        {},
      );
      results.push({ userId: config.user_id, leadsScored: result.leadsScored });
    } catch (err) {
      console.error(
        `[lead-heat-score] Failed for user ${config.user_id}:`,
        (err as Error).message,
      );
      results.push({
        userId: config.user_id,
        leadsScored: 0,
        error: (err as Error).message,
      });
    }
  }

  return {
    usersProcessed: results.length,
    results,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function computeSourceConversionRates(
  outcomes: { outcome_type: string; signals_at_outcome: LeadSignals | null }[],
): Map<string, number> {
  const sourceMap = new Map<string, { won: number; total: number }>();

  for (const o of outcomes) {
    const source = o.signals_at_outcome?.leadSource;
    if (!source) continue;
    const existing = sourceMap.get(source) ?? { won: 0, total: 0 };
    existing.total++;
    if (o.outcome_type === "won") existing.won++;
    sourceMap.set(source, existing);
  }

  const rates = new Map<string, number>();
  for (const [source, data] of sourceMap) {
    if (data.total >= 5) {
      rates.set(source, data.won / data.total);
    }
  }
  return rates;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN SERVE
// ═══════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    if (!action) {
      return jsonResponse({ error: "Missing action" }, 400, req);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const REMOTE_URL = Deno.env.get("REMOTE_SUPABASE_URL");
    const REMOTE_KEY = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY");
    const useLocalSupabaseDev =
      Deno.env.get("VITE_USE_LOCAL") === "true" ||
      isLoopbackValue(SUPABASE_URL) ||
      isLoopbackValue(req.url);
    const allowRemoteSupabaseDev =
      Deno.env.get("VITE_ALLOW_REMOTE_SUPABASE_DEV") === "true";
    const shouldUseRemoteDataClient =
      Boolean(REMOTE_URL && REMOTE_KEY) &&
      (allowRemoteSupabaseDev || !useLocalSupabaseDev);

    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const dataClient =
      shouldUseRemoteDataClient && REMOTE_URL && REMOTE_KEY
        ? createClient(REMOTE_URL, REMOTE_KEY)
        : authClient;

    // For cron (service-role calls), positively verify the caller sent the service_role key
    if (action === "score_all_users") {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s*/i, "").trim();
      if (!serviceKey || !token || token !== serviceKey) {
        console.warn(
          "[score_all_users] Rejected: missing or invalid service_role key",
        );
        return jsonResponse(
          { error: "Forbidden: service_role only" },
          403,
          req,
        );
      }
      const result = await handleScoreAllUsers(dataClient);
      return jsonResponse(result, 200, req);
    }

    // User-authenticated actions
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s*/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    // Dispatch action
    let result: unknown;

    switch (action) {
      case "score_all": {
        const envApiKey = Deno.env.get("CLOSE_API_KEY");
        let apiKey: string;

        if (envApiKey) {
          apiKey = envApiKey;
        } else {
          const { data: encryptedKey, error: rpcError } = await dataClient.rpc(
            "get_close_api_key",
            { p_user_id: user.id },
          );

          if (rpcError || !encryptedKey) {
            return jsonResponse(
              {
                error: "Close CRM not connected.",
                code: "CLOSE_NOT_CONNECTED",
              },
              400,
              req,
            );
          }

          try {
            apiKey = await decrypt(encryptedKey);
          } catch (decryptErr) {
            console.error(
              "[lead-heat-score] Failed to decrypt Close API key:",
              { userId: user.id, error: (decryptErr as Error).message },
            );
            return jsonResponse(
              {
                error:
                  "Close CRM configuration error. Please reconnect your Close account or contact your agency admin.",
                code: "CLOSE_DECRYPT_ERROR",
              },
              400,
              req,
            );
          }
        }
        result = await handleScoreAll(apiKey, user.id, dataClient, params);
        break;
      }
      case "analyze_lead": {
        const envApiKey = Deno.env.get("CLOSE_API_KEY");
        let apiKey: string;

        if (envApiKey) {
          apiKey = envApiKey;
        } else {
          const { data: encryptedKey, error: rpcError } = await dataClient.rpc(
            "get_close_api_key",
            { p_user_id: user.id },
          );

          if (rpcError || !encryptedKey) {
            return jsonResponse(
              {
                error: "Close CRM not connected.",
                code: "CLOSE_NOT_CONNECTED",
              },
              400,
              req,
            );
          }

          try {
            apiKey = await decrypt(encryptedKey);
          } catch (decryptErr) {
            console.error(
              "[lead-heat-score] Failed to decrypt Close API key:",
              { userId: user.id, error: (decryptErr as Error).message },
            );
            return jsonResponse(
              {
                error:
                  "Close CRM configuration error. Please reconnect your Close account or contact your agency admin.",
                code: "CLOSE_DECRYPT_ERROR",
              },
              400,
              req,
            );
          }
        }
        result = await handleAnalyzeLead(apiKey, user.id, dataClient, params);
        break;
      }
      case "get_portfolio_insights": {
        const portfolioAnalysis = await materializePortfolioInsights(
          user.id,
          dataClient,
        );
        result = portfolioAnalysis.analysis ?? emptyPortfolioInsightsRow();
        break;
      }
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400, req);
    }

    return jsonResponse(result, 200, req);
  } catch (err) {
    const error = err as Error & { code?: string; status?: number };
    const status = error.status ?? 500;
    console.error(
      `[lead-heat-score] ${error.code ?? "ERROR"}: ${error.message}`,
    );
    return jsonResponse(
      { error: error.message, code: error.code ?? "LEAD_HEAT_ERROR" },
      status,
      req,
    );
  }
});
