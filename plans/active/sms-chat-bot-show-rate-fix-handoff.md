# Handoff: Fix `showRate` in standard-chat-bot Analytics API

**Target repo:** `standard-chat-bot` (external microservice, not CommissionTracker)
**Date:** 2026-04-07
**Reporter:** Nick

## Context

The CommissionTracker SMS Chat Bot page → **My Analytics** tab → **Appointments** card displays metrics fetched from the external `standard-chat-bot` microservice. Three of the five metrics work correctly, but `showRate` is **always returning `0.0%`** for at least one production user, who confirms they have completed appointments.

This handoff is for the dev (or Claude session) working in the **standard-chat-bot** repo. The bug is on that side; CommissionTracker is just a thin proxy. We've verified our proxy and display layer are wiring the value through correctly.

## Observed Bug

User opens **SMS Chat Bot → My Analytics**, sees this on the Appointments card:

| Metric | Value | Status |
|---|---|---|
| Appointments | 102 | ✅ correct |
| Booking Rate | 7.2% | ✅ correct |
| **Show Rate** | **0.0%** | ❌ **BUG — should be non-zero** |
| Cancel Rate | 12.8% | ✅ correct |
| Avg days to appointment | 0.9 | ✅ correct |

**Key debugging signal:** booking rate and cancel rate both work, only `showRate` is broken. This points to an isolated query / aggregation bug in whatever computes `appointments.showRate`, not a field-mapping or response-shape problem.

## Data Flow (CommissionTracker side — verified working)

```
AppointmentMetrics.tsx (display)
  └─ AnalyticsTab.tsx
      └─ useChatBotAnalytics(from, to)        ← React Query hook
          └─ chatBotApi("get_analytics", ...)  ← supabase function client
              └─ supabase/functions/chat-bot-api  ← edge function proxy
                  └─ GET https://api-production-de66.up.railway.app
                         /api/external/agents/{agentId}/analytics
                         ?from={ISO date}&to={ISO date}
                  └─ normalizeAnalyticsPayload(payload)  ← rescales rates
                  └─ returns to client
```

### Files on the CommissionTracker side (do NOT need changes)

| File | Purpose |
|---|---|
| `src/features/chat-bot/components/analytics/AppointmentMetrics.tsx:14` | Reads `data.showRate`, clamps to `[0, 1]`, formats as `${(showRate * 100).toFixed(1)}%`. |
| `src/features/chat-bot/components/AnalyticsTab.tsx` | Container; passes date range from picker. |
| `src/features/chat-bot/hooks/useChatBotAnalytics.ts:114-126` | TanStack Query hook, 5-min stale time. Types `appointments.showRate: number`. |
| `supabase/functions/chat-bot-api/index.ts:2444-2530` | Forwards request to external API and runs `normalizeAnalyticsPayload`. |
| `supabase/functions/chat-bot-api/index.ts:450-453` | `normalizeRate(val) → val > 1 ? val / 100 : val` (handles both `0.85` and `85` formats). |

## Contract: What CommissionTracker Expects

The external API at `GET /api/external/agents/{agentId}/analytics?from=...&to=...` must return JSON with this `appointments` object:

```json
{
  "appointments": {
    "total": 102,                    // integer count
    "bookingRate": 0.072,            // 0..1 OR 0..100 (proxy normalizes)
    "showRate": 0.85,                // 0..1 OR 0..100  ← currently returning 0
    "cancelRate": 0.128,             // 0..1 OR 0..100
    "avgDaysToAppointment": 0.9      // float, days
  }
}
```

**Important contract note:** Our proxy's `normalizeRate()` accepts EITHER decimal (`0.85`) OR percentage (`85`). If the external service returns `0.85`, we use it as-is. If it returns `85`, we divide by 100. **Returning `0` (integer or float) is interpreted as "0% show rate"** — there is no sentinel for "missing data," so a missing value collapses to a real-looking 0.

## What `showRate` Should Actually Compute

Based on the documented semantics in `docs/external-api-reference.md`:

```
showRate = (appointments where status = 'completed' / 'shown' / 'attended')
           ÷ (total appointments in date range)
```

Cross-check against the values we DO see correctly:
- `cancelRate = 12.8%` → 13 of 102 appointments cancelled
- That leaves 89 appointments NOT cancelled
- A realistic show rate is somewhere in `(0%, 89/102=87.3%]`
- The current `0.0%` is clearly impossible — if there were truly zero shows, the user would have noticed long ago

## Likely Root Causes (Investigation Checklist)

Investigate in this order — start with #1, it's the most likely:

1. **Status enum mismatch.** The query that computes `showRate` is probably filtering on a status value that no longer exists in the DB. Look for hardcoded values like `'shown'`, `'completed'`, `'attended'`, `'show'`. Compare against the actual `appointment_status` (or whatever column) values currently in production. The cancel-rate query works, so look at how it filters and apply the same pattern.

2. **JOIN dropping rows.** If `showRate` is computed via a JOIN to a separate `appointment_outcomes` / `appointment_status_history` table, and rows for a status haven't been backfilled, the numerator will be zero. The cancel rate may use a different (working) column on the main appointments table.

3. **Date-range boundary bug.** Check whether `showRate` is using a different date column than the others (e.g. `completed_at` vs `scheduled_at` vs `created_at`). If `completed_at` is null for in-window appointments, the count will be zero.

4. **Division-by-zero short-circuit returning 0 instead of null.** If the code does `shown / total` and short-circuits to `0` when `total === 0`, but it's *also* returning `0` when `shown === 0` and `total > 0`, that would explain a hard zero.

5. **Per-agent permission filter.** Some queries may filter by `agent_id` or `org_id` and return zero if a join condition is wrong only for the show-rate query.

## Recommended Investigation Steps (in standard-chat-bot repo)

```bash
# 1. Find where showRate is computed
rg -n 'showRate|show_rate' --type ts --type js --type py

# 2. Find the analytics endpoint handler
rg -n '/api/external/agents/.+/analytics' --type ts --type js

# 3. Compare to where cancelRate is computed (it works — copy its pattern)
rg -n 'cancelRate|cancel_rate' --type ts --type js

# 4. List actual appointment status values in prod DB
#    (whatever tool you use to query the chat-bot DB)
SELECT status, COUNT(*)
FROM appointments
WHERE created_at >= '2026-03-01'
GROUP BY status;
```

## Reproduction

1. Log into CommissionTracker as the affected user
2. Navigate to **SMS Chat Bot** → **My Analytics**
3. Use default date range (or last 30/60 days)
4. Observe Appointments card → Show Rate `0.0%`
5. Hit the external API directly to confirm the upstream is at fault:

```bash
curl -H "x-api-key: $STANDARD_CHAT_BOT_EXTERNAL_API_KEY" \
  "https://api-production-de66.up.railway.app/api/external/agents/{AGENT_ID}/analytics?from=2026-03-01&to=2026-04-07" \
  | jq '.appointments'
```

You should see `"showRate": 0` (or `0.0`) in the raw upstream response — that confirms the bug is in standard-chat-bot, not CommissionTracker.

## Definition of Done

A fix in standard-chat-bot is complete when:

- [ ] `GET /api/external/agents/{agentId}/analytics` returns a non-zero `showRate` for an agent who has completed appointments in the requested date range
- [ ] `showRate + cancelRate + (no_show_rate or pending_rate)` reasonably accounts for `total` (sanity check, doesn't have to sum to exactly 1.0 if there are scheduled-but-not-yet-occurred appointments)
- [ ] Spot-check the value: query the underlying DB manually, compute `shown / total`, compare to API output
- [ ] Backfill or migration applied if the root cause is missing/stale status data
- [ ] After fix is deployed to Railway, refresh CommissionTracker SMS Chat Bot → My Analytics → Appointments card and confirm Show Rate is non-zero

## After You Fix It

Once standard-chat-bot is fixed and deployed, please write an updated `docs/external-api-reference.md` (in CommissionTracker) covering:

- The exact response shape of `/api/external/agents/{agentId}/analytics`
- Whether rates are returned as `0..1` or `0..100`
- The semantic definition of each rate (numerator and denominator)
- The status enum values used for `shown`, `cancelled`, etc.
- Any new fields added during the fix

Then come back to CommissionTracker — Claude will diff the new doc against `useChatBotAnalytics.ts` types and `normalizeAnalyticsPayload()` to confirm the wiring is still correct end-to-end.

## CommissionTracker-Side Changes Considered and Rejected

For completeness, here's what we considered doing in CommissionTracker and why we did NOT do it:

- **Calculate `showRate` locally from raw counts.** Rejected because the external API doesn't expose raw `shown` / `cancelled` counts — only the pre-computed rates. We'd need an API change anyway.
- **Fall back to a Supabase table query.** Rejected — appointment lifecycle data lives in the standard-chat-bot service's own DB, not in CommissionTracker's Supabase.
- **Display "—" instead of `0.0%` when value is exactly 0.** Rejected as a band-aid that hides the real bug and could legitimately mask a real `0.0%` for an agent who genuinely has no shows.

The right fix is upstream.
