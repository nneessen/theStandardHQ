// supabase/functions/extract-underwriting-rules/index.ts
//
// Phase 3 — Rule Population Pipeline
//
// Extracts v2-shaped underwriting rules from a parsed guide and writes them
// directly into underwriting_rule_sets + underwriting_rules with
// review_status='pending_review'. The runtime engine ignores pending sets
// (loadApprovedRuleSets only loads 'approved'), so candidates are safe to
// persist before human review.
//
// Why no separate staging table: the existing v2 schema already supports
// the review workflow via review_status enum + source='ai_extracted' +
// source_guide_id provenance + extraction_confidence/source_pages/snippet
// on each rule. Introducing a candidate table would duplicate the schema
// without adding capability.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// REQUEST/RESPONSE SHAPES
// =============================================================================

interface ExtractionRequest {
  guideId: string;
  productId?: string | null;
}

interface ParsedGuideContent {
  fullText: string;
  sections: Array<{ pageNumber: number; content: string }>;
  pageCount: number;
}

// =============================================================================
// PREDICATE DSL — must match src/services/underwriting/core/ruleEngineDSL.ts
// =============================================================================

type EligibilityStatus = "eligible" | "ineligible" | "refer";
type HealthClass =
  | "preferred_plus"
  | "preferred"
  | "standard_plus"
  | "standard"
  | "substandard"
  | "graded"
  | "modified"
  | "guaranteed_issue"
  | "refer"
  | "decline"
  | "unknown";
type TableRating =
  | "none"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P";

interface ExtractedRule {
  name: string;
  description?: string;
  priority: number;
  age_band_min?: number | null;
  age_band_max?: number | null;
  gender?: "male" | "female" | null;
  predicate: { version: 2; root: Record<string, unknown> };
  outcome_eligibility: EligibilityStatus;
  outcome_health_class: HealthClass;
  outcome_table_rating?: TableRating;
  outcome_flat_extra_per_thousand?: number | null;
  outcome_flat_extra_years?: number | null;
  outcome_reason: string;
  outcome_concerns?: string[];
  extraction_confidence?: number;
  source_pages?: number[];
  source_snippet?: string;
}

interface ExtractedRuleSet {
  scope: "condition" | "global";
  condition_code?: string | null;
  name: string;
  description?: string | null;
  rules: ExtractedRule[];
}

interface ClaudeOutput {
  rule_sets: ExtractedRuleSet[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_PROMPT_CONTENT_CHARS = 90000; // ~22k tokens of guide content
const MIN_VALID_CONTENT_LENGTH = 5000;
const MAX_RULES_PER_SET = 25;
const MAX_TOTAL_RULES_PER_RUN = 200;

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      return errorResponse("ANTHROPIC_API_KEY not configured", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Auth: confirm user + admin role + IMO
    const { data: userData, error: userError } =
      await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return errorResponse("Unauthorized: invalid session", 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, imo_id, roles")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.imo_id) {
      return errorResponse("Unauthorized: user has no IMO assigned", 403);
    }

    const allowedRoles = ["admin", "super-admin"];
    const hasAdminRole = (profile.roles as string[] | null)?.some((r) =>
      allowedRoles.includes(r),
    );
    if (!hasAdminRole) {
      return errorResponse("Unauthorized: admin role required", 403);
    }

    const imoId = profile.imo_id as string;
    const userId = profile.id as string;

    // Parse + validate request
    const body: ExtractionRequest = await req.json();
    const { guideId, productId } = body;

    if (!guideId || typeof guideId !== "string") {
      return errorResponse("Missing or invalid guideId", 400);
    }

    // Fetch guide + parsed content (tenant-scoped via imo_id)
    const { data: guide, error: guideError } = await supabase
      .from("underwriting_guides")
      .select("id, name, carrier_id, imo_id, parsing_status, parsed_content")
      .eq("id", guideId)
      .eq("imo_id", imoId)
      .single();

    if (guideError || !guide) {
      return errorResponse("Guide not found or access denied", 404);
    }

    if (guide.parsing_status !== "completed") {
      return errorResponse(
        `Guide parsing incomplete (status: ${guide.parsing_status}). Wait for parse-underwriting-guide to finish.`,
        400,
      );
    }

    const parsedContent = parseGuideContent(guide.parsed_content);
    if (!parsedContent) {
      return errorResponse(
        "Guide parsed_content is missing or malformed.",
        400,
      );
    }
    if (parsedContent.fullText.length < MIN_VALID_CONTENT_LENGTH) {
      return errorResponse(
        `Guide content too short (${parsedContent.fullText.length} chars, minimum ${MIN_VALID_CONTENT_LENGTH}).`,
        400,
      );
    }

    // Fetch valid condition codes (so AI uses real codes, not hallucinated ones)
    const { data: conditionRows, error: conditionsError } = await supabase
      .from("underwriting_health_conditions")
      .select("code, name, category");

    if (conditionsError) {
      return errorResponse(
        `Failed to load condition codes: ${conditionsError.message}`,
        500,
      );
    }

    const validConditionCodes = (conditionRows || []).map((c) => ({
      code: c.code as string,
      name: c.name as string,
      category: c.category as string,
    }));

    // Build prompt + call Claude
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const systemPrompt = buildSystemPrompt(validConditionCodes);
    const userPrompt = buildUserPrompt({
      guideName: guide.name as string,
      carrierName: "(see DB)", // not strictly required for extraction
      productScope: productId ? "Single product" : "All products on the guide",
      parsedContent,
    });

    console.log(
      `[extract-rules] Calling Claude for guide ${guideId} (${parsedContent.fullText.length} chars, ${parsedContent.pageCount} pages)`,
    );

    const aiStart = Date.now();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const aiDurationMs = Date.now() - aiStart;

    const aiText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    const parseResult = parseClaudeJson(aiText);
    if (!parseResult.ok) {
      return errorResponse(
        `Claude output was not valid JSON: ${parseResult.error}`,
        502,
      );
    }

    const claudeOutput = parseResult.data;
    const validationErrors = validateClaudeOutput(
      claudeOutput,
      new Set(validConditionCodes.map((c) => c.code)),
    );
    if (validationErrors.length > 0) {
      return errorResponse(
        `Claude output failed validation: ${validationErrors.slice(0, 5).join("; ")}`,
        502,
      );
    }

    // Persist rule sets + rules
    const persistResult = await persistExtractedRules({
      supabase,
      claudeOutput,
      imoId,
      carrierId: guide.carrier_id as string,
      productId: productId ?? null,
      guideId,
      userId,
    });

    const totalDurationMs = Date.now() - startTime;
    console.log(
      `[extract-rules] Done. ${persistResult.setsCreated} sets, ${persistResult.rulesCreated} rules. ai=${aiDurationMs}ms total=${totalDurationMs}ms`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        guideId,
        setsCreated: persistResult.setsCreated,
        rulesCreated: persistResult.rulesCreated,
        errors: persistResult.errors,
        aiDurationMs,
        totalDurationMs,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[extract-rules] Unhandled error:", message);
    return errorResponse(`Internal error: ${message}`, 500);
  }
});

// =============================================================================
// HELPERS
// =============================================================================

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseGuideContent(raw: unknown): ParsedGuideContent | null {
  if (!raw) return null;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.fullText !== "string" ||
    !Array.isArray(obj.sections) ||
    typeof obj.pageCount !== "number"
  ) {
    return null;
  }
  return {
    fullText: obj.fullText,
    sections: obj.sections as ParsedGuideContent["sections"],
    pageCount: obj.pageCount,
  };
}

function buildSystemPrompt(
  validConditions: Array<{ code: string; name: string; category: string }>,
): string {
  const conditionList = validConditions
    .map((c) => `  - ${c.code}: ${c.name} (${c.category})`)
    .join("\n");

  return `You are an underwriting analyst extracting structured eligibility rules from life insurance carrier underwriting guides.

OUTPUT FORMAT — RETURN ONLY VALID JSON, NO PROSE:
{
  "rule_sets": [
    {
      "scope": "condition" | "global",
      "condition_code": "<one of the valid codes below>" | null,
      "name": "Human-readable name (e.g., 'Type 2 Diabetes — Standard issue')",
      "description": "1-sentence summary",
      "rules": [
        {
          "name": "Specific rule name",
          "description": "Optional",
          "priority": 100,
          "age_band_min": 18 | null,
          "age_band_max": 80 | null,
          "gender": "male" | "female" | null,
          "predicate": { "version": 2, "root": { ... } },
          "outcome_eligibility": "eligible" | "ineligible" | "refer",
          "outcome_health_class": "preferred_plus|preferred|standard_plus|standard|substandard|graded|modified|guaranteed_issue|refer|decline|unknown",
          "outcome_table_rating": "none|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P",
          "outcome_flat_extra_per_thousand": 0 | null,
          "outcome_flat_extra_years": 0 | null,
          "outcome_reason": "Why this outcome — quote/paraphrase the guide",
          "outcome_concerns": ["concern1", "concern2"],
          "extraction_confidence": 0.85,
          "source_pages": [42, 43],
          "source_snippet": "Verbatim relevant passage from the guide (max 500 chars)"
        }
      ]
    }
  ]
}

PREDICATE DSL — root is a single PredicateGroup using one of all/any/not:
- PredicateGroup: { "all"?: [...], "any"?: [...], "not"?: ... }  // exactly one of all/any/not, or empty {} for always-match
- FieldCondition examples (the elements inside all/any):
  - Numeric: { "type": "numeric", "field": "age", "operator": "between", "value": [40, 60] }
  - Numeric: { "type": "numeric", "field": "a1c", "operator": "lte", "value": 7.0 }
  - Date:    { "type": "date", "field": "diagnosis_date", "operator": "years_since_gte", "value": 5 }
  - Boolean: { "type": "boolean", "field": "insulin_use", "operator": "eq", "value": false }
  - Set:     { "type": "set", "field": "treatment_status", "operator": "in", "value": ["controlled", "remission"] }
  - Array:   { "type": "array", "field": "complications", "operator": "includes_any", "value": ["retinopathy"] }
  - Null:    { "type": "null_check", "field": "remission_date", "operator": "is_not_null" }
  - Condition presence (global rules only): { "type": "condition_presence", "field": "conditions", "operator": "includes_any", "value": ["diabetes_type_2", "hypertension"] }

CANONICAL FIELD NAMES (use these — do not invent):
- age (number), gender ("male"|"female"), state (2-letter), bmi (number)
- tobacco (boolean — current use)
- For condition-scoped rules, follow-up fields use the snake_case names from the condition's follow_up_schema (e.g., "a1c", "diagnosis_date", "complications").

VALID CONDITION CODES (use these EXACTLY — do not invent codes):
${conditionList}

EXTRACTION RULES:
1. ONE rule_set per condition you find in the guide. Use scope="condition" and the matching condition_code.
2. Cross-condition rules (e.g., "client with both diabetes AND hypertension") use scope="global" and condition_code=null.
3. Within each rule_set, create ONE rule per distinct outcome (e.g., "controlled → Standard", "uncontrolled → Decline" = 2 rules).
4. Rule priority: higher number = higher priority. Use 100 for the most specific (best-case) rule, decreasing by 10 for less specific rules.
5. extraction_confidence: 0.9+ if the guide is explicit, 0.7 if you're inferring from context, 0.5 if uncertain.
6. source_pages: the actual page numbers where the rule appears.
7. source_snippet: a verbatim quote from the guide supporting the rule (max 500 chars).
8. If the guide is silent on a condition, do NOT make up rules — omit it.
9. Always include outcome_reason — agents will read this to understand why the rule fired.
10. Maximum ${MAX_RULES_PER_SET} rules per rule_set. Maximum ${MAX_TOTAL_RULES_PER_RUN} total rules per response.

Return ONLY the JSON object — no surrounding markdown fences, no commentary.`;
}

function buildUserPrompt(args: {
  guideName: string;
  carrierName: string;
  productScope: string;
  parsedContent: ParsedGuideContent;
}): string {
  const { guideName, productScope, parsedContent } = args;
  const truncated =
    parsedContent.fullText.length > MAX_PROMPT_CONTENT_CHARS
      ? parsedContent.fullText.slice(0, MAX_PROMPT_CONTENT_CHARS) +
        "\n\n[...truncated for token budget...]"
      : parsedContent.fullText;

  return `GUIDE: ${guideName}
SCOPE: ${productScope}
PAGE COUNT: ${parsedContent.pageCount}

PARSED CONTENT (with page markers from the OCR pipeline):
"""
${truncated}
"""

Extract all underwriting rules you can identify into the JSON format described in the system prompt.`;
}

interface ParseResult<T> {
  ok: boolean;
  data: T;
  error?: string;
}

function parseClaudeJson(raw: string): ParseResult<ClaudeOutput> {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const data = JSON.parse(cleaned) as ClaudeOutput;
    if (!data || !Array.isArray(data.rule_sets)) {
      return {
        ok: false,
        data: { rule_sets: [] },
        error: "Missing rule_sets array",
      };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      data: { rule_sets: [] },
      error: e instanceof Error ? e.message : "JSON parse failed",
    };
  }
}

function validateClaudeOutput(
  output: ClaudeOutput,
  validConditionCodes: Set<string>,
): string[] {
  const errors: string[] = [];
  const validEligibility = new Set(["eligible", "ineligible", "refer"]);
  const validHealthClass = new Set([
    "preferred_plus",
    "preferred",
    "standard_plus",
    "standard",
    "substandard",
    "graded",
    "modified",
    "guaranteed_issue",
    "refer",
    "decline",
    "unknown",
  ]);
  const validTableRating = new Set([
    "none",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
  ]);

  let totalRules = 0;
  output.rule_sets.forEach((set, setIdx) => {
    if (set.scope !== "condition" && set.scope !== "global") {
      errors.push(`rule_set[${setIdx}]: invalid scope "${set.scope}"`);
    }
    if (set.scope === "condition") {
      if (!set.condition_code) {
        errors.push(
          `rule_set[${setIdx}]: condition scope requires condition_code`,
        );
      } else if (!validConditionCodes.has(set.condition_code)) {
        errors.push(
          `rule_set[${setIdx}]: unknown condition_code "${set.condition_code}"`,
        );
      }
    }
    if (set.scope === "global" && set.condition_code) {
      errors.push(
        `rule_set[${setIdx}]: global scope must have null condition_code`,
      );
    }
    if (!set.name || typeof set.name !== "string") {
      errors.push(`rule_set[${setIdx}]: missing name`);
    }
    if (!Array.isArray(set.rules) || set.rules.length === 0) {
      errors.push(`rule_set[${setIdx}]: rules array missing or empty`);
      return;
    }
    if (set.rules.length > MAX_RULES_PER_SET) {
      errors.push(
        `rule_set[${setIdx}]: too many rules (${set.rules.length} > ${MAX_RULES_PER_SET})`,
      );
    }

    set.rules.forEach((rule, ruleIdx) => {
      totalRules++;
      const ref = `rule_set[${setIdx}].rule[${ruleIdx}]`;
      if (!rule.name) errors.push(`${ref}: missing name`);
      if (typeof rule.priority !== "number")
        errors.push(`${ref}: priority must be a number`);
      if (!validEligibility.has(rule.outcome_eligibility))
        errors.push(`${ref}: invalid outcome_eligibility`);
      if (!validHealthClass.has(rule.outcome_health_class))
        errors.push(`${ref}: invalid outcome_health_class`);
      if (
        rule.outcome_table_rating &&
        !validTableRating.has(rule.outcome_table_rating)
      ) {
        errors.push(`${ref}: invalid outcome_table_rating`);
      }
      if (!rule.outcome_reason || typeof rule.outcome_reason !== "string")
        errors.push(`${ref}: missing outcome_reason`);
      if (!rule.predicate || rule.predicate.version !== 2)
        errors.push(`${ref}: predicate missing or wrong version`);
    });
  });

  if (totalRules > MAX_TOTAL_RULES_PER_RUN) {
    errors.push(
      `Total rules exceeded cap: ${totalRules} > ${MAX_TOTAL_RULES_PER_RUN}`,
    );
  }

  return errors;
}

interface PersistResult {
  setsCreated: number;
  rulesCreated: number;
  errors: string[];
}

async function persistExtractedRules(args: {
  supabase: ReturnType<typeof createClient>;
  claudeOutput: ClaudeOutput;
  imoId: string;
  carrierId: string;
  productId: string | null;
  guideId: string;
  userId: string;
}): Promise<PersistResult> {
  const {
    supabase,
    claudeOutput,
    imoId,
    carrierId,
    productId,
    guideId,
    userId,
  } = args;
  const errors: string[] = [];
  let setsCreated = 0;
  let rulesCreated = 0;

  for (const set of claudeOutput.rule_sets) {
    // Insert rule set
    const { data: setRow, error: setError } = await supabase
      .from("underwriting_rule_sets")
      .insert({
        imo_id: imoId,
        carrier_id: carrierId,
        product_id: productId,
        scope: set.scope,
        condition_code: set.condition_code ?? null,
        variant: "default",
        name: set.name,
        description: set.description ?? null,
        is_active: true,
        review_status: "pending_review",
        source: "ai_extracted",
        source_guide_id: guideId,
        source_type: "extracted",
        created_by: userId,
      })
      .select("id")
      .single();

    if (setError || !setRow) {
      errors.push(
        `Failed to insert rule_set "${set.name}": ${setError?.message ?? "unknown error"}`,
      );
      continue;
    }

    setsCreated++;

    // Bulk-insert child rules
    const ruleInserts = set.rules.map((rule) => ({
      rule_set_id: setRow.id,
      name: rule.name,
      description: rule.description ?? null,
      priority: rule.priority,
      age_band_min: rule.age_band_min ?? null,
      age_band_max: rule.age_band_max ?? null,
      gender: rule.gender ?? null,
      predicate: rule.predicate,
      predicate_version: 2,
      outcome_eligibility: rule.outcome_eligibility,
      outcome_health_class: rule.outcome_health_class,
      outcome_table_rating: rule.outcome_table_rating ?? "none",
      outcome_flat_extra_per_thousand:
        rule.outcome_flat_extra_per_thousand ?? null,
      outcome_flat_extra_years: rule.outcome_flat_extra_years ?? null,
      outcome_reason: rule.outcome_reason,
      outcome_concerns: rule.outcome_concerns ?? [],
      extraction_confidence: rule.extraction_confidence ?? null,
      source_pages: rule.source_pages ?? null,
      source_snippet: rule.source_snippet ?? null,
    }));

    const { error: rulesError, count } = await supabase
      .from("underwriting_rules")
      .insert(ruleInserts, { count: "exact" });

    if (rulesError) {
      errors.push(
        `Failed to insert rules for set "${set.name}": ${rulesError.message}`,
      );
    } else {
      rulesCreated += count ?? ruleInserts.length;
    }
  }

  return { setsCreated, rulesCreated, errors };
}
