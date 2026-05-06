// supabase/functions/recruit-templates/__tests__/validation.test.ts
//
// Unit tests for the pure input-validation helpers used by the
// recruit-templates edge function. Same pattern as get-team-call-stats —
// validation.ts has no Deno imports, so vitest can exercise it under Node.

import { describe, it, expect } from "vitest";
import {
  parseRecruitTemplatesQuery,
  timingSafeEqual,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  BUILT_IN_CATEGORIES,
} from "../validation";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

function params(record: Record<string, string>): URLSearchParams {
  return new URLSearchParams(record);
}

describe("parseRecruitTemplatesQuery — required external_ref", () => {
  it("rejects missing external_ref", () => {
    const result = parseRecruitTemplatesQuery(params({}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/external_ref/);
    }
  });

  it("rejects empty external_ref", () => {
    const result = parseRecruitTemplatesQuery(params({ external_ref: "   " }));
    expect(result.ok).toBe(false);
  });

  it("rejects malformed UUID", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: "not-a-uuid" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/UUID/);
    }
  });

  it("accepts a valid UUID with default category + null stage + default limit", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.externalRef).toBe(VALID_UUID);
      expect(result.value.category).toBe("licensed_agent");
      expect(result.value.stage).toBeNull();
      expect(result.value.limit).toBe(DEFAULT_LIMIT);
    }
  });
});

describe("parseRecruitTemplatesQuery — category", () => {
  it("accepts every built-in category", () => {
    for (const category of BUILT_IN_CATEGORIES) {
      const result = parseRecruitTemplatesQuery(
        params({ external_ref: VALID_UUID, category }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.category).toBe(category);
    }
  });

  it("normalizes case (LICENSED_AGENT → licensed_agent)", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, category: "LICENSED_AGENT" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.category).toBe("licensed_agent");
  });

  it("rejects unknown category", () => {
    const result = parseRecruitTemplatesQuery(
      params({
        external_ref: VALID_UUID,
        category: "underwater_basket_weaver",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/category must be one of/);
    }
  });

  it('rejects custom-prefixed categories ("custom:..." is for the IG UI, not this API)', () => {
    // Custom categories live on a separate table and require a different
    // resolution path. The recruit bot only consumes built-in templates;
    // exposing custom would silently broaden the surface.
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, category: "custom:abc-123" }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("parseRecruitTemplatesQuery — stage", () => {
  it("accepts each stage", () => {
    for (const stage of [
      "opener",
      "follow_up",
      "engagement",
      "discovery",
      "closer",
    ]) {
      const result = parseRecruitTemplatesQuery(
        params({ external_ref: VALID_UUID, stage }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.stage).toBe(stage);
    }
  });

  it("treats missing stage as null (return across all stages)", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.stage).toBeNull();
  });

  it("treats empty stage as null", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, stage: "" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.stage).toBeNull();
  });

  it("rejects unknown stage", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, stage: "warmup" }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("parseRecruitTemplatesQuery — limit", () => {
  it("uses default when missing", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID }),
    );
    if (result.ok) expect(result.value.limit).toBe(DEFAULT_LIMIT);
  });

  it("clamps to MAX_LIMIT", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, limit: String(MAX_LIMIT + 100) }),
    );
    if (result.ok) expect(result.value.limit).toBe(MAX_LIMIT);
  });

  it("accepts an explicit small limit", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, limit: "3" }),
    );
    if (result.ok) expect(result.value.limit).toBe(3);
  });

  it("rejects limit=0", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, limit: "0" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects negative limit", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, limit: "-5" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric limit", () => {
    const result = parseRecruitTemplatesQuery(
      params({ external_ref: VALID_UUID, limit: "lots" }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(
      timingSafeEqual(
        "hunter2hunter2hunter2hunter2hunter2",
        "hunter2hunter2hunter2hunter2hunter2",
      ),
    ).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeEqual("aaaaaaaaaa", "aaaaaaaaab")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeEqual("short", "longerString")).toBe(false);
  });

  it("handles empty strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("", "a")).toBe(false);
  });
});
