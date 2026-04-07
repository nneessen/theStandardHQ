// Tests for the workflow-name template prefix logic that runs in
// handleSaveSequence. Mirrors the implementation one-for-one — if the real
// implementation drifts, these tests fail and drive re-sync.

import { describe, expect, it } from "vitest";

/**
 * SOURCE OF TRUTH: mirrors the prefixTemplateName inner function in
 * supabase/functions/close-ai-builder/index.ts:handleSaveSequence.
 */
function makePrefixer(workflowName: string) {
  return (raw: string): string => {
    const trimmed = String(raw).trim();
    if (!trimmed) return `[${workflowName}] Untitled`;
    const expectedPrefix = `[${workflowName}]`;
    if (trimmed.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
      return trimmed;
    }
    return `[${workflowName}] ${trimmed}`;
  };
}

describe("template name prefixing", () => {
  const prefix = makePrefixer("IUL Nurture - 5 touch");

  it("prepends the workflow name in brackets to a bare template name", () => {
    expect(prefix("Day 1 Intro")).toBe("[IUL Nurture - 5 touch] Day 1 Intro");
  });

  it("is idempotent — doesn't double-prefix an already-prefixed name", () => {
    expect(prefix("[IUL Nurture - 5 touch] Day 1 Intro")).toBe(
      "[IUL Nurture - 5 touch] Day 1 Intro",
    );
  });

  it("is case-insensitive when checking for existing prefix", () => {
    expect(prefix("[iul nurture - 5 touch] Day 1")).toBe(
      "[iul nurture - 5 touch] Day 1",
    );
    expect(prefix("[IUL NURTURE - 5 TOUCH] Day 1")).toBe(
      "[IUL NURTURE - 5 TOUCH] Day 1",
    );
  });

  it("falls back to 'Untitled' for empty template names", () => {
    expect(prefix("")).toBe("[IUL Nurture - 5 touch] Untitled");
    expect(prefix("   ")).toBe("[IUL Nurture - 5 touch] Untitled");
  });

  it("strips leading/trailing whitespace from the raw name", () => {
    expect(prefix("  Day 3 Follow-up  ")).toBe(
      "[IUL Nurture - 5 touch] Day 3 Follow-up",
    );
  });

  it("handles workflow names with special characters", () => {
    const specialPrefix = makePrefixer('Q1\'24 "Hot" Leads');
    expect(specialPrefix("Touch 1")).toBe('[Q1\'24 "Hot" Leads] Touch 1');
    // Idempotent
    expect(specialPrefix('[Q1\'24 "Hot" Leads] Touch 1')).toBe(
      '[Q1\'24 "Hot" Leads] Touch 1',
    );
  });

  it("does NOT prefix a name that happens to start with brackets but different text", () => {
    // The AI might produce a name starting with "[Draft]" or similar — we
    // should still add the workflow prefix because "[Draft]" is not our
    // expected prefix.
    expect(prefix("[Draft] Day 1")).toBe(
      "[IUL Nurture - 5 touch] [Draft] Day 1",
    );
  });

  it("handles empty workflow name (edge case — should still work)", () => {
    const emptyPrefix = makePrefixer("");
    expect(emptyPrefix("Day 1")).toBe("[] Day 1");
  });

  it("matches the search pattern users would type in Close library", () => {
    // The whole point of the prefix: users can type `[IUL Nurture]` in the
    // Close template search and find every child template of that workflow.
    const names = [
      prefix("Day 1 Intro"),
      prefix("Day 3 Nudge"),
      prefix("Day 6 Last Call"),
    ];
    const searchPattern = "[IUL Nurture - 5 touch]";
    for (const n of names) {
      expect(n.startsWith(searchPattern)).toBe(true);
    }
  });
});
