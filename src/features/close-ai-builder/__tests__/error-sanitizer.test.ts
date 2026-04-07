// Tests for the Close error body sanitizer in
// supabase/functions/close-ai-builder/index.ts. Mirrors the implementation
// one-for-one.

import { describe, expect, it } from "vitest";

/**
 * SOURCE OF TRUTH: mirrors sanitizeCloseErrorBody in
 *   supabase/functions/close-ai-builder/index.ts
 */
// deno-lint-ignore no-explicit-any
function sanitizeCloseErrorBody(body: any): unknown {
  if (body == null) return null;
  if (typeof body === "string") {
    return body.length > 1024 ? body.slice(0, 1024) + "…(truncated)" : body;
  }
  if (typeof body !== "object") return null;

  const out: Record<string, unknown> = {};
  if (Array.isArray(body.errors)) {
    out.errors = body.errors
      .filter((e: unknown) => typeof e === "string")
      .slice(0, 20);
  }
  const fieldErrors = body["field-errors"];
  if (fieldErrors && typeof fieldErrors === "object") {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (typeof v === "string" && typeof k === "string") {
        cleaned[k.slice(0, 64)] = v.slice(0, 256);
      }
    }
    out["field-errors"] = cleaned;
  }
  if (Object.keys(out).length === 0) {
    return { _stripped: true };
  }
  return out;
}

describe("sanitizeCloseErrorBody", () => {
  it("returns null for null/undefined", () => {
    expect(sanitizeCloseErrorBody(null)).toBeNull();
    expect(sanitizeCloseErrorBody(undefined)).toBeNull();
  });

  it("passes through short error strings unchanged", () => {
    expect(sanitizeCloseErrorBody("Invalid JSON")).toBe("Invalid JSON");
  });

  it("truncates long error strings to 1024 chars + marker", () => {
    const long = "x".repeat(2000);
    const result = sanitizeCloseErrorBody(long) as string;
    expect(result.length).toBeLessThanOrEqual(1024 + 15);
    expect(result).toMatch(/…\(truncated\)$/);
  });

  it("preserves the two known-safe fields from Close error bodies", () => {
    const body = {
      errors: ["Template not shared"],
      "field-errors": { timezone: "This field is required." },
    };
    expect(sanitizeCloseErrorBody(body)).toEqual({
      errors: ["Template not shared"],
      "field-errors": { timezone: "This field is required." },
    });
  });

  it("strips fields outside the allowlist (SECURITY)", () => {
    const body = {
      errors: ["oops"],
      organization_id: "orga_SECRET_INTERNAL",
      api_key: "redacted_secret",
      internal_debug: { stack: "long trace..." },
    };
    const result = sanitizeCloseErrorBody(body) as Record<string, unknown>;
    expect(result).toEqual({ errors: ["oops"] });
    expect(result).not.toHaveProperty("organization_id");
    expect(result).not.toHaveProperty("api_key");
    expect(result).not.toHaveProperty("internal_debug");
  });

  it("returns { _stripped: true } for an object with ONLY unknown fields", () => {
    const body = {
      organization_id: "orga_SECRET",
      some_debug_info: "sensitive",
    };
    expect(sanitizeCloseErrorBody(body)).toEqual({ _stripped: true });
  });

  it("caps errors[] at 20 entries", () => {
    const body = {
      errors: Array.from({ length: 100 }, (_, i) => `err ${i}`),
    };
    const result = sanitizeCloseErrorBody(body) as { errors: string[] };
    expect(result.errors.length).toBe(20);
    expect(result.errors[0]).toBe("err 0");
    expect(result.errors[19]).toBe("err 19");
  });

  it("drops non-string entries from errors[]", () => {
    const body = {
      errors: ["good string", 42, null, { nested: "bad" }, "another good"],
    };
    const result = sanitizeCloseErrorBody(body) as { errors: string[] };
    expect(result.errors).toEqual(["good string", "another good"]);
  });

  it("caps field-errors keys and values", () => {
    const body = {
      "field-errors": {
        [`${"x".repeat(200)}`]: "y".repeat(500),
      },
    };
    const result = sanitizeCloseErrorBody(body) as {
      "field-errors": Record<string, string>;
    };
    const keys = Object.keys(result["field-errors"]);
    expect(keys[0].length).toBe(64);
    expect(result["field-errors"][keys[0]].length).toBe(256);
  });

  it("drops non-string values from field-errors", () => {
    const body = {
      "field-errors": {
        timezone: "required",
        nested_object: { not: "a string" },
        number_value: 42,
      },
    };
    const result = sanitizeCloseErrorBody(body) as {
      "field-errors": Record<string, string>;
    };
    expect(result["field-errors"]).toEqual({ timezone: "required" });
  });

  it("returns null for non-object, non-string values", () => {
    expect(sanitizeCloseErrorBody(42)).toBeNull();
    expect(sanitizeCloseErrorBody(true)).toBeNull();
  });

  it("handles empty arrays and empty objects safely", () => {
    expect(sanitizeCloseErrorBody({ errors: [] })).toEqual({ errors: [] });
    expect(sanitizeCloseErrorBody({})).toEqual({ _stripped: true });
  });
});
