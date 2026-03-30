import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  dotenv.config({ path: envFile, override: false, quiet: true });
}

const LOCAL_SUPABASE_URL =
  process.env.LOCAL_SUPABASE_URL ||
  process.env.VITE_LOCAL_SUPABASE_URL ||
  "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_USER_EMAIL =
  process.env.CLOSE_KPI_AI_PORTFOLIO_EMAIL || "nickneessen@thestandardhq.com";
const PORTFOLIO_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_WEIGHTS = {
  callAnswerRate: { multiplier: 1.0 },
  emailReplyRate: { multiplier: 1.0 },
  smsResponseRate: { multiplier: 1.0 },
  engagementRecency: { multiplier: 1.0 },
  inboundCalls: { multiplier: 1.0 },
  quoteRequested: { multiplier: 1.0 },
  emailEngagement: { multiplier: 1.0 },
  appointment: { multiplier: 1.0 },
  leadAge: { multiplier: 1.0 },
  timeSinceTouch: { multiplier: 1.0 },
  timeInStatus: { multiplier: 1.0 },
  statusVelocity: { multiplier: 1.0 },
  hasOpportunity: { multiplier: 1.0 },
  opportunityValue: { multiplier: 1.0 },
  stageProgression: { multiplier: 1.0 },
  sourceQuality: { multiplier: 1.0 },
  similarLeadPattern: { multiplier: 1.0 },
};
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
const PORTFOLIO_SYSTEM_PROMPT = `You are an insurance sales analytics engine. You analyze an insurance agent's Close CRM lead portfolio metrics and return structured JSON recommendations.

You understand insurance sales dynamics:
- Lead source quality varies significantly (referrals > aged internet leads)
- Seasonal patterns affect conversion (AEP/OEP for Medicare, Q1 tax season for life)
- Call connect rates vary by time of day and lead type
- Inbound calls from leads are the strongest buying signal
- Speed to first contact strongly predicts conversion
- Insurance agents work high volumes; they need to focus on the right leads

Return ONLY valid JSON matching the requested schema. No markdown, no explanation, no code fences.`;

if (!LOCAL_SERVICE_ROLE_KEY) {
  throw new Error("Missing local Supabase service role key");
}
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY");
}

const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers(
  {
    page: 1,
    perPage: 200,
  },
);
if (usersError) throw usersError;

const user = usersPage.users.find((entry) => entry.email === DEFAULT_USER_EMAIL);
if (!user) {
  throw new Error(`Could not find local auth user for ${DEFAULT_USER_EMAIL}`);
}

const now = new Date();
const outcomesSince = new Date(
  now.getTime() - 90 * 24 * 60 * 60 * 1000,
).toISOString();

const [scoresResult, outcomesResult, weightsResult] = await Promise.all([
  supabase
    .from("lead_heat_scores")
    .select("close_lead_id, display_name, score, breakdown, signals")
    .eq("user_id", user.id),
  supabase
    .from("lead_heat_outcomes")
    .select("outcome_type, signals_at_outcome, breakdown_at_outcome")
    .eq("user_id", user.id)
    .gte("occurred_at", outcomesSince),
  supabase
    .from("lead_heat_agent_weights")
    .select("weights, version, sample_size")
    .eq("user_id", user.id)
    .maybeSingle(),
]);

if (scoresResult.error) throw scoresResult.error;
if (outcomesResult.error) throw outcomesResult.error;
if (weightsResult.error) throw weightsResult.error;

const weights = weightsResult.data?.weights ?? DEFAULT_WEIGHTS;
const scoredLeads = (scoresResult.data ?? [])
  .map((row) => ({
    closeLeadId: row.close_lead_id,
    displayName: row.display_name,
    score: row.score,
    breakdown: row.breakdown ?? {},
    signals: row.signals ?? {},
  }))
  .filter((row) => isRankableLead(row.signals));

if (scoredLeads.length < 10) {
  throw new Error(
    `Not enough rankable scored leads to analyze: ${scoredLeads.length}`,
  );
}

const portfolioSummary = buildPortfolioSummary(
  scoredLeads,
  outcomesResult.data ?? [],
  weights,
);
const { result, tokensUsed } = await analyzePortfolio(portfolioSummary);
const analyzedAt = now.toISOString();

const upsertResult = await supabase
  .from("lead_heat_ai_portfolio_analysis")
  .upsert(
    {
      user_id: user.id,
      analysis: {
        overall: result.overallAssessment ?? "",
        insights: result.insights ?? [],
      },
      anomalies: result.anomalies ?? [],
      recommendations: result.recommendations ?? [],
      weight_adjustments: result.weightAdjustments ?? [],
      model_used: PORTFOLIO_MODEL,
      tokens_used: tokensUsed,
      analyzed_at: analyzedAt,
      expires_at: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "user_id" },
  )
  .select("analysis, recommendations, anomalies, analyzed_at")
  .single();

if (upsertResult.error) throw upsertResult.error;

console.log(
  JSON.stringify(
    {
      userId: user.id,
      email: DEFAULT_USER_EMAIL,
      rankableLeads: scoredLeads.length,
      recommendations: result.recommendations?.length ?? 0,
      anomalies: result.anomalies?.length ?? 0,
      insights: result.insights?.length ?? 0,
      analyzedAt,
      preview: {
        overall: upsertResult.data.analysis?.overall ?? "",
      },
    },
    null,
    2,
  ),
);

function isRankableLead(signals) {
  if (!signals || typeof signals !== "object") return true;
  const currentStatusLabel =
    typeof signals.currentStatusLabel === "string"
      ? signals.currentStatusLabel.trim().toLowerCase()
      : "";
  const hasWonOpportunity = signals.hasWonOpportunity === true;

  return (
    !hasWonOpportunity &&
    !CLOSED_WON_STATUS_PATTERNS.some((pattern) =>
      currentStatusLabel.includes(pattern),
    )
  );
}

function buildPortfolioSummary(scoredLeads, outcomes, currentWeights) {
  const distribution = {
    hot: 0,
    warming: 0,
    neutral: 0,
    cooling: 0,
    cold: 0,
  };

  let totalScore = 0;
  let recentlyActive7d = 0;
  let stale30dPlus = 0;

  for (const lead of scoredLeads) {
    distribution[getHeatLevel(lead.score)]++;
    totalScore += lead.score;
    if (
      typeof lead.signals.daysSinceLastTouch === "number" &&
      lead.signals.daysSinceLastTouch <= 7
    ) {
      recentlyActive7d++;
    }
    if (
      typeof lead.signals.daysSinceAnyActivity === "number" &&
      lead.signals.daysSinceAnyActivity > 30
    ) {
      stale30dPlus++;
    }
  }

  const won90d = outcomes.filter((outcome) => outcome.outcome_type === "won").length;
  const lost90d = outcomes.filter((outcome) => outcome.outcome_type === "lost").length;
  const stagnant90d = outcomes.filter(
    (outcome) => outcome.outcome_type === "stagnant",
  ).length;
  const totalDecisions = won90d + lost90d;
  const conversionRate = totalDecisions > 0 ? won90d / totalDecisions : 0;

  const signalKeys = Object.keys(currentWeights);
  const signalCorrelations = {};
  for (const key of signalKeys) {
    const wonOutcomes = outcomes.filter(
      (outcome) =>
        outcome.outcome_type === "won" && outcome.breakdown_at_outcome,
    );
    const lostOutcomes = outcomes.filter(
      (outcome) =>
        outcome.outcome_type === "lost" && outcome.breakdown_at_outcome,
    );

    const wonAvg =
      wonOutcomes.length > 0
        ? wonOutcomes.reduce(
            (sum, outcome) =>
              sum + Number(outcome.breakdown_at_outcome?.[key] ?? 0),
            0,
          ) / wonOutcomes.length
        : 0;
    const lostAvg =
      lostOutcomes.length > 0
        ? lostOutcomes.reduce(
            (sum, outcome) =>
              sum + Number(outcome.breakdown_at_outcome?.[key] ?? 0),
            0,
          ) / lostOutcomes.length
        : 0;

    signalCorrelations[key] = {
      convertedAvg: wonAvg,
      lostAvg,
      lift: lostAvg > 0 ? wonAvg / lostAvg : wonAvg > 0 ? 2.0 : 1.0,
    };
  }

  const sourceMap = new Map();
  for (const lead of scoredLeads) {
    const source = lead.signals.leadSource ?? "Unknown";
    const current = sourceMap.get(source) ?? {
      won: 0,
      lost: 0,
      totalScore: 0,
      count: 0,
    };
    current.totalScore += lead.score;
    current.count++;
    sourceMap.set(source, current);
  }
  for (const outcome of outcomes) {
    const source = outcome.signals_at_outcome?.leadSource ?? "Unknown";
    const current = sourceMap.get(source);
    if (!current) continue;
    if (outcome.outcome_type === "won") current.won++;
    if (outcome.outcome_type === "lost") current.lost++;
  }

  const leadSourcePerformance = Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      conversionRate:
        data.won + data.lost > 0 ? data.won / (data.won + data.lost) : 0,
      avgScore: data.count > 0 ? data.totalScore / data.count : 0,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byScore = [...scoredLeads].sort((a, b) => b.score - a.score);
  const topHotLeads = byScore.slice(0, 10).map((lead) => ({
    name: lead.signals.displayName ?? lead.displayName ?? "Unknown",
    score: lead.score,
    lastTouch: lead.signals.lastActivityAt ?? null,
  }));
  const topColdLeads = byScore.slice(-10).map((lead) => ({
    name: lead.signals.displayName ?? lead.displayName ?? "Unknown",
    score: lead.score,
    lastTouch: lead.signals.lastActivityAt ?? null,
  }));

  return {
    totalLeads: scoredLeads.length,
    distribution,
    avgScore: scoredLeads.length > 0 ? totalScore / scoredLeads.length : 0,
    recentlyActive7d,
    stale30dPlus,
    conversionRate,
    outcomes90d: {
      won: won90d,
      lost: lost90d,
      stagnant: stagnant90d,
    },
    signalCorrelations,
    leadSourcePerformance,
    currentWeights,
    topHotLeads,
    topColdLeads,
  };
}

function getHeatLevel(score) {
  if (score >= 80) return "hot";
  if (score >= 60) return "warming";
  if (score >= 40) return "neutral";
  if (score >= 20) return "cooling";
  return "cold";
}

function buildPortfolioPrompt(summary) {
  return `Analyze this insurance agent's lead scoring performance and recommend weight adjustments.

## Portfolio Summary
- Total leads: ${summary.totalLeads}
- Score distribution: Hot=${summary.distribution.hot}, Warming=${summary.distribution.warming}, Neutral=${summary.distribution.neutral}, Cooling=${summary.distribution.cooling}, Cold=${summary.distribution.cold}
- Average score: ${summary.avgScore.toFixed(1)}
- Active in last 7 days: ${summary.recentlyActive7d}
- Stale (30+ days no activity): ${summary.stale30dPlus}

## Recent Outcomes (last 90 days)
- Won: ${summary.outcomes90d.won}
- Lost: ${summary.outcomes90d.lost}
- Stagnant: ${summary.outcomes90d.stagnant}
- Conversion rate: ${(summary.conversionRate * 100).toFixed(1)}%

## Signal Correlation with Conversions
${Object.entries(summary.signalCorrelations)
  .map(
    ([key, value]) =>
      `- ${key}: converted avg=${value.convertedAvg.toFixed(1)}, lost avg=${value.lostAvg.toFixed(1)}, lift=${value.lift.toFixed(2)}x`,
  )
  .join("\n")}

## Lead Source Performance
${summary.leadSourcePerformance
  .map(
    (source) =>
      `- ${source.source}: ${(source.conversionRate * 100).toFixed(1)}% conversion, avg score ${source.avgScore.toFixed(0)}, ${source.count} leads`,
  )
  .join("\n")}

## Current Weight Profile
${Object.entries(summary.currentWeights)
  .map(([key, value]) => `- ${key}: ${value.multiplier}x`)
  .join("\n")}

## Top Hot Leads (for anomaly check)
${summary.topHotLeads.map((lead) => `- ${lead.name}: score ${lead.score}, last touch ${lead.lastTouch ?? "never"}`).join("\n")}

## Top Cold Leads (for hidden gem check)
${summary.topColdLeads.map((lead) => `- ${lead.name}: score ${lead.score}, last touch ${lead.lastTouch ?? "never"}`).join("\n")}

Keep the response compact:
- Maximum 3 weightAdjustments
- Maximum 4 insights
- Maximum 4 anomalies
- Maximum 4 recommendations

Return JSON matching this exact schema:
{
  "weightAdjustments": [{ "signalKey": "string", "recommendedMultiplier": number, "reason": "string" }],
  "insights": [{ "type": "pattern|anomaly|recommendation", "title": "string", "description": "string", "priority": "high|medium|low" }],
  "anomalies": [{ "closeLeadId": "string", "displayName": "string", "type": "hot_ignored|cold_surprise|stale_hot|hidden_gem", "message": "string", "urgency": "high|medium|low", "score": number }],
  "recommendations": [{ "text": "string", "priority": "high|medium|low" }],
  "overallAssessment": "string (1-2 sentences)"
}`;
}

async function analyzePortfolio(summary) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: PORTFOLIO_MODEL,
      max_tokens: 2048,
      system: PORTFOLIO_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPortfolioPrompt(summary) }],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `Anthropic ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`,
    );
  }

  const text = (payload.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const result = parseStructuredJson(text);
  const tokensUsed =
    Number(payload.usage?.input_tokens ?? 0) +
    Number(payload.usage?.output_tokens ?? 0);

  return { result, tokensUsed };
}

function parseStructuredJson(text) {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const objectMatch = unfenced.match(/\{[\s\S]*\}$/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error(`AI returned invalid JSON: ${trimmed.slice(0, 200)}`);
  }
}
