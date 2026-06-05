# Continuation — Jarvis voice worker resilience (Fly.io)

**Created:** 2026-06-05 · **Status:** ✅ DEPLOYED + VERIFIED ON PROD — 2 owner follow-ups (SMS phone, merge-to-activate-cron)
· **Type:** infra (owner-gated flyctl) · **Branch:** feat/jarvis-durable-memory (uncommitted code; deploys are live)

## ✅ SHIPPED + PROVEN ON PROD (2026-06-05)
- Migration applied to PROD (IPv6 host verified; 1 seeded row; RLS on).
- Functions deployed: `voice-worker-heartbeat` (**--no-verify-jwt**) + `voice-worker-health-check`.
  Secrets set: HEARTBEAT_TOKEN, FLY_API_TOKEN (app-scoped `fly tokens create deploy`), VOICE_ALERT_EMAIL.
- Worker deployed (Fly v16) with heartbeat code; restart policy codified **retries=10** on BOTH machines
  (FOUND+FIXED a bug: fly.toml field is `retries`, not `max_retries` — `max_retries` was silently
  ignored → Fly defaulted to 3; corrected + redeployed). Standby binding preserved.
- PROVEN E2E on prod: heartbeat flows (real machine_id, fresh, advancing) · monitor healthy path
  (200, fly started=1/2) · **down via heartbeat-staleness while Fly still showed `started`** (the
  B-over-A win) → `alert_down` → DOWN email delivered · de-dup (`down_suppressed`) · restore →
  `alert_recovered` → recovered email · `send-automated-email` accepts service-role caller (200) ·
  **voice still reaches LISTENING** (`voice-repro.py POLL_STEPS=80`).

## ⚠️ TWO OWNER FOLLOW-UPS (not blocking what's deployed, but required for FULL live monitoring)
1. **SMS disabled until a phone is set.** `VOICE_ALERT_PHONE` is unset → monitor sends EMAIL ONLY
   (it logs "skipping SMS"). Enable with `supabase secrets set VOICE_ALERT_PHONE=+1… --project-ref
   pcyaqwodnyrpkaiojnpz` — **takes effect with NO redeploy**.
2. **Cron is NOT firing until merged to main.** GitHub Actions `schedule`/`workflow_dispatch` only
   run on the DEFAULT branch. The functions/worker are live and proven via manual curl, but the
   automated 15-min check does not run until this work is committed + merged to main. Until then,
   monitoring is manual-invoke only.
- Also deferred: database.types.ts NOT regenerated (CLI 2.23.4 emits an unreviewable ~16.5k-line
  full-file reshuffle; the new table is Deno-only so the app builds fine — do a clean regen later).

## What this is
Backend half of the "voice screen vanishes" problem. Frontend half already shipped (PR #15 →
`f4ce550b`: down worker now shows a Retry screen). This closes the root cause: a dead/hung worker
now **alerts the owner (SMS + email)** instead of failing silently.

## Live-state findings (the original continuation plan was stale)
Investigated the running Fly app. The worker is HEALTHIER than assumed and served a clean multi-turn
session minutes before this work:
- Restart on crash ALREADY present: `restart.policy = on-failure, max_retries = 10` (Fly default).
- Host-failure failover ALREADY present: a STOPPED standby machine (`"standbys": [...]`, ~free).
- `auto_rollback = true`; 14/14 deploys complete.
- **Answer to "min-running mechanism for a serviceless worker": there isn't one** — `min_machines_running`
  is tied to service auto-stop, which this no-`[http_service]` worker lacks. Durability = restart +
  standby + auto_rollback + **alerting** (the genuine gap).

## Owner decisions (made this session)
- Detection = **Option B** (machine-state + heartbeat dead-man's-switch).
- Alerts = **SMS + Email** (reuse `send-sms` + `send-automated-email`).
- Redundancy = **keep current** (no 2nd always-on machine; standby stays).

## Honest coverage (heartbeat limitation — VERIFIED in SDK source)
`@livekit/agents@1.4.5` does NOT publicly expose LiveKit-registration state (`#session`/`#id` private;
`event` emits `never`; no built-in health server; on Cloud a custom `loadFunc` is force-reset — see
`worker.js` lines 209-223 & 528-577). So the heartbeat proves **event-loop liveness + outbound
reachability**, NOT "still registered with LiveKit". Caught: stop, exhausted-retries, crash, event-loop
wedge. **Residual gap** (deferred): silently-deregistered-but-alive + upstream outages → only a synthetic
voice probe (future hourly Option C) closes those.

## Files (all written + validated this session)
- `supabase/migrations/20260605162706_voice_worker_health.sql` — singleton RLS-locked health table
  (service-role only), seeded 1 row. ✅ transactional dry-run on local (BEGIN…ROLLBACK) clean.
- `supabase/functions/voice-worker-heartbeat/index.ts` — receiver; **deploy with `--no-verify-jwt`**;
  guarded by shared `HEARTBEAT_TOKEN`; upserts last_seen_at (omits monitor_status so de-dup survives).
- `supabase/functions/voice-worker-health-check/index.ts` — monitor; Fly machine-state + heartbeat
  staleness; transition de-dup; SMS+email fan-out. Auth: bearer === SERVICE_ROLE_KEY.
- `supabase/functions/voice-worker-health-check/decide.ts` (+ `decide.test.ts`) — pure decision brain.
  ✅ 6/6 deno tests pass.
- `.github/workflows/voice-worker-health.yml` — `*/15` cron + dispatch → curls the monitor (reuses
  `SUPABASE_SERVICE_ROLE_KEY` repo secret; mirrors notification-digests.yml).
- `services/jarvis-voice-worker/src/heartbeat.ts` (+ wired into `src/agent.ts`) — process-level
  `setInterval` ~30s POST; MAIN process only (gated `!argv[1].endsWith('job_main.js')`); no-op without
  HEARTBEAT_TOKEN. ✅ worker typecheck + build + 21 tests pass.
- `services/jarvis-voice-worker/fly.toml` — explicit `[[restart]]` block + documented reliability model.

## DEPLOY RUNBOOK (owner-gated; do in order)
Secrets to decide first: generate a strong `HEARTBEAT_TOKEN` (e.g. `openssl rand -hex 32`); owner's
`VOICE_ALERT_PHONE` (E.164) + `VOICE_ALERT_EMAIL` (default nick@nickneessen.com); a Fly token —
prefer read-scoped, fallback `fly tokens create deploy -a standardhq-jarvis-voice`.

1. **Prod migration** (runner DEFAULTS TO LOCAL — must prefix prod URL):
   `DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-migration.sh supabase/migrations/20260605162706_voice_worker_health.sql`
   (source .env first so $REMOTE_DATABASE_URL is set; verify host = prod).
2. **Regen types** (table touches schema): `npx supabase gen types typescript --project-id pcyaqwodnyrpkaiojnpz > src/types/database.types.ts` ; commit.
3. **Edge fn secrets** (Supabase): set `HEARTBEAT_TOKEN`, `FLY_API_TOKEN`, `VOICE_ALERT_PHONE`,
   `VOICE_ALERT_EMAIL` (and optional `FLY_APP_NAME`).
4. **Deploy functions:**
   `supabase functions deploy voice-worker-heartbeat --no-verify-jwt --project-ref pcyaqwodnyrpkaiojnpz`  ← `--no-verify-jwt` is LOAD-BEARING
   `supabase functions deploy voice-worker-health-check --project-ref pcyaqwodnyrpkaiojnpz`
5. **Worker** (brief voice blip — Retry screen covers it): `fly secrets set HEARTBEAT_TOKEN=… -a standardhq-jarvis-voice` (triggers redeploy) ; then `fly deploy` if needed for the fly.toml/code.

## VERIFICATION (de-raced — per review)
- **HARD heartbeat gate (separates B from "A in disguise"):** after worker deploy, read
  `select last_seen_at from voice_worker_health` TWICE ~60-90s apart → must go NULL→fresh AND ADVANCE.
  If it stays NULL, the heartbeat is dead (likely `--no-verify-jwt` missing or wrong token/URL).
- **Alert path, zero-downtime + no race:** temporarily set the monitor's `FLY_APP_NAME` secret to a
  bogus app → Fly returns `[]` → started=0 → flyDown → manually `workflow_dispatch` (or curl) the
  monitor → confirm **SMS + Email land** (also confirms send-automated-email accepts the service-role
  caller); run again → no duplicate (de-dup); restore `FLY_APP_NAME` + run → **🟢 recovery** SMS+email.
  (Do NOT backdate last_seen_at — the live worker re-upserts it every 30s and un-backdates mid-test.)
- **Voice still works:** `scripts/voice-repro.py POLL_STEPS=80` → LISTENING.
- **Standby preserved:** `fly machine status <standby> --display-config` still shows `standbys`
  (both machines were v14 last session, so the standby survived the prior deploy — low risk).
- **GH Action:** `workflow_dispatch` the new workflow → 200.

## Notes
- Did NOT add: 2nd always-on machine, memory bump (no OOM evidence; 2GB only if jobMemoryWarn fires),
  max_retries increase, in-worker HTTP health endpoint (preserves no-public-HTTP).
- Unrelated working-tree changes (AuthContext, lib/*, smsService) remain uncommitted — leave them.
