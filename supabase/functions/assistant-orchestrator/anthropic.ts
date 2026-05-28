// Anthropic bootstrap for the orchestrator. Mirrors the proven pattern in
// close-ai-builder/ai/anthropic-client.ts. Model ID is one already in production
// use in this repo (close-lead-heat-score / close-ai-builder) — curl-test before
// any model change (see memory: feedback_verify_anthropic_model_ids).

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

export const ORCHESTRATOR_MODEL = "claude-sonnet-4-6";

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
