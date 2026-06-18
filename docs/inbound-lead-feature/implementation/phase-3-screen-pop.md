# Phase 3 — Realtime Agent Screen-Pop (`InboundCallProvider`)

**Status:** Not started. **Planned date:** TBD (after Phase 2 is on prod).

The frontend half of the inbound-call flow. Phase 2 writes an `inbound_calls` row on every
incoming call; Phase 3 is the React layer that listens to those writes over Supabase realtime
and shows the assigned agent a pop-up with the caller's details and a quick path into their
intake form.

This phase builds **no new database objects** — every needed column exists from Phase 0.

---

## 1. What to build

| Component | Path (proposed) | Role |
|---|---|---|
| `InboundCallProvider` | `src/contexts/InboundCallContext.tsx` | App-wide provider; opens one realtime channel per authenticated agent; manages active-call state |
| `InboundCallDialog` | `src/features/inbound-crm/components/InboundCallDialog.tsx` | The pop-up dialog; shows caller info + links into the client intake form |
| Mount point | `src/index.tsx` | Wrap inside `AuthProvider` + alongside `NotificationProvider` (same nesting level) |

No new routes. No new RPCs. No migration.

---

## 2. How it works

### Realtime subscription

Follow the `NotificationContext` pattern exactly:

1. Inside a `useEffect` keyed on `user?.id`, create a named channel:
   `supabase.channel(`inbound-call:${user.id}`)`.
2. Register one `.on("postgres_changes", …)` listener:
   - `event: "INSERT"`, `schema: "public"`, `table: "inbound_calls"`,
     `filter: `agent_id=eq.${user.id}``
3. Call `.subscribe()` — track `SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` as `connectionStatus`.
4. Return cleanup: `supabase.removeChannel(channel)` — fires on unmount or when `user.id` changes.

No secondary filter is needed client-side. The `inbound_calls_select_own` RLS policy
(`USING (agent_id = (select auth.uid()) AND imo_id = get_my_imo_id())`) means Supabase's
realtime layer only delivers rows the agent is allowed to read — so every INSERT that arrives
is already scoped to this agent in this tenant. Realtime enforces RLS on the published row
before it reaches the client.

### INSERT handler

On each incoming payload:

- Read `payload.new` typed as `InboundCallRow` (the Phase 0 table shape).
- If `patch_only === true`: the POST arrived before the call existed (a speculative billing
  record, no AoR was resolved) — **skip the pop**. No caller to show.
- Otherwise: set the active-call state. The provider exposes `{ activeCall, dismiss }` on its
  context.

### Dismiss on call end

Register a second `.on("postgres_changes", …)` on `event: "UPDATE"` (same table, same filter).
When `payload.new.status === 'ended'` arrives, clear `activeCall` automatically. This mirrors
the PATCH-end signal described in the README onboarding decisions ("billing PATCH is the
end-of-call event").

### Dialog

`InboundCallDialog` renders while `activeCall` is non-null:

- **Caller info:** `ani` (raw), `phone_e164` (normalized; may be null if the ANI was
  un-normalizable), `state`, `call_program`, `offer_id`.
- **Client link:** if `client_id` is set (Phase 2's POST either matched an existing client or
  created a new one), render a button that navigates to that client's intake/detail page. If
  `client_id` is null (unassigned call — the pcId wasn't recognized), show a "Create client"
  CTA instead.
- **Dismiss / minimize:** lets the agent close the pop manually without waiting for the PATCH;
  `dismiss()` just clears `activeCall` in the provider state — it does **not** write to the DB.
- Use the project's standard dialog primitive (shadcn `Dialog` or the Board modal pattern).
  Keep it compact: caller identity + one action button.

---

## 3. Singleton behavior

**One pop per agent at a time** — this is confirmed behavior (see README onboarding decisions:
"singleton pop = one call/agent").

If a second INSERT arrives while a pop is already showing: **replace**. Swap `activeCall` to
the new row immediately. The simpler alternative (queue) would require managing a list and
dismissal ordering; replacement is appropriate because two concurrent calls to the same agent
should not occur in normal operation, and if they do (race at the dialer), the most recent
call is the actionable one.

---

## 4. Offline / not-logged-in agents

**No fallback.** This is a live-session-only pop. If the agent is not logged in when the call
arrives, the `inbound_calls` row still exists (Phase 2 wrote it) but no pop fires. The agent
can see missed calls via the call history on their Clients page (Phase 4). No push notification,
no email, no badge — by owner decision.

---

## 5. Reuse (no reinvention)

- **Realtime pattern:** exact shape of `NotificationProvider` — named channel, synchronous
  channel creation in `useEffect`, `supabase.removeChannel(channel)` in the cleanup. Do not
  invent a new subscription wrapper.
- **Provider / mount:** same nesting level as `NotificationProvider` in `src/index.tsx`,
  inside `AuthProvider` so `user?.id` is available.
- **Dialog:** reuse the project's existing shadcn `Dialog` or Board modal primitive; do not add
  a new dialog library.
- **Client navigation:** reuse whatever route/link pattern the Clients page (Phase 4) will
  expose for a client detail view. If Phase 4 isn't built yet, placeholder the navigation but
  do not dead-end the button — link to `/clients/${client_id}` and let Phase 4 register the
  route.

---

## 6. Verification plan (local)

1. Seed an agent with a registered pcId (existing `crm_register_agent_pcid` smoke fixture).
2. Log in as that agent in a browser tab.
3. Fire `crm-mock-caller.ts` POST with the agent's pcId — observe the pop appears within
   ~1 second.
4. Fire PATCH with `billable=1` — observe the pop auto-dismisses.
5. Fire a second POST (different `requestTag`) while the first pop is showing — observe pop
   replaces (not stacks).
6. Fire a POST with an unrecognized pcId — observe no pop (or pop with null `client_id`
   and "Create client" CTA, depending on Phase 2's assignment outcome).
7. Log out; fire a POST — confirm no JS error and no stale subscription.
8. `npm run build` with zero TypeScript errors.

---

## 7. Deploy

No migration to apply. No edge function to deploy. Deploy is a standard Vercel frontend push.

- Phase 2's `crm-leads` function must be deployed first (it writes the rows Phase 3 consumes).
- Realtime on `inbound_calls` was enabled in Phase 0 (`REPLICA IDENTITY FULL` + publication).
  Confirm the table is in the `supabase_realtime` publication on prod before deploying
  (`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`).
- `database.types.ts` regen: defer to prod-apply (same policy as Phase 0/1/2 — local-only
  tables until prod migration runs).

---

## 8. Out of scope

Phase 4 (Clients page — own-book per agent + per-client inbound-call history), Phase 5
(observability, PII/retention, hardening), Phase 1b (credential/pcId admin UI).

---

## 9. Open questions / possible follow-ups

- **Rehydration on reconnect.** If the agent's browser tab is backgrounded and the realtime
  socket drops, the tab may miss an INSERT. On reconnect, a one-time query for open calls
  (`status <> 'ended'` + `agent_id = user.id`) could restore an active pop. The Phase 0 index
  `idx_inbound_calls_agent_open` supports this. Decide at implementation time whether to include
  it in Phase 3 or defer to Phase 5.
- **`fired_pop` flag.** The Phase 0 column exists and `crm_upsert_call` sets it. Phase 3 reads
  this passively (to confirm the row is pop-eligible) but does not need to write it — the RPC
  already handles that server-side. No action needed here unless the product requires tracking
  whether the frontend actually displayed the pop (a separate concern, Phase 5 territory).
