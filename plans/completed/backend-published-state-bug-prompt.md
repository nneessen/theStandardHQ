# Bug: Voice agent `published` state is permanently false

## Copy everything below this line into the standard-chat-bot project

---

## Bug Report: `published` is always `false` in `GET /voice/setup-state` and `GET /retell/runtime`

### What's broken

The `GET /api/external/agents/:id/voice/setup-state` endpoint always returns `agent.published: false` and `nextAction.key: "publish_agent"` — even for agents that are actively making calls.

The `GET /api/external/agents/:id/retell/runtime` endpoint returns the Retell agent with `is_published: false` — even immediately after a successful publish.

### Proof

I ran these calls against agent `126bb5c9-e546-49e2-8fdc-1a5cfba2c1f1` (Nick Neessen's production agent):

**Step 1 — Check current state:**
```
GET /api/external/agents/126bb5c9-e546-49e2-8fdc-1a5cfba2c1f1/voice/setup-state

Response:
  agent.published: false
  nextAction.key: "publish_agent"
  usage.outboundCalls: 322
  usage.answeredCalls: 137
```

The agent has made 322 outbound calls and 137 were answered. It is clearly live and operational. But `published: false`.

**Step 2 — Call publish endpoint:**
```
POST /api/external/agents/126bb5c9-e546-49e2-8fdc-1a5cfba2c1f1/retell/agent/publish

Response: { "success": true, "data": { "published": true } }
```

The publish "succeeded" and the Retell agent version bumped from 109 to 110.

**Step 3 — Check state again (20 seconds later):**
```
GET /retell/runtime → agent.is_published: false, agent.version: 110
GET /voice/setup-state → agent.published: false, nextAction.key: "publish_agent"
```

Still `false`. The publish endpoint returns success and bumps the version, but `is_published` never becomes `true`.

### Impact

The commissionTracker frontend uses `agent.published` and `nextAction.key` from `setup-state` to decide whether the voice agent page shows "Complete Setup" or "View Stats". Because these are always wrong, published agents permanently show "Complete Setup" — even with hundreds of completed calls.

### Root cause candidates (investigate in this order)

**1. The publish endpoint may not be calling Retell's actual publish API.**

Retell has a dedicated publish endpoint: `POST https://api.retellai.com/v2/publish-agent/{agent_id}`. Verify the publish handler actually calls this, not just `PATCH /update-agent` (which bumps version but does NOT set `is_published: true`).

**2. A post-publish agent update may be creating a new draft immediately.**

If the publish flow does: (a) call Retell publish API → `is_published: true`, then (b) call Retell update API to set webhook_url or any other field → `is_published: false` again. Any Retell agent update after a publish creates a new unpublished draft. Check if the publish handler or any webhook/callback triggered by publish makes a subsequent `PATCH /update-agent` call.

**3. `setup-state` may derive `published` from Retell's `is_published` without local override.**

If `setup-state` always fetches `is_published` live from Retell and Retell always says `false` (due to cause #1 or #2), then `setup-state` will always say `published: false`. The `setup-state` endpoint should either:
- Fix the Retell publish flow so `is_published` is actually `true`, OR
- Track published state locally (in the DB) independent of Retell's draft/publish flag

**4. `nextAction.key` logic doesn't account for operational agents with `is_published: false`.**

The `nextAction` state machine should check: if the agent has usage (outbound + inbound calls > 0), the agent has been published at least once. The next action should NOT be `"publish_agent"` — it should be `"review_guardrails"` or whatever the post-publish action is.

### Required fixes

1. **Fix the publish endpoint** so that after a successful publish, `is_published` is actually `true` when you immediately query the agent. No intermediate updates that create a new draft.

2. **Fix `setup-state` response** — `agent.published` should be `true` for any agent that has been published at least once and is operational. Either:
   - Trust Retell's `is_published` (after fixing the publish flow), OR
   - Store a `has_been_published` flag locally in the DB that gets set on first successful publish and never unset

3. **Fix `nextAction.key` logic** — An agent with call history (outbound + inbound > 0) should never return `nextAction.key: "publish_agent"`. It should return `"review_guardrails"` or a new key like `"manage_agent"` that indicates the agent is operational.

### Expected behavior after fix

For agent `126bb5c9-e546-49e2-8fdc-1a5cfba2c1f1`:

```json
{
  "agent": {
    "published": true,
    ...
  },
  "nextAction": {
    "key": "review_guardrails",
    "label": "Review Guardrails",
    "description": "Your voice agent is live. Review safety settings and call rules."
  }
}
```

### Frontend contract

The commissionTracker frontend checks these three conditions (in order) to determine if the agent is "published":

1. `voiceSetupState.agent.published === true`
2. `retellRuntime.agent.is_published === true`
3. `voiceSetupState.nextAction.key` is `"review_guardrails"` or `"connect_calendar"`

At least one of these must be `true` for a published agent. Currently all three are `false`.

The frontend has been patched to also check call history as a fallback, but that's a workaround — the backend should return correct state.
