import process from "node:process";
import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;

const ROOT = process.cwd();

for (const envFile of [".env.local", ".env"]) {
  dotenv.config({
    path: path.join(ROOT, envFile),
    override: false,
  });
}

const LOCAL_DB_URL =
  process.env.LOCAL_DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SOURCE_USER_ID =
  process.env.CLOSE_KPI_SOURCE_USER_ID || process.env.USER_ID;
const TARGET_USER_ID =
  process.env.CLOSE_KPI_TARGET_USER_ID ||
  "11111111-1111-4111-8111-111111111111";

if (!SOURCE_USER_ID) {
  console.error(
    "Missing CLOSE_KPI_SOURCE_USER_ID or USER_ID. Cannot identify the populated source user.",
  );
  process.exit(1);
}

const client = new Client({ connectionString: LOCAL_DB_URL });

async function replaceCloseConfig(sourceUserId, targetUserId) {
  await client.query("delete from public.close_config where user_id = $1", [
    targetUserId,
  ]);

  const result = await client.query(
    `
      insert into public.close_config (
        id,
        user_id,
        api_key_encrypted,
        created_at,
        is_active,
        last_verified_at,
        organization_id,
        organization_name,
        updated_at
      )
      select
        gen_random_uuid(),
        $2,
        api_key_encrypted,
        created_at,
        is_active,
        last_verified_at,
        organization_id,
        organization_name,
        updated_at
      from public.close_config
      where user_id = $1
    `,
    [sourceUserId, targetUserId],
  );

  return result.rowCount ?? 0;
}

async function replaceLeadHeatScores(sourceUserId, targetUserId) {
  await client.query("delete from public.lead_heat_scores where user_id = $1", [
    targetUserId,
  ]);

  const result = await client.query(
    `
      insert into public.lead_heat_scores (
        id,
        user_id,
        close_lead_id,
        display_name,
        score,
        heat_level,
        trend,
        previous_score,
        breakdown,
        signals,
        ai_insights,
        scored_at,
        created_at,
        updated_at
      )
      select
        gen_random_uuid(),
        $2,
        close_lead_id,
        display_name,
        score,
        heat_level,
        trend,
        previous_score,
        breakdown,
        signals,
        ai_insights,
        scored_at,
        created_at,
        updated_at
      from public.lead_heat_scores
      where user_id = $1
    `,
    [sourceUserId, targetUserId],
  );

  return result.rowCount ?? 0;
}

async function replaceLeadHeatOutcomes(sourceUserId, targetUserId) {
  await client.query(
    "delete from public.lead_heat_outcomes where user_id = $1",
    [targetUserId],
  );

  const result = await client.query(
    `
      insert into public.lead_heat_outcomes (
        id,
        user_id,
        close_lead_id,
        outcome_type,
        score_at_outcome,
        breakdown_at_outcome,
        signals_at_outcome,
        close_opp_id,
        opp_value,
        occurred_at,
        metadata,
        created_at
      )
      select
        gen_random_uuid(),
        $2,
        close_lead_id,
        outcome_type,
        score_at_outcome,
        breakdown_at_outcome,
        signals_at_outcome,
        close_opp_id,
        opp_value,
        occurred_at,
        metadata,
        created_at
      from public.lead_heat_outcomes
      where user_id = $1
    `,
    [sourceUserId, targetUserId],
  );

  return result.rowCount ?? 0;
}

async function replaceLeadHeatAgentWeights(sourceUserId, targetUserId) {
  await client.query(
    "delete from public.lead_heat_agent_weights where user_id = $1",
    [targetUserId],
  );

  const result = await client.query(
    `
      insert into public.lead_heat_agent_weights (
        id,
        user_id,
        weights,
        version,
        sample_size,
        last_trained_at,
        created_at,
        updated_at
      )
      select
        gen_random_uuid(),
        $2,
        weights,
        version,
        sample_size,
        last_trained_at,
        created_at,
        updated_at
      from public.lead_heat_agent_weights
      where user_id = $1
    `,
    [sourceUserId, targetUserId],
  );

  return result.rowCount ?? 0;
}

async function replaceLeadHeatPortfolioAnalysis(sourceUserId, targetUserId) {
  await client.query(
    "delete from public.lead_heat_ai_portfolio_analysis where user_id = $1",
    [targetUserId],
  );

  const result = await client.query(
    `
      insert into public.lead_heat_ai_portfolio_analysis (
        id,
        user_id,
        analysis,
        anomalies,
        recommendations,
        weight_adjustments,
        model_used,
        tokens_used,
        analyzed_at,
        expires_at
      )
      select
        gen_random_uuid(),
        $2,
        analysis,
        anomalies,
        recommendations,
        weight_adjustments,
        model_used,
        tokens_used,
        analyzed_at,
        expires_at
      from public.lead_heat_ai_portfolio_analysis
      where user_id = $1
    `,
    [sourceUserId, targetUserId],
  );

  return result.rowCount ?? 0;
}

async function replaceLeadHeatScoringRuns(sourceUserId, targetUserId) {
  await client.query(
    "delete from public.lead_heat_scoring_runs where user_id = $1",
    [targetUserId],
  );

  const result = await client.query(
    `
      insert into public.lead_heat_scoring_runs (
        id,
        user_id,
        run_type,
        status,
        started_at,
        completed_at,
        leads_scored,
        leads_total,
        ai_calls_made,
        duration_ms,
        error_message
      )
      select
        gen_random_uuid(),
        $2,
        run_type,
        status,
        started_at,
        completed_at,
        leads_scored,
        leads_total,
        ai_calls_made,
        duration_ms,
        error_message
      from public.lead_heat_scoring_runs
      where user_id = $1
    `,
    [sourceUserId, targetUserId],
  );

  return result.rowCount ?? 0;
}

async function clearCloseKpiCache(targetUserId) {
  const result = await client.query(
    "delete from public.close_kpi_cache where user_id = $1",
    [targetUserId],
  );
  return result.rowCount ?? 0;
}

await client.connect();

try {
  await client.query("begin");

  const summary = {
    close_config: await replaceCloseConfig(SOURCE_USER_ID, TARGET_USER_ID),
    lead_heat_scores: await replaceLeadHeatScores(
      SOURCE_USER_ID,
      TARGET_USER_ID,
    ),
    lead_heat_outcomes: await replaceLeadHeatOutcomes(
      SOURCE_USER_ID,
      TARGET_USER_ID,
    ),
    lead_heat_agent_weights: await replaceLeadHeatAgentWeights(
      SOURCE_USER_ID,
      TARGET_USER_ID,
    ),
    lead_heat_ai_portfolio_analysis: await replaceLeadHeatPortfolioAnalysis(
      SOURCE_USER_ID,
      TARGET_USER_ID,
    ),
    lead_heat_scoring_runs: await replaceLeadHeatScoringRuns(
      SOURCE_USER_ID,
      TARGET_USER_ID,
    ),
    close_kpi_cache_cleared: await clearCloseKpiCache(TARGET_USER_ID),
  };

  await client.query("commit");

  console.log("Close KPI local user sync complete.");
  console.log(`source_user_id=${SOURCE_USER_ID}`);
  console.log(`target_user_id=${TARGET_USER_ID}`);
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}=${value}`);
  }
} catch (error) {
  await client.query("rollback");
  console.error("Close KPI local user sync failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
