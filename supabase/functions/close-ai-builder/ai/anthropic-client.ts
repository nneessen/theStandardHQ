// Anthropic SDK bootstrap. Mirrors the pattern in close-lead-heat-score/ai-analyzer.ts.
// Model IDs verified against live API before deploy (see project memory:
// feedback_verify_anthropic_model_ids.md — ALWAYS curl-test IDs before shipping).

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

/** Fast + cheap — used for email/SMS single-artifact generation. */
export const MODEL_FAST = "claude-haiku-4-5-20251001";
/** Smarter — used for structured sequence JSON where the schema is complex. */
export const MODEL_SMART = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured in edge function secrets",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/** Extract concatenated text from an Anthropic message response. */
// deno-lint-ignore no-explicit-any
export function extractText(response: any): string {
  if (!response?.content || !Array.isArray(response.content)) return "";
  return (
    response.content
      // deno-lint-ignore no-explicit-any
      .filter((b: any) => b.type === "text")
      // deno-lint-ignore no-explicit-any
      .map((b: any) => b.text)
      .join("")
  );
}

/**
 * Extract a JSON object from an AI response. Handles:
 *   - Raw JSON
 *   - Fenced code blocks (```json ... ```)
 *   - Leading/trailing prose around a JSON block
 */
export function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  // Strip markdown fence if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fallback: find the first { and matching } in the response
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = candidate.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch {
        // fall through to throw below
      }
    }
    throw new Error(
      `Failed to parse JSON from AI response. Got: ${candidate.slice(0, 200)}...`,
    );
  }
}
