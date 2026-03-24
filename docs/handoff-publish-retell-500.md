# Handoff: Publish Retell Agent — 500 "Unexpected end of JSON input"

## Problem

`POST /api/external/agents/{agentId}/retell/agent/publish` returns HTTP 500 with:

```json
{"success":false,"error":{"code":"INTERNAL","message":"Unexpected end of JSON input"}}
```

This affects ALL agents — not specific to one agent or config. Tested with both agent IDs:
- `126bb5c9-e546-49e2-8fdc-1a5cfba2c1f1`
- `bd531bdd-34cb-451f-aefd-b24984b923ca`

## Reproduction

```bash
curl -s -X POST \
  -H "X-API-Key: $CHAT_BOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://api-production-de66.up.railway.app/api/external/agents/126bb5c9-e546-49e2-8fdc-1a5cfba2c1f1/retell/agent/publish"
```

Returns 500 regardless of body content (empty `{}`, no body, or body with fields).

## Likely Root Cause

The `"Unexpected end of JSON input"` error is a `JSON.parse()` failure. The publish handler likely:

1. Calls Retell's API to update/publish the agent
2. Gets back an empty response, non-JSON response, or connection error
3. Tries to `JSON.parse(responseBody)` without checking if the body is valid JSON first

Possible triggers:
- Retell API changed their response format for the publish/update endpoint
- Retell API is returning an empty 204 response that the handler doesn't expect
- Retell API credentials expired or were rotated
- A network/timeout issue causes an empty response

## What to Fix

1. Find the publish handler (likely in a Retell service/controller file)
2. Add safe JSON parsing: wrap `JSON.parse()` in a try-catch, or use `.json()` with a fallback
3. Log the raw response status + body BEFORE parsing so you can see what Retell actually returned
4. Check if the Retell API key (`RETELL_API_KEY` env var) is still valid — try a simple GET call to Retell's agent endpoint

## Quick Diagnostic

Add temporary logging to the publish handler:

```typescript
const response = await fetch(retellUrl, options);
const rawText = await response.text();
console.log(`[publish] Retell response: status=${response.status}, body=${rawText}`);
const data = rawText ? JSON.parse(rawText) : {};
```

This will tell you exactly what Retell is returning.

## Impact

Users cannot publish voice agent drafts. All config changes (voice, prompt, settings) are stuck as unpublished drafts.
