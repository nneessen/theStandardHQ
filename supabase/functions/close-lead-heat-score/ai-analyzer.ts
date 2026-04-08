// supabase/functions/close-lead-heat-score/ai-analyzer.ts
// AI integration for lead heat scoring: portfolio analysis (Haiku) + per-lead deep dive (Sonnet).
// Follows the Anthropic SDK pattern from underwriting-ai-analyze/index.ts.

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";
import type {
  HeatLevel,
  LeadSignals,
  ScoreBreakdown,
  PortfolioAnalysisResult,
  LeadDeepDiveResult,
  AgentWeights,
} from "./types.ts";

// ─── Config ───────────────────────────────────────────────────────────

const PORTFOLIO_MODEL = "claude-sonnet-4-6";
const DEEP_DIVE_MODEL = "claude-sonnet-4-6";
const MAX_PORTFOLIO_TOKENS = 4096;
// Bumped from 1024 after production truncation: Sonnet was wrapping responses
// in ```json fences and writing long narratives, blowing past 1024 mid-string
// and leaving the JSON unterminated. 2048 gives comfortable headroom for the
// full deep-dive schema even when the narrative is verbose.
const MAX_DEEP_DIVE_TOKENS = 2048;

// A lead source is considered "active" if at least one lead from that source
// has been imported within this many days. Sources without recent imports are
// excluded from AI portfolio analysis so the AI doesn't recommend strategy
// around sources the user has retired (e.g., stopped buying lead lists from).
// Shared with index.ts so the per-lead sourceQuality signal uses the same definition.
export const SOURCE_ACTIVE_WINDOW_DAYS = 90;

// ─── Anthropic Client ─────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey });
}

// ═══════════════════════════════════════════════════════════════════════
// TIER 2: PORTFOLIO ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

interface PortfolioSummary {
  totalLeads: number;
  distribution: Record<HeatLevel, number>;
  avgScore: number;
  recentlyActive7d: number;
  stale30dPlus: number;
  conversionRate: number;
  outcomes90d: {
    won: number;
    lost: number;
    stagnant: number;
  };
  signalCorrelations: Record<
    string,
    { convertedAvg: number; lostAvg: number; lift: number }
  >;
  leadSourcePerformance: {
    source: string;
    conversionRate: number;
    avgScore: number;
    count: number;
  }[];
  // Sources with at least one lead imported in the last SOURCE_ACTIVE_WINDOW_DAYS.
  // The AI is told to only recommend strategy around these — anything else is
  // historical context for sources the user has stopped using.
  activeSources: string[];
  currentWeights: AgentWeights;
  topHotLeads: { name: string; score: number; lastTouch: string | null }[];
  topColdLeads: { name: string; score: number; lastTouch: string | null }[];
}

const PORTFOLIO_SYSTEM_PROMPT = `You are an insurance sales analytics engine. You analyze an insurance agent's Close CRM lead portfolio metrics and return structured JSON recommendations.

You understand insurance sales dynamics:
- Lead source quality varies significantly (referrals > aged internet leads)
- Seasonal patterns affect conversion (AEP/OEP for Medicare, Q1 tax season for life)
- Call connect rates vary by time of day and lead type
- Inbound calls from leads are the strongest buying signal
- Speed to first contact strongly predicts conversion
- Insurance agents work high volumes; they need to focus on the right leads

Return ONLY valid JSON matching the requested schema. Keep strings concise. No markdown, no explanation, no code fences.`;

function buildPortfolioPrompt(summary: PortfolioSummary): string {
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
    ([key, val]) =>
      `- ${key}: converted avg=${val.convertedAvg.toFixed(1)}, lost avg=${val.lostAvg.toFixed(1)}, lift=${val.lift.toFixed(2)}x`,
  )
  .join("\n")}

## Active Lead Sources (last ${SOURCE_ACTIVE_WINDOW_DAYS} days)
${summary.activeSources.length > 0 ? summary.activeSources.join(", ") : "None detected"}

IMPORTANT: Only make strategic recommendations about sources listed above as active.
Sources NOT in the active list are historical context — the user has stopped
importing leads from them. Do not recommend doubling down on, focusing on, or
pausing sources the user has already retired. If the active list is empty or
contains only one source, focus your recommendations on signal weights and
per-lead actions, not source allocation.

## Lead Source Performance (active sources only)
${
  summary.leadSourcePerformance.length > 0
    ? summary.leadSourcePerformance
        .map(
          (s) =>
            `- ${s.source}: ${(s.conversionRate * 100).toFixed(1)}% conversion, avg score ${s.avgScore.toFixed(0)}, ${s.count} leads`,
        )
        .join("\n")
    : "- (no active sources with sufficient data)"
}

## Current Weight Profile
${Object.entries(summary.currentWeights)
  .map(([key, val]) => `- ${key}: ${val.multiplier}x`)
  .join("\n")}

## Top Hot Leads (for anomaly check)
${summary.topHotLeads.map((l) => `- ${l.name}: score ${l.score}, last touch ${l.lastTouch ?? "never"}`).join("\n")}

## Top Cold Leads (for hidden gem check)
${summary.topColdLeads.map((l) => `- ${l.name}: score ${l.score}, last touch ${l.lastTouch ?? "never"}`).join("\n")}

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

function parseStructuredJson<T>(text: string): T {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  const jsonText =
    firstBrace !== -1 && lastBrace > firstBrace
      ? candidate.slice(firstBrace, lastBrace + 1).trim()
      : candidate;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    // Include BOTH head and tail so truncation (unterminated string/object)
    // is diagnosable from logs. The old error showed only the first 200 chars
    // which hid mid-response cutoffs behind what looked like valid JSON.
    const head = trimmed.slice(0, 200);
    const tail = trimmed.length > 400 ? ` ... ${trimmed.slice(-200)}` : "";
    throw new Error(`AI returned invalid JSON: ${head}${tail}`);
  }
}

export async function analyzePortfolio(
  summary: PortfolioSummary,
): Promise<{ result: PortfolioAnalysisResult; tokensUsed: number }> {
  const client = getAnthropicClient();
  const userPrompt = buildPortfolioPrompt(summary);

  const response = await client.messages.create({
    model: PORTFOLIO_MODEL,
    max_tokens: MAX_PORTFOLIO_TOKENS,
    system: PORTFOLIO_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter(
      (block): block is { type: "text"; text: string } =>
        block.type === "text" && "text" in block,
    )
    .map((block) => block.text)
    .join("");

  const tokensUsed =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  const parsed = parseStructuredJson<PortfolioAnalysisResult>(text);

  // Runtime validation: ensure expected shapes (LLM output is untrusted)
  if (!Array.isArray(parsed.weightAdjustments)) parsed.weightAdjustments = [];
  if (!Array.isArray(parsed.insights)) parsed.insights = [];
  if (!Array.isArray(parsed.anomalies)) parsed.anomalies = [];
  if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];
  if (typeof parsed.overallAssessment !== "string")
    parsed.overallAssessment = "";

  // Validate weight adjustments are bounded
  parsed.weightAdjustments = parsed.weightAdjustments.filter(
    (wa) =>
      typeof wa?.recommendedMultiplier === "number" &&
      wa.recommendedMultiplier >= 0.3 &&
      wa.recommendedMultiplier <= 2.0,
  );

  return { result: parsed, tokensUsed };
}

// ═══════════════════════════════════════════════════════════════════════
// TIER 3: PER-LEAD DEEP DIVE
// ═══════════════════════════════════════════════════════════════════════

interface LeadDeepDiveInput {
  displayName: string;
  score: number;
  heatLevel: HeatLevel;
  breakdown: ScoreBreakdown;
  signals: LeadSignals;
  activityTimeline: {
    date: string;
    type: string;
    description: string;
  }[];
}

const DEEP_DIVE_SYSTEM_PROMPT = `You are an insurance sales advisor analyzing a single lead's history to help an agent prioritize their time. Provide actionable, specific recommendations.

You understand:
- Insurance lead behavior patterns and buying signals
- The difference between a lead going cold vs. being a slow decision maker
- That agents have limited time and need clear prioritization guidance
- Compliance: never recommend discriminatory prioritization based on protected characteristics

CRITICAL OUTPUT RULES:
- Return ONLY a raw JSON object matching the schema.
- Do NOT wrap the response in markdown code fences (no \`\`\`json or \`\`\`).
- Do NOT prefix or suffix the JSON with any explanatory text.
- Keep the narrative concise (2-4 sentences) to stay within the token budget.`;

function buildDeepDivePrompt(input: LeadDeepDiveInput): string {
  return `Analyze this lead and provide scoring insights and recommended actions.

## Lead Overview
- Name: ${input.displayName}
- Current Score: ${input.score}/100 (${input.heatLevel})
- Status: ${input.signals.currentStatusLabel}
- Source: ${input.signals.leadSource ?? "Unknown"}
- Created: ${input.signals.dateCreated} (${input.signals.daysSinceCreation.toFixed(0)} days ago)

## Score Breakdown
${Object.entries(input.breakdown)
  .map(([key, val]) => `- ${key}: ${val}`)
  .join("\n")}

## Activity Timeline (most recent first, last 50)
${
  input.activityTimeline
    .slice(0, 50)
    .map((a) => `- [${a.date}] ${a.type}: ${a.description}`)
    .join("\n") || "No activities recorded"
}

Return JSON matching this exact schema. Start your response with "{" and nothing else:
{
  "adjustedScore": number (0-100 integer),
  "confidence": number (decimal between 0 and 1, e.g. 0.75 means 75% confident — NOT 75),
  "heatLevel": "hot|warming|neutral|cooling|cold",
  "narrative": "string (2-4 sentences max — keep it tight)",
  "keySignals": [{ "signal": "string", "impact": "positive|negative|neutral", "detail": "string" }],
  "recommendedAction": { "action": "string", "timing": "string", "reasoning": "string" },
  "riskFactors": ["string"],
  "conversionProbability": "high|medium|low|very_low"
}`;
}

export async function analyzeLeadDeepDive(
  input: LeadDeepDiveInput,
): Promise<{ result: LeadDeepDiveResult; tokensUsed: number }> {
  const client = getAnthropicClient();
  const userPrompt = buildDeepDivePrompt(input);

  // Prefill the assistant turn with "{" to physically prevent Sonnet from
  // emitting a ```json code fence. The model is forced to continue from the
  // opening brace, so the first tokens it produces are inside the JSON body.
  // We have to prepend "{" back onto the response text before parsing since
  // the prefill itself is not included in content blocks.
  const response = await client.messages.create({
    model: DEEP_DIVE_MODEL,
    max_tokens: MAX_DEEP_DIVE_TOKENS,
    system: DEEP_DIVE_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userPrompt },
      { role: "assistant", content: "{" },
    ],
  });

  const rawText = response.content
    .filter(
      (block): block is { type: "text"; text: string } =>
        block.type === "text" && "text" in block,
    )
    .map((block) => block.text)
    .join("");

  const tokensUsed =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  // Fail fast with a specific error if Anthropic truncated us at the token
  // limit. Without this check, the user saw "AI returned invalid JSON: ..."
  // which was confusing because the fragment looked like valid JSON.
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "AI response was truncated before completing. Try again, or reduce the lead's activity history if this keeps happening.",
    );
  }

  const text = `{${rawText}`;
  const parsed = parseStructuredJson<LeadDeepDiveResult>(text);

  // Runtime validation: ensure expected shapes (LLM output is untrusted)
  const VALID_HEAT = new Set(["hot", "warming", "neutral", "cooling", "cold"]);
  if (!VALID_HEAT.has(parsed.heatLevel))
    parsed.heatLevel = "neutral" as HeatLevel;
  if (typeof parsed.adjustedScore !== "number" || isNaN(parsed.adjustedScore))
    parsed.adjustedScore = input.score;
  if (typeof parsed.confidence !== "number" || isNaN(parsed.confidence))
    parsed.confidence = 0.5;
  if (typeof parsed.narrative !== "string") parsed.narrative = "";
  if (!Array.isArray(parsed.keySignals)) parsed.keySignals = [];
  if (!parsed.recommendedAction || typeof parsed.recommendedAction !== "object")
    parsed.recommendedAction = { action: "", timing: "", reasoning: "" };
  if (!Array.isArray(parsed.riskFactors)) parsed.riskFactors = [];
  const VALID_PROB = new Set(["high", "medium", "low", "very_low"]);
  if (!VALID_PROB.has(parsed.conversionProbability))
    parsed.conversionProbability = "medium";

  // Clamp adjusted score to valid range
  parsed.adjustedScore = Math.max(
    0,
    Math.min(100, Math.round(parsed.adjustedScore)),
  );
  // Sonnet sometimes returns confidence as 0-100 instead of 0-1 despite the
  // schema saying "decimal between 0 and 1". If the value is clearly on a
  // percentage scale, rescale it before clamping so the UI doesn't silently
  // render 100% confidence for every lead (which is what happened when the
  // bare clamp turned 72 → 1).
  if (parsed.confidence > 1) {
    parsed.confidence = parsed.confidence / 100;
  }
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

  return { result: parsed, tokensUsed };
}

// ═══════════════════════════════════════════════════════════════════════
// PORTFOLIO SUMMARY BUILDER (aggregates from scored leads)
// ═══════════════════════════════════════════════════════════════════════

export function buildPortfolioSummary(
  scoredLeads: {
    score: number;
    heatLevel: HeatLevel;
    signals: LeadSignals;
    breakdown: ScoreBreakdown;
  }[],
  outcomes: {
    outcome_type: string;
    signals_at_outcome: LeadSignals | null;
    breakdown_at_outcome: ScoreBreakdown | null;
  }[],
  currentWeights: AgentWeights,
): PortfolioSummary {
  const distribution: Record<HeatLevel, number> = {
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
    distribution[lead.heatLevel]++;
    totalScore += lead.score;
    if (
      lead.signals.daysSinceLastTouch !== null &&
      lead.signals.daysSinceLastTouch <= 7
    ) {
      recentlyActive7d++;
    }
    if (
      lead.signals.daysSinceAnyActivity !== null &&
      lead.signals.daysSinceAnyActivity > 30
    ) {
      stale30dPlus++;
    }
  }

  // Outcomes analysis
  const won90d = outcomes.filter((o) => o.outcome_type === "won").length;
  const lost90d = outcomes.filter((o) => o.outcome_type === "lost").length;
  const stagnant90d = outcomes.filter(
    (o) => o.outcome_type === "stagnant",
  ).length;
  const totalDecisions = won90d + lost90d;
  const conversionRate = totalDecisions > 0 ? won90d / totalDecisions : 0;

  // Signal correlations (compare signal values for converted vs lost leads)
  const signalKeys = Object.keys(currentWeights);
  const signalCorrelations: Record<
    string,
    { convertedAvg: number; lostAvg: number; lift: number }
  > = {};

  for (const key of signalKeys) {
    const wonOutcomes = outcomes.filter(
      (o) => o.outcome_type === "won" && o.breakdown_at_outcome,
    );
    const lostOutcomes = outcomes.filter(
      (o) => o.outcome_type === "lost" && o.breakdown_at_outcome,
    );

    // deno-lint-ignore no-explicit-any
    const wonAvg =
      wonOutcomes.length > 0
        ? wonOutcomes.reduce(
            (sum, o) => sum + ((o.breakdown_at_outcome as any)?.[key] ?? 0),
            0,
          ) / wonOutcomes.length
        : 0;
    // deno-lint-ignore no-explicit-any
    const lostAvg =
      lostOutcomes.length > 0
        ? lostOutcomes.reduce(
            (sum, o) => sum + ((o.breakdown_at_outcome as any)?.[key] ?? 0),
            0,
          ) / lostOutcomes.length
        : 0;

    const lift = lostAvg > 0 ? wonAvg / lostAvg : wonAvg > 0 ? 2.0 : 1.0;
    signalCorrelations[key] = { convertedAvg: wonAvg, lostAvg, lift };
  }

  // Lead source performance — only count sources that are still actively
  // being imported. A source is "active" if at least one of its leads has
  // been created within SOURCE_ACTIVE_WINDOW_DAYS. This auto-retires sources
  // when the user stops buying lists from them, without requiring any UI or
  // manual lifecycle management. Old leads from retired sources stay in the
  // scores table (they may still convert) but they no longer pollute the
  // AI's strategic recommendations about which source to focus on.
  const activeSourceSet = new Set<string>();
  for (const lead of scoredLeads) {
    const source = lead.signals.leadSource;
    if (!source) continue;
    if (lead.signals.daysSinceCreation <= SOURCE_ACTIVE_WINDOW_DAYS) {
      activeSourceSet.add(source);
    }
  }

  const sourceMap = new Map<
    string,
    { won: number; lost: number; totalScore: number; count: number }
  >();
  for (const lead of scoredLeads) {
    const source = lead.signals.leadSource ?? "Unknown";
    // Skip sources the user has retired. "Unknown" is always included so
    // leads with no source label still show up in the breakdown.
    if (source !== "Unknown" && !activeSourceSet.has(source)) continue;
    const existing = sourceMap.get(source) ?? {
      won: 0,
      lost: 0,
      totalScore: 0,
      count: 0,
    };
    existing.totalScore += lead.score;
    existing.count++;
    sourceMap.set(source, existing);
  }
  // Merge outcome data — but only for sources we kept above. Won/lost from
  // retired sources is historical noise and would inflate the AI's confidence
  // in recommending strategy around dead inventory.
  for (const outcome of outcomes) {
    if (outcome.signals_at_outcome) {
      const source = outcome.signals_at_outcome.leadSource ?? "Unknown";
      const existing = sourceMap.get(source);
      if (existing) {
        if (outcome.outcome_type === "won") existing.won++;
        if (outcome.outcome_type === "lost") existing.lost++;
      }
    }
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

  const activeSources = Array.from(activeSourceSet).sort();

  // Top hot and cold leads for anomaly checks
  const sorted = [...scoredLeads].sort((a, b) => b.score - a.score);
  // Anonymize lead names in the portfolio prompt to avoid sending PII to the LLM.
  // The LLM sees "Lead #1", "Lead #2", etc. Real names are mapped back via closeLeadId.
  const topHotLeads = sorted.slice(0, 10).map((l, i) => ({
    name: `Lead #${i + 1}`,
    score: l.score,
    lastTouch: l.signals.lastActivityAt,
  }));
  const topColdLeads = sorted.slice(-10).map((l, i) => ({
    name: `Cold Lead #${i + 1}`,
    score: l.score,
    lastTouch: l.signals.lastActivityAt,
  }));

  return {
    totalLeads: scoredLeads.length,
    distribution,
    avgScore: scoredLeads.length > 0 ? totalScore / scoredLeads.length : 0,
    recentlyActive7d,
    stale30dPlus,
    conversionRate,
    outcomes90d: { won: won90d, lost: lost90d, stagnant: stagnant90d },
    signalCorrelations,
    leadSourcePerformance,
    activeSources,
    currentWeights,
    topHotLeads,
    topColdLeads,
  };
}
