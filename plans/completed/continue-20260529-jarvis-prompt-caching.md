# Continuation — Add Anthropic prompt caching to assistant-orchestrator

**Created:** 2026-05-29
**Branch:** `feat/jarvis-data-correctness` (Close integration Phase 1 `0a93549e` + Phase 2 `a32f04a2` already committed here). Work on this branch; do NOT push (Vercel deploys any pushed branch).
**Status:** NOT STARTED — researched, design below is ready to implement.

---

## Goal

Cut input-token cost (and latency) on the Jarvis orchestrator by caching the **static
system prompt + tool definitions**, which are re-sent on every iteration of the up-to-10
tool-use loop. Expected ~80–90% cost reduction on that stable prefix for iterations 2+.

This is purely an optimization — behavior must not change. The orchestrator was just
confirmed fully working end-to-end (NL → close agent → live Close tools → grounded answer)
after API credits were funded.

---

## What "automatic" caching actually is

There is **no zero-code automatic caching.** You opt in by placing `cache_control`
breakpoints on content blocks; once set, cache **hits are automatic** on byte-identical
prefixes. It is **GA** — standard `anthropic-version: 2023-06-01`, **no beta header**.
Default TTL 5 min (`{type:"ephemeral"}`); 1h available via `{type:"ephemeral", ttl:"1h"}`
at 2× write cost. (Ignore any "top-level cache_control request param that auto-moves" —
unverified; use the block-level breakpoints below, which are the established approach.)

---

## The change (2 files, contained)

### 1. `supabase/functions/assistant-orchestrator/anthropic.ts`
Bump the SDK — `cache_control` support landed in `@anthropic-ai/sdk@0.27`; we're pinned at
`0.24.0` (below the floor).
```ts
// line ~6, change:
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";
// to (a safe mid-version; or latest stable ~0.97.x for best usage typings):
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";
```
The surface this file/loop uses is stable across that range: `new Anthropic({apiKey})`,
`messages.create()`, `resp.usage`, `resp.content`, `resp.stop_reason`.
**RISK / VERIFY FIRST:** this is the riskiest part — confirm esm.sh resolves the new
version under this repo's Deno setup and that `deno check supabase/functions/assistant-orchestrator/index.ts`
stays green before touching anything else. `deno.lock` will update on first fetch.

### 2. `supabase/functions/assistant-orchestrator/index.ts` (inside the tool loop, ~line 170–177)
Two breakpoints. Canonical cache order is **tools → system → messages**; a miss on any
layer misses everything after it.
```ts
const params: any = {
  model: ORCHESTRATOR_MODEL,
  max_tokens: MAX_TOKENS_PER_TURN,
  system: [
    { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }, // breakpoint 2
  ],
  messages,
};
if (tools.length > 0) {
  // breakpoint 1 — stamp only the LAST tool (covers the whole tools prefix)
  params.tools = tools.map((t, i) =>
    i === tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t,
  );
}
```
- `system` accepts `string | TextBlockParam[]`; switching to the array form is
  backward-compatible. The param is built locally in `index.ts` — no other caller affected.
- `cache_control` isn't on the `AnthropicToolDef` type (`tools/index.ts`); the spread works
  under the existing `any`-typed `params`, or add `cache_control?: { type: string }` to the type.

No new files, no schema changes, no changes to `agents.ts` / `buildAnthropicTools` / tool handlers.

---

## Sizing / what will actually cache

Sonnet min cacheable prefix = **1,024 tokens**.
- Tool-heavy agents (`close` ≈ 8 tools, executive-briefing) clear it easily on the tools
  breakpoint alone → cache across users + iterations.
- `BASE_SYSTEM_RULES` (~350 tok) + agent prompt (~350 tok) ≈ 700 tok; caches on top of tools.
- Draft-only agents (`sms-email-copy`, `compliance`, `calendar`, `slack`, `workflow`) have
  2 tools + short prompt → may fall under 1,024 → simply won't cache (no error, no savings).

---

## Caveats (don't be surprised)
- `buildSystemPrompt` interpolates `{{ASSISTANT_NAME}}` → system block is per-user, but stable
  for a given user across their turns. Fine. Tools block is cross-user.
- `routeToAgent` can pick a different agent next turn → different tools/system → cache miss. Expected.
- `tokensUsed += input_tokens + output_tokens` will **undercount** after caching (the usage
  `input_tokens` excludes cache reads). Safe (budget guard stays conservative). OPTIONAL: also
  accumulate `cache_read_input_tokens` + `cache_creation_input_tokens` if you want true measurement.

---

## Verification (typecheck is NOT verification — measure a real cache hit)

1. `deno check supabase/functions/assistant-orchestrator/index.ts` green; `npm run build` green;
   `deno test supabase/functions/assistant-orchestrator/` (currently 67 pass).
2. Temporarily `console.log(JSON.stringify(resp.usage))` inside the loop. Deploy JWT-verified:
   `npx supabase functions deploy assistant-orchestrator --project-ref pcyaqwodnyrpkaiojnpz`
   (NOT `--no-verify-jwt`).
3. Drive a **multi-iteration** session and confirm `cache_creation_input_tokens > 0` on the
   first model call and **`cache_read_input_tokens > 0`** on a later iteration/turn — that is
   the only real proof. Harness (python SSL is broken on this Mac — use curl):
   ```bash
   set -a && source .env && set +a
   U="$REMOTE_SUPABASE_URL"; SVC="$REMOTE_SUPABASE_SERVICE_ROLE_KEY"; ANON="$VITE_SUPABASE_ANON_KEY"
   TMP=$(mktemp -d)
   curl -s -X POST "$U/auth/v1/admin/generate_link" -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" -d '{"type":"magiclink","email":"nickneessen@thestandardhq.com"}' -o "$TMP/gl.json"
   HT=$(python3 -c "import json;print(json.load(open('$TMP/gl.json')).get('hashed_token') or '')")
   curl -s -X POST "$U/auth/v1/verify" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"type\":\"magiclink\",\"token_hash\":\"$HT\"}" -o "$TMP/vr.json"
   TOK=$(python3 -c "import json;print(json.load(open('$TMP/vr.json')).get('access_token') or '')")
   # A close-agent query forces a multi-iteration tool loop (system+tools re-sent each turn):
   curl -s -X POST "$U/functions/v1/assistant-orchestrator" -H "apikey: $ANON" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"message":"Using my live Close CRM, what are my open opportunities and which are most stalled?"}'
   ```
   Then read the logged `resp.usage` via the Management API (CLI has no `logs` subcommand):
   ```bash
   PAT=$(cat ~/.supabase/access-token); REF=pcyaqwodnyrpkaiojnpz
   curl -s -G "https://api.supabase.com/v1/projects/$REF/analytics/endpoints/logs.all" \
     -H "Authorization: Bearer $PAT" \
     --data-urlencode "sql=select cast(timestamp as datetime) as t, event_message from function_logs where event_message like '%cache_%' order by timestamp desc limit 20"
   ```
   (Test user `nickneessen@thestandardhq.com` is super-admin; bypasses the Epic-Life gate.)
4. **Remove the temporary `console.log`** and redeploy clean; `grep -c "console.log(JSON.stringify(resp.usage" index.ts` must be 0.

---

## Repo rules to honor
- Verify live, not just typecheck (memory: `feedback_typecheck_is_not_verification`).
- Deploy JWT-verified, never `--no-verify-jwt`.
- Don't push non-main branches. Commit on `feat/jarvis-data-correctness` only when the user asks.
- Don't leave temp/debug code in deployed functions (grep 0 before final deploy).
- If you change `anthropic.ts`, the SDK bump affects every function that imports it? No — each
  edge fn imports its own SDK; this only touches the orchestrator. (close-ai-builder etc. have
  their own anthropic clients — out of scope.)

## Reference
- Anthropic prompt caching: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching
- Memory: `project_jarvis_close_crm_integration.md` (the orchestrator this optimizes).
