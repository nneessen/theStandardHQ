# Security Audit — The Standard HQ — 2026-05-31

Comprehensive backend security review (5 parallel read-only audit agents) covering
multi-tenant isolation, service-role boundaries, prompt injection, webhook auth,
SSRF, dynamic SQL, and XSS. Plus rate-limiting design and a legal/compliance gap scan.

**Scope note:** Findings are reported only — no code/migrations were changed during the
audit. Remediation goes through `./scripts/migrations/run-migration.sh`, then regen types,
then `npm run build`. Severities: Critical / High / Med / Low.

---

## CRITICAL — fix first (unauthenticated or anon-reachable, real damage)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| C1 | **`gmail-send-email` has NO caller auth** — uses service role + `body.userId` | `supabase/functions/gmail-send-email/index.ts:86,152,160` | Any caller passes another user's UUID → loads their Gmail OAuth tokens → sends email **as them**. Full impersonation, any tenant. Gate-independent (no `getUser()` anywhere). |
| C2 | **`get_close_api_key` granted to `anon`, no authz** | RPC (SECURITY DEFINER) | Anyone holding the public anon key enumerates `user_id`s and pulls every user's encrypted Close API key. |
| C3 | **`close-webhook-handler` has no signature verification** (their own config.toml admits "not yet implemented") | `supabase/functions/close-webhook-handler/index.ts:330-508` | Any internet host POSTs forged Close events → drives Close API writes (create/update opportunities) against real agent accounts using their decrypted keys. Needs HMAC-SHA256 over raw body via `Close-Sig-Hash` + timestamp. |

## HIGH

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| H1 | **`regenerate_override_commissions`** — anon-reachable, no authz | RPC (SECDEF) | Arbitrary `p_policy_id` → creates override-commission rows up any policy's upline. Cross-tenant financial write. |
| H2 | **`cascade_agency_assignment`** — anon-reachable, no authz (memory said it *should* be gated; live fn still isn't) | RPC (SECDEF) | `p_imo_id/p_owner_id/p_agency_id` → bulk `UPDATE user_profiles.imo_id/agency_id`. Reassign arbitrary users into arbitrary IMOs. Tenant hijack. |
| H3 | **`set_leaderboard_title_batch`** — anon WRITE, ownership filter is OPTIONAL (`p_user_id IS NULL` bypasses) | RPC (SECDEF) | Overwrite leaderboard titles on any group. Cross-tenant write / defacement. |
| H4 | **`get_sync_webhook_secret`** — anon-reachable returns secret + **hardcoded secret fallback in source** (`'1ceabec3...455f2'`) | RPC (SECDEF) | Anyone retrieves the webhook secret → forge webhook calls. Secret committed in source. |
| H5 | **`get_lead_vendor_user_breakdown`** — anon-reachable, no IMO scope | RPC (SECDEF) | Arbitrary `p_vendor_id` → per-user lead spend, commission, ROI + agent names. Cross-tenant financial + PII. |
| H6 | **`check-user-exists` has no caller auth** + side effects | `supabase/functions/check-user-exists/index.ts:18-79` | Cross-IMO user enumeration; **calls `auth.admin.createUser` on every invocation**; `action=delete_orphan` deletes identities. |
| H7 | **`trigger-workflow-event`** — admin client + unchecked body, no caller auth | `supabase/functions/trigger-workflow-event/index.ts:39-77` | Any authed user fires any tenant's workflows with attacker-controlled `context` (drives emails/SMS/writes). |
| H8 | **`process-workflow`** — admin client, no caller/service-key check | `supabase/functions/process-workflow/index.ts:39-77` | Directly invokable to execute any tenant's workflow run. Should require `SUPABASE_SERVICE_ROLE_KEY` bearer. |
| H9 | **`debug-vercel-domain`** — unauthenticated admin op | `supabase/functions/debug-vercel-domain/index.ts:8` | Any caller can read/delete/force-activate any custom domain. Add super-admin gate or retire. |
| H10 | **Stored-template XSS** — `body_html` rendered unsanitized | `src/features/workflows/components/WorkflowActionsBuilder.tsx:816`; `src/features/email/components/TemplatePicker.tsx:220` | User-authored template HTML → script execution in admin/agent browser on preview. Wrap in `DOMPurify.sanitize()`. |

## MEDIUM

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| M1 | `get_premium_matrices_for_imo` — anon, no authz | RPC (SECDEF) | Arbitrary `p_imo_id` → full proprietary premium-rate matrix for any tenant. |
| M2 | `get_imo_contract_stats` — anon, no authz | RPC (SECDEF) | Arbitrary `p_imo_id` → contract/pending-doc counts for any IMO. |
| M3 | `update_daily_leaderboard_title` — identity is caller-supplied `p_user_id`, not `auth.uid()` | RPC (SECDEF) | Pass the real seller id to bypass the check. Cross-tenant write. |
| M4 | `check_auth_identity` — anon, arbitrary email → `auth.identities` rows | RPC (SECDEF) | Account/provider enumeration over whole user base. |
| M5 | `docuseal-webhook` — no signature verification | `supabase/functions/docuseal-webhook/index.ts:93-180` | Forge `form.completed` with a victim's submitter id → mark contract/onboarding signatures complete. |
| M6 | `gmail-sync-inbox` — service role + unchecked `body.integrationId` | `supabase/functions/gmail-sync-inbox/index.ts:114-129` | Unauthenticated write-trigger on a guessable integration id. |
| M7 | `inbound-email` — non-constant-time HMAC compare (`===`) | `supabase/functions/inbound-email/index.ts:116-123` | Timing oracle to brute-force a Mailgun signature. One-line fix (`timingSafeEqual`). |
| M8 | `TemplateGalleryTab` stored-template XSS | `src/features/marketing/components/templates/TemplateGalleryTab.tsx:126` | `body_html` from DB rendered unsanitized. |
| M9 | Assistant recipient authz relaxed to format-only check (accepted risk) | `supabase/migrations/20260528195232_relax_assistant_recipient_authz.sql` | Safe ONLY while recipient stays human-entered + human-approved. Hard gate on any future "auto-fill recipient" feature → restore allowlist. |

## LOW

- **L1** — 6 SECDEF functions missing pinned `SET search_path` (privesc hardening): `get_close_api_key`, `regenerate_override_commissions`, `check_first_seller_naming_unified`, `avg_lead_heat_score`, `get_close_connection_status`, `set_updated_by`.
- **L2** — OAuth `returnUrl` open-redirect (gated on signing-key compromise): `instagram-oauth-callback/index.ts:111-116`, `slack-oauth-callback/index.ts:131-135`. Allowlist against `APP_URL`.
- **L3** — `get_message_stats`, `get_skill_radar_data` — anon, arbitrary `p_user_id`, low-sensitivity cross-tenant read. Self-scope via `auth.uid()`.
- **L4** — `check_email_exists` — anon user-enumeration oracle (may be intentional pre-signup; confirm + rate-limit).
- **L5** — `assistant-action-execute/index.ts:135-137` — false "content-freeze" comment; no trigger actually freezes recipient/draft_payload on approve transition (not model-reachable today; defense-in-depth).

---

## GOOD NEWS — verified sound (no action)

- **Prompt-injection primary vector is CLOSED BY CONSTRUCTION.** Untrusted free-text (Close
  notes/activity bodies, email/SMS bodies, contact PII) is stripped before it ever reaches the
  model context; the model cannot set an email/SMS recipient (`recipient: null` at draft); every
  outbound send/write requires a separate human-triggered approval in `assistant-action-execute`.
- **CORS** is properly allow-listed (`_shared/cors.ts`).
- **Stripe webhook** verifies signature over the raw body before any logic.
- **Instagram webhook, recruit-templates, slack-store-credentials, resolve-custom-domain** all verified OK.
- **No SSRF** — `business-tools-proxy` uses a fixed env base; all custom-domain fns route hostnames
  through `validateHostname()` (blocks RFC-1918, localhost, metadata IP, file://).
- **No dynamic-SQL injection** — every `EXECUTE format()` uses `%I`/`%L` or `USING` params.
- **Jarvis markdown render** uses `react-markdown` without `rehype-raw` (raw HTML escaped).

---

## RATE LIMITING (build task, not a find task — none exists today)

No rate limiter exists anywhere. In-memory counters DO NOT WORK on Supabase Edge (ephemeral
per-region isolates; a module-level `Map` resets on cold start and isn't shared). Required design:

- **Postgres-backed limiter**: `rate_limits` table + atomic `check_rate_limit(key, limit, window)`
  RPC (upsert into a time-bucket), called from a new `supabase/functions/_shared/rate-limit.ts`.
- **Anthropic endpoints** (`assistant-orchestrator`, `assistant-voice-stt`, `assistant-voice-tts`,
  `underwriting-ai-analyze`, `extract-underwriting-rules`, `close-lead-heat-score`,
  `close-ai-builder`): per-user (`auth.uid()`) request **and token budget** — the token budget is
  the actual cost cap, which is the thing being protected.
- **Public functions**: key on IP (weaker); signature verification matters more there.
- One DB round-trip per call — fine for slow AI endpoints; don't retrofit onto hot read paths.

---

## REMEDIATION STATUS (updated 2026-05-31)

### ✅ DONE — applied to LOCAL, verified (deno check + npm build green)
- **C2, H1, H2, H3, M3, H5** — migration `20260531162205_security_harden_secdef_rpcs.sql`.
  Revoked `anon` from all 6 RPCs (verified: anon gone, authenticated/service_role intact),
  added `assert_in_acting_scope`/`auth.uid()`/admin guards + pinned search_path. Frontend
  callers preserved (all run as `authenticated`).
- **C1** `gmail-send-email` — dual gate (service-role bearer OR `caller.id === body.userId`).
- **C3** `close-webhook-handler` — HMAC-SHA256 signature verify (`CLOSE_WEBHOOK_SECRET`,
  `Close-Sig-Hash`/`Close-Sig-Timestamp`) + 300s replay window before any DB/Close access.
- **M5** `docuseal-webhook` — HMAC verify (`DOCUSEAL_WEBHOOK_SECRET`, `X-Docuseal-Signature`).
- **M7** `inbound-email` — constant-time signature compare (was `===` timing oracle).
- **H6** `check-user-exists` — super-admin gate + REMOVED the createUser/delete side effects.
- **H7** `trigger-workflow-event` — JWT + tenant derived from `auth.uid()` (not body).
- **H8** `process-workflow` — dual gate (service-role bearer OR same-IMO owner).
- **H9** `debug-vercel-domain` — super-admin gate (recommend deleting the function).
- **H10, M8** — stored-template XSS now sanitized via `src/lib/sanitizeHtml.ts` (DOMPurify).
- **RATE LIMITER** — migration `20260531161319_rate_limiter.sql` (`rate_limits` table +
  `check_rate_limit` RPC, search_path-pinned, service_role-only). Wired into all 7
  Anthropic endpoints at **30 req/hr + 200k tokens/day per user**. Smoke-tested (blocks over limit).

### ✅ DEPLOYED TO REMOTE/PROD (2026-05-31) — DB layer only
- Both migrations applied to prod `pcyaqwodnyrpkaiojnpz` + verified: `anon` revoked from all 6
  RPCs (0 rows), the 5 hardened bodies live with pinned search_path, rate-limiter table+RPC live.
- **DRIFT FOUND + HANDLED:** prod's `cascade_agency_assignment` already had a *newer* hardened body
  (admin check + dual target/owner-IMO scope) applied out-of-band — better than the stale local
  copy the audit ran against. The migration was changed to **grant-only** for cascade (revoke anon,
  do NOT overwrite the body). Verified prod's admin guard is intact post-apply. Remote def backup:
  `/tmp/secaudit/remote_defs_backup.txt`. NOTE: local now has a *different* (also-secure) cascade
  body than prod — pre-existing-style drift to reconcile by syncing prod's body down to local.

### ✅ EDGE FUNCTIONS DEPLOYED TO PROD (2026-05-31)
- Deployed + bundle-clean + gateway-200-routing-verified: gmail-send-email (C1), check-user-exists
  (H6), trigger-workflow-event (H7), process-workflow (H8), debug-vercel-domain (H9), inbound-email
  (M7), + all 7 Anthropic fns (rate limiting now LIVE: 30 req/hr + 200k tok/day per user).
- Deployed versions were old (Dec–Mar) so working-tree deploys were forward (low drift risk).
- DocuSeal removed: `docuseal` + `docuseal-webhook` functions UNDEPLOYED from prod; feature code +
  3 DB tables dropped (local+remote); prod data backed up to /tmp/secaudit/backup_signature_*.json.
- Full typed-turn E2E of the orchestrator still needs a real user JWT (user-run, like prior Jarvis smoke).

### 🔴 STILL HELD — close-webhook-handler (C3)
- NOT deployed. Needs: (1) Close webhook signing secret → set edge env `CLOSE_WEBHOOK_SECRET`;
  (2) confirm Close's exact signing scheme (HMAC over `timestamp+body` assumed) before deploy, or
  it will 401/500 legitimate Close webhooks. Prod close-webhook-handler is still unsigned until then.

### ⬜ NOT YET DONE
- Regen `database.types.ts` (signature_* tables now stale in it but unreferenced; rate_limits absent)
  — do at commit time. Commit the branch.
1. Set edge env vars on remote: `CLOSE_WEBHOOK_SECRET`, `DOCUSEAL_WEBHOOK_SECRET` (and configure
   the signing secrets in the Close/DocuSeal dashboards) — **do this BEFORE deploying those two
   webhook fns or they'll 401/500 all webhooks**.
2. Apply both migrations to REMOTE (`DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh ...`).
3. Deploy the edited edge functions.
4. `npx supabase gen types ... > src/types/database.types.ts` (adds rate_limits/check_rate_limit) + commit.
5. Exercise changed flows: agency creation as a non-super-admin admin (new admin gate on
   `cascade_agency_assignment`), first-seller leaderboard naming, override regen, one Close-key path.

### ✅ H4 — DONE (vault-wired, 2026-05-31; migration `20260531181842_sync_webhook_secret_from_vault.sql`)
- The hardcoded secret `1ceabec3…455f2` was in THREE functions: `get_sync_webhook_secret` (orphaned
  getter, anon-readable) + `notify_policy_webhook` + `notify_client_webhook` (triggers that POST
  policy/client changes to consumer project `lopznswmsgkccydrsomy` via `x-webhook-secret`).
- Vault key `sync_webhook_secret` populated with the CURRENT value on local+remote (no rotation, no
  breakage). All 3 functions now read it from `vault.decrypted_secrets` (no literal in their bodies);
  triggers NULL-guard. `anon`/`authenticated` revoked from the getter → service_role only.
- Verified on prod: getter returns the 64-char secret (Vault read works in SECDEF context).
- **VALUE ROTATION still TODO (coordinated, 2 sides):** `vault.update_secret(<id>,'<new>')` on this
  project (local+remote) AND update consumer `lopznswmsgkccydrsomy` sync-policy/sync-client to expect
  the new secret. Both together or sync breaks. (Now a config change — no code deploy needed.)

### 🟡 STAGED (Med/Low, per scope decision Critical+High first)
- M1 `get_premium_matrices_for_imo`, M2 `get_imo_contract_stats`, M4 `check_auth_identity`,
  M6 `gmail-sync-inbox`, M9 assistant recipient note.
- L1 remaining search_path pins (avg_lead_heat_score, get_close_connection_status,
  check_first_seller_naming_unified, set_updated_by), L2 OAuth returnUrl allowlist,
  L3/L4 enumeration RPCs, L5 content-freeze comment.
