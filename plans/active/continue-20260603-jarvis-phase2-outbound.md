# Jarvis Phase 2 — Outbound Actions (SMS → voice-confirm → Discord)

> ## 🟢 SESSION HANDOFF — START HERE (next session)
> **Prompt to open with:** "Continue Jarvis Phase 2. Executor send-path hardening (audit-on-send +
> COUNT-based caps) is shipped/deployed and prod drift is corrected. Do the next buildable piece,
> keeping rate-limiting, security, and edge cases front of mind."
>
> **DONE + DEPLOYED — 2026-06-03 (continued session):**
> - ✅ **Executor send-path hardening** (commit `96504d3f`, **assistant-action-execute = v10**):
>   (a) execute-time **audit row** via `log_assistant_audit` for EVERY terminal outcome
>   (executed/failed/blocked, `recipient_hash`=sha256, never raw PII) — closes the gap where the
>   actual SEND was unlogged; (b) **COUNT-based caps** via new SECDEF RPC `assistant_send_caps`
>   (migration `20260603170136`, on prod): per-user **distinct-recipient/day** (sms 15/email 30,
>   repeat-to-known is free) + **IMO-wide/day** ceiling (300, sms+email only). Run READ-ONLY
>   before the incrementing counter; leave the row `approved` (retryable). Suppression
>   (`{suppressed:true}`) recorded as a denial, never mislabeled `executed`. Quiet-hours deferred
>   to SMS-go-live. Tests: action-limits 5/5; `scripts/test-assistant-send-caps.sh` proves SECDEF
>   tenant isolation **on prod**; deno orchestrator 130/0.
> - ✅ **PROD DRIFT CORRECTED:** the prior session's `assistant_audit_log` / `log_assistant_audit`
>   / `assistant_resolve_contact` migrations were local-only (misreported as prod). Applied all 3
>   to prod + re-verified tenancy tests **against prod**. The executor/orchestrator audit writes
>   + `resolveContact` now actually function on prod (were silently no-opping / erroring).
> - ✅ Master plan **promoted to `docs/features/jarvis-agentic-platform-master-plan.md`** +
>   **ingested** into the wiki (`command-center-assistant.md`, lint 0).
>
> **DONE prior session (still true):** voice end-to-end (BVC on, orchestrator v46);
> capability kernel + guard hardening + `getWeather` + `assistant_audit_log`; PR 2.1
> `resolveContact` (Option A — recipient stays HUMAN-entered); executor per-action-class daily
> caps (SMS 25/email 50/Close 60).
>
> **NEXT — recommended order (each independently shippable behind the approval gate + audit):**
> 1. ~~**Rate-limit refinements**~~ — distinct-recipient/day cap + IMO-wide daily ceiling **DONE
>    (2026-06-03, executor v10)**. REMAINING: **quiet-hours 8am–9pm** — deferred to the SMS-go-live
>    PR (it's TCPA-quiet-window logic, applies ONLY to SMS, which is gated on prereq #2; the
>    recipient-timezone source — area-code heuristic vs sender-tz vs stored recipient tz — is a
>    decision to make THERE, alongside the A2P/TCPA sign-off). Email/Close aren't quiet-hour-bound.
> 2. **PR 2.2 — voice "say yes to send"** (needs the voice **token-budget** owner decision):
>    worker confirm state + deterministic affirmative classifier (NEVER the LLM) +
>    `assistant-action-confirm` edge fn + restate-from-frozen-row. See §PR 2.2 below.
> 3. **PR 2.3 — Discord** (needs the owner to **provision a Discord bot + token**) + PR 2.0
>    guard-wiring (thread `connectedProviders`/`userPermissions` LAZILY here). See §PR 2.3/2.0.
>
> **OWNER PREREQS (blockers):** (1) Discord bot token; (2) A2P 10DLC/TCPA sign-off before real
> SMS *sends* in prod (drafting is fine); (3) voice token-budget ceiling.
>
> **🔎 CODE-REVIEW FOLLOW-UPS (xhigh review of the executor hardening; quick wins applied in
> `1b298fca`-range, these two deferred):**
> - **#1 Email suppression — ✅ ASSISTANT GATE DONE + ROOT-CAUSE BUG FIXED (`c011fc7b`, exec v13).**
>   Building the gate uncovered that email suppression was **broken platform-wide**: the email
>   callers used `p_contact_type`/`p_contact_value` but the deployed RPCs are
>   `is_suppressed(p_channel,p_contact)` / `add_suppression(...)`, so PostgREST 404'd every call →
>   `isEmailSuppressed` (send-automated-email + process-bulk-campaign) failed OPEN and
>   `email-unsubscribe` never recorded clicks. Fixed the params (code-only — DB was correct) +
>   wired `isEmailSuppressed` into the executor before `send-email`. Verified via PostgREST round-
>   trip on prod; `communication_suppression` empty (no live harm — the writes were dead).
>   **REMAINING (owner decision):** the broader TCPA email pipeline is still NOT deployed —
>   `send-automated-email` on prod is v83 @ 2025-12-16 (predates the suppression code) and
>   `email-unsubscribe`/`process-bulk-campaign` aren't deployed. To make end-to-end email opt-out
>   actually work, deploy those WITH env vars `UNSUBSCRIBE_SECRET` + real `COMPANY_POSTAL_ADDRESS`
>   (CAN-SPAM). NB: `send-automated-email` is 6 months stale on prod — review its full drift before
>   redeploying. See `project_compliance_tcpa_canspam_20260531` memory.
> - **#6 Recipient normalization is triplicated** (TS `hashRecipient` + SQL `assistant_send_caps`
>   + SQL `assistant_recipient_is_allowed`) and must stay byte-identical or the same person
>   hashes/counts differently and a cap is bypassed. **Fix:** one SQL `normalize_recipient()` +
>   one TS util + a cross-layer fixture test asserting agreement. (Also: no shared `sha256hex`
>   util — `bytesToHex` is hand-rolled a 5th time; promote to `_shared`.)
>
> **✅ STANDING DEBT RESOLVED (was a mis-diagnosis):** the "introspection lag" was NOT lag —
> the audit_log/log_assistant_audit/resolve_contact migrations were applied **LOCAL-ONLY and
> misreported as prod** last session (the runner default-to-LOCAL footgun). gen types reads
> prod, so the objects were genuinely absent. **Fixed this session:** applied all three to prod
> (`20260603100930`, `20260603114600`, `20260603121430`) + re-ran the append-only + resolve-
> contact tenancy tests **against prod** (green). **gen types still cannot be committed:** CLI
> 2.23.4 silently DROPS 6 valid prod functions (`accept_platform_terms`, `can_view_agent_details`,
> `mark_invitation_sent`, `invoke_slack_auto_complete_first_sale`,
> `refresh_all_report_materialized_views`, `save_underwriting_session_v2`) — all consumed by the
> frontend — so a raw regen regresses the build. The new assistant objects are edge-only (untyped
> `.rpc()`), so `src/types/database.types.ts` is intentionally LEFT AS-IS (zero frontend impact).
> Revisit only if the frontend ever needs to type one of the new assistant objects.
>
> **SAFETY note (do not regress):** SMS recipient is human-entered (Option A). If "auto-fill
> recipient" (Option B) is ever built, RESTORE an owned-contact allowlist at send time — the
> execute-time check was relaxed to format-only in `20260528195232` *because* the model can't
> set recipients.
>
> **Migration rule:** prefix `DATABASE_URL="$REMOTE_DATABASE_URL"` (runner defaults to LOCAL).
> RLS test pattern: `scripts/test-assistant-{resolve-contact,audit-log,recipient-authz}.sh`.

Execution plan turning the master plan's Phase 2 into ordered, shippable PRs. Grounds on
what already exists (verified): the `assistant_action_requests` draft→approve→execute
lifecycle, the `assistant-action-execute` executor (race-safe `approved→executing` claim +
idempotent `executed_at` guard + per-channel branches + `assistant_recipient_is_allowed` +
`is_suppressed`), `send-sms` (Twilio + STOP/consent), the capability kernel
(`actionClass`/`requiredConnection`/`confirmationRequired`), and `assistant_audit_log`.

Foundation: master plan `docs/features/jarvis-agentic-platform-master-plan.md`. Single law:
the LLM only ever produces a `pending_approval` row; a re-verifying executor performs the
send after explicit human confirmation, under the user's JWT.

---

## Owner prerequisites (block specific PRs — do these first)

1. **Discord bot** (blocks PR 2.3): create a Discord application + bot in the Discord
   developer portal; provide the **bot token** (I'll store it in Vault) and confirm the
   OAuth scopes (`bot identify guilds`). Without it, Discord is plan-only.
2. **A2P 10DLC / TCPA consent for AI-sent SMS** (blocks turning SMS *sends* on in prod):
   AI composing+sending is squarely A2P and may require prior express *written* consent +
   a registered Twilio campaign beyond the STOP gate. Drafting is safe to build now; gate
   real sends on legal sign-off. (Master plan Risk.)
3. **Voice token budget** (blocks heavy voice): the 200k/day bucket counts cache_read each
   turn; confirm turns add round-trips. Pick a voice token ceiling. (Open decision #6.)

## Open decisions to confirm
- **Encryption for OAuth tokens** (#2): do NOT reuse the single shared `EMAIL_ENCRYPTION_KEY`
  for Discord tokens — use a separate key / envelope (pgsodium) before PR 2.3.
- **Hold/Undo window**: 30–60s `approved→scheduled` (execute_after) + a promoter, and whether
  voice-only sends require it. (PR 2.2 or 2.3.)
- **Connections shape**: `agent_connections` (generic) + Discord channel allowlist in
  `metadata`/`discord_connections`. (Master plan Layer 2.)

---

## PR 2.0 — Wire the guard inputs (PREREQUISITE for any requiredConnection/permissioned tool)
The kernel deferred this (see `index.ts:415` comment): `canUseTool(meta, [], { isSuperAdmin })`
passes no `userPermissions`/`connectedProviders`. Before `webSearch` (perm) or Discord
(connection) can be invoked, thread real data in:
- Derive the user's permission codes (from roles/permissions) + linked providers (from
  `agent_connections`) once per request in the orchestrator; pass to `canUseTool`.
- Small, no external deps. Add a guard test that a `requiredConnection` tool is allowed only
  when the provider is connected. **Do this with PR 2.3** (SMS needs neither).

## PR 2.1 — SMS drafting (BUILDABLE NOW — Twilio infra exists, no external setup)
Smallest real "Jarvis sends something" win; only DRAFTING + resolution (sends already work
via the executor). Gate real sends on prereq #2.
- **Migration**: `assistant_resolve_contact(p_name text, p_channel text)` — SECURITY INVOKER
  (RLS scopes the set), over the SAME allowed-set union as `assistant_recipient_is_allowed`
  (define the union in ONE place). Returns lean candidates `{candidateId, displayName,
  contactKind, maskedValue:'(***) ***-1234', suppressed}` — NEVER the raw phone to the model.
- **Tool** `resolveContact` (read, no approval): `{name, channel:'sms'|'email'}` → candidates;
  0→`{available:false,reason:'no_match'}`, >1→return all for disambiguation.
- **Extend `draftSmsMessage`**: accept `candidateId?`; resolve it server-side to the real
  number, stamp `recipient`; the model still never sees digits. Pre-check `is_suppressed`
  BEFORE drafting (surface opt-out; learn from process-bulk-campaign's `skipped:true` swallow).
- **Executor audit**: in `assistant-action-execute`, call `log_assistant_audit(surface,
  'action_executed', tool, 'outbound', status, ..., action_request_id, recipient_hash:=sha256(number))`.
- **Tests** (deno + RLS): resolveContact tenancy (stranger→0), candidateId→recipient mapping,
  suppression pre-check, masked value never leaks digits.
- Expose `resolveContact`/`draftSmsMessage` on `sms-email-copy` + `executive-briefing`.

## PR 2.2 — Voice "say yes to send" confirm flow
The approval gate for the voice surface (the master plan's [C2]).
- **Worker (agent.ts)**: when a turn yields a `pending_approval` action, enter a one-pending-
  action confirm state; SPEAK a restatement (recipient + body gist) read from the FROZEN row,
  not model narration; await a **deterministic worker-side affirmative classifier** (closed
  allow-list: yes/send it/confirm/go ahead — NEVER the LLM, never round-trip to the brain to
  "decide"). Unrecognized → cancel-and-reask; 20s timeout → "didn't send"; barge-in ≠ consent.
- **New edge fn `assistant-action-confirm`**: flips `pending_approval→approved`, re-verifying
  ownership + non-expiry + voice surface + explicit affirmative; then `assistant-action-execute`
  runs. No voice-only approval for irreversible/money/bulk.
- **Hold/Undo (optional here)**: `approved→scheduled` + `execute_after` + a promoter worker.
- **Latency budget**: two STT+TTS round-trips per send (~8–12s) will feel broken — design for it.
- Needs prereq #3 (token budget). Depends on the `agent.ts` work being clean (controller-close
  fix already shipped).

## PR 2.3 — Discord (bot-primary) — AFTER owner provisions the bot (prereq #1) + PR 2.0
- **Migrations**: `agent_connections` (per-user, encrypted tokens, scopes, is_active kill-
  switch, RLS owner-only, INSERT only by the OAuth-callback fn); Discord channel allowlist;
  `assistant_discord_channel_is_allowed(channel_id)` RPC (mirror recipient authz). Bot token
  in Vault + SECDEF getter (clone `get_sync_webhook_secret`).
- **Edge fn `discord-oauth-callback`** (clone `slack-oauth-callback`): link account, enumerate
  guilds/channels, store the user's allowed channel ids.
- **Tools**: `listDiscordChannels` (read, requiredConnection:'discord' → `{available:false,
  reason:'discord_not_connected'}` when unlinked), `draftDiscordMessage` (draft→outbound,
  `{channelId, body}`).
- **Executor**: add `channel:'discord'` branch — re-verify `channelId` ∈ allowlist via
  `assistant_discord_channel_is_allowed`, resolve bot token server-side, send via Discord API,
  honor 429/Retry-After + a `discord:send` rate bucket.
- `jumpToDiscordChannel` (local/companion-only) → DEFERRED until the desktop companion exists.
- **Connections UI** `/settings/connections` (`ConnectionsSettings.tsx`) via a ciphertext-free
  `list_my_connections()` view.
- Reminder: **NO impersonation** (owner decision Jun 3) — Jarvis-the-bot posts to authorized
  channels only.

---

## Recommended order
PR 2.1 (SMS drafting — buildable now) → PR 2.0 (guard wiring) + PR 2.3 (Discord, once bot
provisioned) → PR 2.2 (voice confirm, once token budget set). Each is independently shippable
behind the existing approval gate + audit ledger.

## Cross-cutting reminders (from the security/feasibility reviews)
- All SMS routes through `send-sms` (STOP/suppression/consent) from EVERY surface — never
  Twilio direct. Quiet-hours (8am–9pm recipient-local) enforced in the executor.
- Rate-limit/abuse caps enforced in the EXECUTOR (sends run out-of-band, bypassing the
  orchestrator buckets) + a distinct-recipient/day cap + an IMO-wide ceiling.
- Every outbound action → an `assistant_audit_log` row (already wired for tool dispatch; add
  the execute-time row in the executor).
