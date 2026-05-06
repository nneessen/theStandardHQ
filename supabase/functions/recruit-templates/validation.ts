// supabase/functions/recruit-templates/validation.ts
//
// Pure input-validation logic for the recruit-templates edge function.
// Lives in its own file (no Deno imports) so vitest can exercise it under
// Node — same pattern as get-team-call-stats/aggregate.ts.
//
// Consumer: standard-chat-bot's recruit template client. The bot looks up
// Instagram message templates by category + stage to inject as voice
// examples in the recruit persona prompt.

/**
 * Built-in prospect-type categories that map to seeded templates in
 * `instagram_message_templates`. The recruit SMS bot only ever requests
 * `licensed_agent` and `captive_agent` today, but accepting all 8 lets us
 * reuse this endpoint for future surfaces (e.g., LinkedIn outreach).
 *
 * Source of truth: `src/types/instagram.types.ts` (BUILT_IN_PROSPECT_TYPES).
 */
export const BUILT_IN_CATEGORIES = [
  "licensed_agent",
  "captive_agent",
  "has_team",
  "solar",
  "door_to_door",
  "athlete",
  "car_salesman",
  "general_cold",
] as const;

export type BuiltInCategory = (typeof BUILT_IN_CATEGORIES)[number];

/**
 * Message stages — order maps to the conversation lifecycle (cold opener to
 * scheduling closer). Source of truth: `src/types/instagram.types.ts`
 * (MessageStage).
 */
export const MESSAGE_STAGES = [
  "opener",
  "follow_up",
  "engagement",
  "discovery",
  "closer",
] as const;

export type MessageStage = (typeof MESSAGE_STAGES)[number];

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 25;

export interface ParsedQuery {
  externalRef: string;
  category: BuiltInCategory;
  stage: MessageStage | null;
  limit: number;
}

export type ParseResult =
  | { ok: true; value: ParsedQuery }
  | { ok: false; status: 400; error: string };

/**
 * Validates query params from the recruit-templates GET request.
 *
 * Required:
 *   - external_ref (the calling agent's commissionTracker user_id)
 * Optional:
 *   - category (default: licensed_agent — the recruit-bot default)
 *   - stage    (default: null — return across all stages, ordered by use_count)
 *   - limit    (default: 10, max: 25)
 */
export function parseRecruitTemplatesQuery(
  searchParams: URLSearchParams,
): ParseResult {
  const externalRef = (searchParams.get("external_ref") ?? "").trim();
  if (!externalRef) {
    return {
      ok: false,
      status: 400,
      error: "missing required query param: external_ref",
    };
  }
  // UUID format check — lightweight; the DB won't return rows for a
  // malformed UUID anyway, but a 400 here is friendlier than a silent empty.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      externalRef,
    )
  ) {
    return {
      ok: false,
      status: 400,
      error: "external_ref must be a valid UUID",
    };
  }

  const rawCategory = (searchParams.get("category") ?? "licensed_agent")
    .trim()
    .toLowerCase();
  if (!isBuiltInCategory(rawCategory)) {
    return {
      ok: false,
      status: 400,
      error: `category must be one of: ${BUILT_IN_CATEGORIES.join(", ")}`,
    };
  }

  const rawStage = searchParams.get("stage");
  let stage: MessageStage | null = null;
  if (rawStage !== null && rawStage.trim().length > 0) {
    const normalized = rawStage.trim().toLowerCase();
    if (!isMessageStage(normalized)) {
      return {
        ok: false,
        status: 400,
        error: `stage must be one of: ${MESSAGE_STAGES.join(", ")}`,
      };
    }
    stage = normalized;
  }

  const rawLimit = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null && rawLimit.trim().length > 0) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return {
        ok: false,
        status: 400,
        error: "limit must be a positive integer",
      };
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  return {
    ok: true,
    value: { externalRef, category: rawCategory, stage, limit },
  };
}

function isBuiltInCategory(value: string): value is BuiltInCategory {
  return (BUILT_IN_CATEGORIES as readonly string[]).includes(value);
}

function isMessageStage(value: string): value is MessageStage {
  return (MESSAGE_STAGES as readonly string[]).includes(value);
}

/**
 * Constant-time string comparison for API keys. Length mismatch is a fast-
 * fail (timing leak of length is acceptable for fixed-format keys); content
 * comparison is constant-time to defeat byte-by-byte timing probes.
 *
 * Used over `a === b` because the latter short-circuits on first byte
 * mismatch and leaks how many leading bytes match.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
