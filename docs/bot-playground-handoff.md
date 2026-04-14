# Bot Playground Feature — Handoff Doc

**Feature shipped**: 2026-04-07 (late evening)
**Commit**: `dd587366` — `feat(chat-bot): Bot Playground — dry-run bot replies without sending SMS`
**Depends on**: standard-chat-bot `@51a65f9` (endpoint live on Railway)

## What this feature is

A new **"Playground"** tab inside Bot Configuration that lets agents test what the AI chat bot **would reply** for any Close lead's current conversation state — without sending an SMS or touching the bot's database.

**Why it exists**: Tonight's crisis (Michael Kefauver incident, ~20 real customers got bad SMS messages) surfaced that there was no way for agents to verify bot behavior before trusting prompt changes with real leads. The playground is the safety net: break prompts here, not in production conversations.

**Zero side effects in standard-chat-bot.** Every test makes one paid Anthropic call and returns the generated reply. No SMS sent. No writes to standard-chat-bot's messages/conversations/appointments tables.

**Persisted history in commissionTracker.** Every test run is saved to a new `chat_bot_playground_runs` Supabase table so agents can review past runs, click one to rehydrate the form, and iterate on prompts over time.

---

## Deployment status — already done tonight

| Step | Status | Detail |
|---|---|---|
| standard-chat-bot API endpoint | **✅ LIVE** | `POST /api/external/agents/:id/dry-run-reply` deployed to Railway as commit `51a65f9` |
| Supabase migration applied | **✅ LIVE** | `chat_bot_playground_runs` table + 3 RLS policies + 2 indexes applied via psql against prod (`pcyaqwodnyrpkaiojnpz`). Migration registered in `supabase_migrations.schema_migrations` so CLI won't try to re-run it. |
| `chat-bot-api` edge function deployed | **✅ LIVE** | Deployed via `supabase functions deploy chat-bot-api` on 2026-04-07. 4 new cases: `dry_run_reply`, `list_playground_runs`, `get_playground_run`, `delete_playground_run`. |
| commissionTracker frontend | **Pushed to main (`dd587366`), waiting on Vercel auto-deploy** | Vite build succeeded locally. |

**You don't need to run any deploy commands.** The feature is live end-to-end. What remains is your QA pass and making sure nothing is wired incorrectly from a UX angle.

---

## Files to review (commissionTracker repo)

### New files

| File | Purpose |
|---|---|
| `supabase/migrations/20260407181354_chat_bot_playground_runs.sql` | DB migration — creates `chat_bot_playground_runs` table, 2 indexes, 3 RLS policies. Already applied to prod. |
| `src/features/chat-bot/components/PlaygroundTab.tsx` | The main UI component. ~480 lines. Contains the form, result panel, history sidebar, and all sub-components (CopyButton, RelativeTime, ResultPanel, HistoryItem). |

### Modified files

| File | Changes |
|---|---|
| `src/features/chat-bot/ChatBotPage.tsx` | Added `"playground"` to the `TabId` union, imported `PlaygroundTab` + the `FlaskConical` lucide icon, added the tab to the `tabs` array (right after Analytics, gated behind `setupComplete`), added the render branch `{activeTab === "playground" && <PlaygroundTab />}`, updated `getInitialTab()` to accept `?tab=playground` URL params. |
| `src/features/chat-bot/hooks/useChatBot.ts` | Added 4 new hooks: `useChatBotDryRun` (mutation), `useChatBotPlaygroundRuns` (list query), `useChatBotPlaygroundRun` (detail query), `useDeletePlaygroundRun` (mutation). Added TypeScript types: `PlaygroundMode`, `DryRunReplyResult`, `DryRunReplyParams`, `DryRunReplyMetadata`, `PlaygroundRunListItem`, `PlaygroundRunDetail`. Added 2 new entries to `chatBotKeys`: `playgroundRuns` and `playgroundRun`. |
| `supabase/functions/chat-bot-api/index.ts` | Added 4 new action cases to the big switch statement, inserted right before `case "get_analytics"`: `dry_run_reply` (proxies to standard-chat-bot with a 30-second timeout for Anthropic calls, persists the result on success), `list_playground_runs`, `get_playground_run`, `delete_playground_run`. |

---

## What to verify before declaring it done

### 1. The Playground tab appears

- Log in to commissionTracker as yourself (Nick Neessen) or as a team member (Andrew, James)
- Navigate to **Bot Configuration**
- You should see a new **"Playground"** tab in the tab row, with a flask icon, positioned right after **"My Analytics"**
- The tab should only appear once Close is connected and the bot is set up. If it's missing, check that `setupComplete || wizardDone` is true for your agent (see `src/features/chat-bot/ChatBotPage.tsx:246-256`).

### 2. Smoke test: run it against Michael Kefauver

This is the exact test I used to verify the fix tonight. Michael is the lead the bot was breaking on earlier.

1. Click the **Playground** tab
2. Paste into "Close Lead ID": `lead_UXVs6RuV8qDWgNB0nCXS5kYZLdxvd0DPMIwHTz3pv2k`
3. Into "Simulated inbound message": `Sunday 1pm works for me`
4. Leave mode as `ai-reply` (default)
5. Click **Simulate reply**
6. Wait ~3-5 seconds for the AI call
7. **Expected output**: `"Perfect, I'll talk to you Sunday at 1pm."` (or similar — the AI output varies slightly between calls)

If the reply references Sunday by name, uses "I/me" (first person, not "someone will"), and doesn't re-ask "what day" — **the full fix chain is working.**

### 3. Verify the history panel

After running step 2, look at the **right-hand sidebar**. You should see a new entry at the top with:
- A "ai-reply" badge (blue)
- "Michael Kefauver" (or the lead name)
- A preview of the reply text
- The relative time ("just now" / "a few seconds ago")

Click the history item — it should rehydrate the form with the same lead ID + inbound, and show the result in the main panel.

Click the trash icon (appears on hover) — it should delete the run and remove it from the list.

### 4. Verify the `re-engage` mode

1. Pick any real lead (ideally one that's gone stale or has meaningful SMS history — Michael works)
2. Leave "Simulated inbound message" **empty** (re-engage mode doesn't need one — it's a proactive outbound)
3. Switch mode to **re-engage**
4. Click **Simulate reply**
5. **Expected output**: A warm re-engagement opener that references something specific the lead said previously, NOT the generic `"Hey [name], how's your week going?"` that was hitting earlier tonight. The fix is deployed.

### 5. Verify the power-user system prompt override

1. Click "Advanced: custom system prompt"
2. Paste a test prompt like: `You are a pirate. Every reply must start with "Arrr" and end with "matey".`
3. Click Simulate reply
4. **Expected output**: The bot's reply should now be pirate-themed, confirming the override works. This proves the `systemPromptOverride` field is making it all the way through to Anthropic.

### 6. Verify persistence survives a reload

1. Run 2-3 tests
2. Hard-refresh the page (Cmd+Shift+R)
3. Navigate back to the Playground tab
4. **Expected**: All your recent runs should still appear in the right sidebar. If they don't, either the Supabase `chat_bot_playground_runs` insert silently failed or the `list_playground_runs` query has a bug. Check the browser Network tab for `chat-bot-api` 4xx/5xx responses.

### 7. Verify it's team-wide (if you have team access)

- Ask Andrew or James to load the page and run a test on one of their leads
- Their runs should appear in THEIR history only (not yours) — RLS is scoped by `user_id`
- Verify by running the same test lead as them on your side — you should NOT see their runs in your sidebar

---

## Potential rough edges (things to watch for)

### a) The dry-run takes 3-15 seconds

Anthropic latency varies. The UI shows a loading spinner during the call. If it takes longer than ~30 seconds, the edge function will timeout (I set it to 30s in `chat-bot-api/index.ts` line ~2500) and return a 502. If you see this consistently, increase the timeout or investigate upstream Anthropic performance.

### b) The 10/minute rate limit is per-agent

Rate limited at the standard-chat-bot HTTP layer. If you test the same agent rapidly 11+ times in a minute, you'll get `RATE_LIMITED` errors. This is intentional — each call costs ~$0.005-0.01. Different agents (you vs Andrew) have independent buckets.

### c) System prompt override bypasses ALL guardrails

When a user pastes a custom system prompt, `buildGuardrailsBlock`, lead source rules, and every hard-coded safety rule are **skipped**. The AI runs with only the override. There's a visible ⚠ warning in the UI next to the textarea. This is intentional (it's a power-user experimentation tool) but worth noting — if a team member uses this to craft a new prompt, they should copy the winning prompt back into the real agent config, not rely on the override.

### d) History items only show metadata, not the full system prompt

The list view (`list_playground_runs`) returns a summary to keep payloads small. Clicking a history item rehydrates the form using just the list item data. If you want to see the full system prompt that was used for a historic run, you'd need to re-run the test (it'll produce a fresh prompt with the same inputs). A future improvement: add a "View details" modal that calls `get_playground_run` to fetch the full row including `system_prompt`.

### e) The "copy" button on the reply puts it in your clipboard

Small UX point: the goal is for users to copy good AI-generated replies and paste them into Close manually if they like what the bot would say. Just confirming that flow is obvious.

### f) Deleting a run is per-user only

RLS enforces that users can only `DELETE` their own runs (policy: `users_delete_own_playground_runs`). Super-admin acting "on behalf of" another user via `targetUserId` will delete that user's runs — double-check this if you use admin acting.

---

## How the pieces fit together (data flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│ commissionTracker React UI                                          │
│                                                                     │
│   PlaygroundTab.tsx                                                 │
│   ├── form: leadId, inbound, mode, systemPromptOverride             │
│   ├── calls useChatBotDryRun().mutateAsync(...)                     │
│   │       └── chatBotApi<DryRunReplyResult>("dry_run_reply", {...}) │
│   │           └── supabase.functions.invoke("chat-bot-api", {...})  │
│   │                                                                 │
│   └── history panel: useChatBotPlaygroundRuns({ limit: 20 })        │
│           └── chatBotApi<{ runs: ... }>("list_playground_runs")     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Supabase edge function: chat-bot-api                                │
│                                                                     │
│   case "dry_run_reply":                                             │
│     ├── validates closeLeadId + mode + inbound                      │
│     ├── fetch() → standard-chat-bot API (30s timeout)               │
│     │   POST /api/external/agents/:agentId/dry-run-reply            │
│     │   Headers: X-API-Key: $CHAT_BOT_API_KEY                       │
│     ├── on success: INSERT INTO chat_bot_playground_runs            │
│     └── returns the dry-run result to the UI                        │
│                                                                     │
│   case "list_playground_runs":                                      │
│     └── SELECT * FROM chat_bot_playground_runs                      │
│         WHERE user_id = $effectiveUserId                            │
│         AND chat_bot_agent_id = $agentId                            │
│         ORDER BY created_at DESC LIMIT 20                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ standard-chat-bot (Railway)                                         │
│                                                                     │
│   /api/external/agents/:agentId/dry-run-reply                       │
│     ├── rate limit: 10/min per agentId                              │
│     ├── validates X-API-Key                                         │
│     └── calls dryRunReply() — pure, read-only function              │
│                                                                     │
│   dryRunReply():                                                    │
│     ├── Load conversation + agent + Close API key (read-only)       │
│     ├── Fetch lead from Close API (read-only)                       │
│     ├── Load local message history (read-only)                      │
│     ├── Build system prompt via buildGuardrailsBlock + lead source  │
│     │   rules (or use systemPromptOverride if provided)             │
│     ├── Call Anthropic (claude-sonnet-4-6)                          │
│     ├── Run enforceReplyGuardrails + sanitizeSmsReply               │
│     └── Return { rawReply, finalReply, violations, metadata, ... }  │
│                                                                     │
│   NO DB WRITES. NO SMS SENT.                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Env vars that must be set on the edge function

Already set in production (Supabase dashboard → Edge Functions → chat-bot-api → Environment variables):

| Env var | Value | Why |
|---|---|---|
| `STANDARD_CHAT_BOT_API_URL` or `CHAT_BOT_API_URL` | `https://api-production-de66.up.railway.app` | The standard-chat-bot API base URL |
| `STANDARD_CHAT_BOT_EXTERNAL_API_KEY` or `CHAT_BOT_API_KEY` | `225f56e0103b5b045e8350c30143f8e48b398e5a1fe0255187a9cd525c01faf5` | X-API-Key for authenticating to standard-chat-bot's external API |

These were already set when the chat-bot-api edge function was created for the Close connection flow. The new `dry_run_reply` case reuses them.

---

## What to do if something's broken

### Symptom: Playground tab doesn't appear

- Check `src/features/chat-bot/ChatBotPage.tsx` line 246 — the tab is gated behind `hasAccess && agent && (setupComplete || wizardDone)`. Make sure all four are true.

### Symptom: "Simulate reply" hangs forever / 502 error

- Check the Network tab. If `chat-bot-api` returns 502, the edge function hit its 30-second timeout. This is usually Anthropic being slow.
- Check Railway logs: `railway logs --service api` and look for `dry-run-reply` entries.
- If the edge function itself is down, check Supabase Dashboard → Edge Functions → chat-bot-api → Logs.

### Symptom: History sidebar is empty even after running tests

- Open the browser Network tab. Look at the `chat-bot-api` POST requests.
- If `dry_run_reply` returns 200 but `list_playground_runs` returns empty:
  - The INSERT to `chat_bot_playground_runs` may have silently failed. Check edge function logs for `[dry_run_reply] failed to persist playground run`.
  - Verify RLS with psql:
    ```sql
    SELECT count(*) FROM chat_bot_playground_runs WHERE user_id = '<your-user-id>';
    ```

### Symptom: "Rate limited" errors

- You hit the 10 req/min/agent limit on standard-chat-bot's side. Wait 60 seconds.
- If a team member is complaining and they haven't run 10+ tests, check if you both share an agent. Each agent has its own bucket.

### Symptom: System prompt override doesn't change the output

- Make sure the textarea in "Advanced" actually has content when you click Simulate.
- The override is passed through the edge function → standard-chat-bot. Check the Network tab for the outgoing request body — it should include `systemPromptOverride: "..."`.
- On standard-chat-bot side: `/Users/nickneessen/projects/standard-chat-bot/apps/api/src/lib/dry-run-reply.ts` line ~230 checks `if (systemPromptOverride !== undefined && systemPromptOverride !== null)`. Confirm your override is a non-null non-undefined string.

---

## Summary

- **Everything is live.** The migration is applied, the edge function is deployed, and the frontend is pushed (Vercel will auto-deploy).
- **Your team can use it immediately** once Vercel finishes the deploy (~2-5 min after push).
- **Nothing else needs to be run.** The handoff is complete on my end — your job is just to QA the UX and confirm the 7 verification steps above.
- **If you find bugs**, file them with the exact lead ID you tested against and the observed vs. expected output. I can rerun them via the CLI script or fix the prompt directly.

Questions or issues? Ping me with the lead ID + what went wrong and I'll reproduce it.
