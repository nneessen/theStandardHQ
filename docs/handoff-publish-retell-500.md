# Retell Publish Endpoint — RESOLVED

## Status: Fixed (2026-03-24)

## What was broken

`POST /api/external/agents/{agentId}/retell/agent/publish` returned HTTP 500:
```json
{"success":false,"error":{"code":"INTERNAL","message":"Unexpected end of JSON input"}}
```

**Root cause:** Retell's publish API returns `Content-Type: application/json` with an **empty body** on success. The backend called `response.json()` which threw `SyntaxError: Unexpected end of JSON input`.

## How it was fixed

The backend now uses the Retell SDK's native `client.agent.publish()` method and catches the SDK's `SyntaxError` on empty body, treating it as success.

## Current endpoint contract

```
POST /api/external/agents/{agentId}/retell/agent/publish
Headers: X-API-Key: {EXTERNAL_API_KEY}, Content-Type: application/json
Body: {}

Success (200): { "success": true, "data": { "published": true } }
Error (404):   { "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
Error (500):   { "success": false, "error": { "code": "INTERNAL", "message": "..." } }
```

## Frontend handling

The frontend (`usePublishRetellAgentDraft` in `useChatBot.ts`) does NOT inspect the response body. It uses optimistic cache updates:

1. `onMutate`: Sets `is_published = true` in `retellRuntime` and `voiceSetupState` caches
2. `onSuccess`: Re-applies optimistic data to reset `dataUpdatedAt` timestamps, giving Retell ~180s total to propagate
3. 120-second grace period in `VoiceAgentRetellStudioCard.tsx` prevents badge flipping during Retell's async propagation

No frontend code changes were needed for the backend fix.
