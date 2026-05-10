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
  // Chunked extraction: client (UI or script) loops over chunks until hasMore=false.
  // One Claude call = one chunk = always fits inside Supabase's 150s timeout.
  // The full guide is processed across N invocations, never truncated.
  chunkOffset?: number; // byte offset into parsed_content.fullText (default 0)
  chunkSize?: number; // bytes to send to Claude this call (default CHUNK_SIZE)
  knownConditions?: string[]; // condition codes already extracted in prior chunks
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

// One Claude call per invocation, sized to fit Supabase's 150s timeout.
// 40k chars (~10k tokens) input + 4k output cap typically lands at 25-45s
// for Sonnet 4.5. The CLIENT (UI button or bulk script) drives a loop:
// invoke with chunkOffset=0 → invoke with chunkOffset=40000 → ... until
// hasMore=false. The FULL guide is processed; we never truncate.
//
// CHUNK_OVERLAP catches rules whose definition straddles a chunk boundary:
// each chunk re-includes the last N chars of the previous chunk so a
// condition definition split across chunks is still seen whole at least
// once.
// CHUNK_SIZE is tuned so a single Claude call finishes inside the local
// supabase-edge-runtime per-request budget (~60s) — chunk 1 at 40000 chars
// took 48s and chunk 2 was getting killed at "early termination." Cloud
// allows 150s so 40000 fits there, but 25000 keeps both environments green.
const CHUNK_SIZE = 25000;
const CHUNK_OVERLAP = 2500;
// claude-sonnet-4-20250514 caps max_tokens at 8192 without the extended-output
// beta header. We deliberately stay at the model's safe ceiling and rely on
// the truncation guard below (stop_reason === "max_tokens") to handle the
// rare overflow case gracefully instead of crashing into a 500.
const MAX_OUTPUT_TOKENS = 8192;
const MIN_VALID_CONTENT_LENGTH = 5000;
const MAX_RULES_PER_SET = 25;
const MAX_TOTAL_RULES_PER_RUN = 100;

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
    const chunkOffset = Math.max(0, body.chunkOffset ?? 0);
    const chunkSize = Math.max(1000, body.chunkSize ?? CHUNK_SIZE);
    const knownConditions: string[] = Array.isArray(body.knownConditions)
      ? body.knownConditions.filter((c): c is string => typeof c === "string")
      : [];

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

    // === CHUNKING ===
    // Slice the full text to this chunk's window. Re-include CHUNK_OVERLAP
    // chars before chunkOffset (when offset > 0) so a rule definition that
    // straddles a chunk boundary is still seen whole at least once.
    const totalChars = parsedContent.fullText.length;
    if (chunkOffset >= totalChars) {
      return errorResponse(
        `chunkOffset ${chunkOffset} is beyond guide length ${totalChars}`,
        400,
      );
    }
    const sliceStart =
      chunkOffset > 0 ? Math.max(0, chunkOffset - CHUNK_OVERLAP) : 0;
    const sliceEnd = Math.min(totalChars, chunkOffset + chunkSize);
    const chunkText = parsedContent.fullText.slice(sliceStart, sliceEnd);
    const nextOffset = sliceEnd;
    const hasMore = sliceEnd < totalChars;
    const chunkIndex = Math.floor(chunkOffset / chunkSize);
    const totalChunks = Math.ceil(totalChars / chunkSize);

    // Approximate which page numbers this slice covers, by walking the
    // section list and counting cumulative chars. Used for source_pages
    // hints when Claude can't pinpoint exact pages.
    const approxPagesInChunk = approximatePagesForRange(
      parsedContent,
      sliceStart,
      sliceEnd,
    );

    // Build prompt + call Claude
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const systemPrompt = buildSystemPrompt(
      validConditionCodes,
      knownConditions,
    );
    const userPrompt = buildUserPrompt({
      guideName: guide.name as string,
      productScope: productId ? "Single product" : "All products on the guide",
      chunkText,
      chunkIndex,
      totalChunks,
      approxPagesInChunk,
    });

    console.log(
      `[extract-rules] Calling Claude for guide ${guideId} chunk ${chunkIndex + 1}/${totalChunks} (${chunkText.length} chars, knownConditions=${knownConditions.length})`,
    );

    const aiStart = Date.now();
    const response = await anthropic.messages.create({
      // Use the same model string the sibling extract-underwriting-criteria
      // function has been calling successfully against this Anthropic account
      // for over a year. Newer Sonnet aliases (4-5, 4-6) may not be enabled
      // on this account tier even if they exist in Anthropic's catalog.
      // Bump after we verify access via logs.
      model: "claude-sonnet-4-20250514",
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const aiDurationMs = Date.now() - aiStart;

    const aiText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    const truncated = response.stop_reason === "max_tokens";

    const parseResult = parseClaudeJson(aiText);
    if (!parseResult.ok) {
      if (truncated) {
        console.warn(
          `[extract-rules] Chunk ${chunkIndex + 1}/${totalChunks} truncated at max_tokens with unparseable JSON; skipping persistence and continuing.`,
        );
        const totalDurationMs = Date.now() - startTime;
        return new Response(
          JSON.stringify({
            success: true,
            guideId,
            chunkOffset,
            chunkSize,
            chunkIndex,
            totalChunks,
            totalChars,
            nextOffset,
            hasMore,
            conditionsExtracted: [],
            setsCreated: 0,
            rulesCreated: 0,
            errors: [`truncated_at_chunk_${chunkIndex}_unparseable`],
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
      }
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

    // Track which condition codes Claude emitted in this chunk so the client
    // can pass them back as knownConditions on the next chunk and avoid
    // duplicate rule_sets.
    const conditionsExtracted = Array.from(
      new Set(
        claudeOutput.rule_sets
          .map((rs) => rs.condition_code)
          .filter((c): c is string => Boolean(c)),
      ),
    );

    const totalDurationMs = Date.now() - startTime;
    console.log(
      `[extract-rules] Done chunk ${chunkIndex + 1}/${totalChunks}. ${persistResult.setsCreated} sets, ${persistResult.rulesCreated} rules. ai=${aiDurationMs}ms total=${totalDurationMs}ms hasMore=${hasMore}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        guideId,
        chunkOffset,
        chunkSize,
        chunkIndex,
        totalChunks,
        totalChars,
        nextOffset,
        hasMore,
        conditionsExtracted,
        setsCreated: persistResult.setsCreated,
        rulesCreated: persistResult.rulesCreated,
        errors: truncated
          ? [...persistResult.errors, `truncated_at_chunk_${chunkIndex}`]
          : persistResult.errors,
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
  knownConditions: string[],
): string {
  const conditionList = validConditions
    .map((c) => `  - ${c.code}: ${c.name} (${c.category})`)
    .join("\n");

  // When the client is on chunk 2+, it passes the condition codes already
  // extracted in prior chunks. We tell Claude NOT to re-emit rule_sets for
  // those condition codes, otherwise the same condition processed in two
  // chunks (or in chunk overlap) creates duplicate pending_review sets.
  const dedupSection =
    knownConditions.length > 0
      ? `

ALREADY EXTRACTED IN PRIOR CHUNKS — DO NOT EMIT RULE_SETS FOR THESE CONDITIONS AGAIN:
${knownConditions.map((c) => `  - ${c}`).join("\n")}
If you encounter content for one of these conditions in this chunk, SKIP it —
do not create a duplicate rule_set. Only emit rule_sets for conditions NOT in
the list above.
`
      : "";

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
${dedupSection}
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
  productScope: string;
  chunkText: string;
  chunkIndex: number;
  totalChunks: number;
  approxPagesInChunk: number[];
}): string {
  const {
    guideName,
    productScope,
    chunkText,
    chunkIndex,
    totalChunks,
    approxPagesInChunk,
  } = args;

  const pageHint =
    approxPagesInChunk.length > 0
      ? `APPROX PAGES IN THIS CHUNK: ${approxPagesInChunk[0]}–${approxPagesInChunk[approxPagesInChunk.length - 1]}`
      : "APPROX PAGES IN THIS CHUNK: unknown";

  return `GUIDE: ${guideName}
SCOPE: ${productScope}
CHUNK: ${chunkIndex + 1} of ${totalChunks}
${pageHint}

This is one slice of a larger guide. The full guide is being processed across
${totalChunks} chunk${totalChunks === 1 ? "" : "s"}; you are seeing chunk
${chunkIndex + 1}. Other chunks are processed in separate calls — extract only
what you can identify from THIS slice.

PARSED CONTENT (this chunk only):
"""
${chunkText}
"""

Extract all underwriting rules you can identify in this chunk into the JSON
format described in the system prompt. Use the APPROX PAGES range above for
source_pages when you cannot pinpoint exact page markers.`;
}

/**
 * Walk the parsed sections to determine which page numbers fall within a
 * given character range of the joined fullText. Used to give Claude a
 * source_pages hint when it can't find explicit page markers in a chunk.
 */
function approximatePagesForRange(
  parsed: ParsedGuideContent,
  rangeStart: number,
  rangeEnd: number,
): number[] {
  const pages: number[] = [];
  let cursor = 0;
  for (const section of parsed.sections) {
    const sectionStart = cursor;
    const sectionEnd = cursor + section.content.length;
    // Section overlaps the range
    if (sectionEnd >= rangeStart && sectionStart <= rangeEnd) {
      pages.push(section.pageNumber);
    }
    cursor = sectionEnd;
    if (cursor > rangeEnd) break;
  }
  return pages.sort((a, b) => a - b);
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
        source_type: "carrier_document",
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
