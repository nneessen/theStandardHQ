# Security Remediation — 5-Phase Hotfix

**Date:** 2026-02-23
**Author:** Claude (AI-assisted)
**Status:** Deployed & verified (post-review fixes applied)
**Severity:** CRITICAL (Phase 1), HIGH (Phases 2–4), MEDIUM (Phase 5)

---

## Executive Summary

Five recent feature commits introduced security vulnerabilities ranging from cross-tenant data leaks to unauthenticated API access. This remediation addresses all five in a coordinated hotfix with strict deployment ordering. No schema changes are required — only function patches, RLS policy updates, and edge function hardening.

**Vulnerabilities fixed:**

| # | Vulnerability | Severity | OWASP Category |
|---|-------------|----------|----------------|
| 1 | Leaderboard RPCs accept any IMO ID — cross-tenant data leak | CRITICAL | A01: Broken Access Control |
| 2 | Carrier contract trigger lacks IMO validation — cross-tenant writes | HIGH | A01: Broken Access Control |
| 3 | Client-side PII exposure (upline phone/email) in contracting UI | HIGH | A04: Insecure Design |
| 4 | send-email / send-sms edge functions have no authentication | HIGH | A07: Identification & Auth Failures |
| 5 | Email change flow lacks compensating controls after disabling dual confirmation | MEDIUM | A07: Identification & Auth Failures |

---

## Phase 1: Leaderboard RPC Auth Patch

### Vulnerability

`get_ip_leaderboard_with_periods(p_imo_id, p_agency_id)` and `get_agencies_ip_totals(p_imo_id)` are `SECURITY DEFINER` functions (run as superuser, bypass RLS). They accept any `p_imo_id` parameter without verifying the caller belongs to that IMO. Any authenticated user can read another organization's leaderboard data by passing a different IMO UUID.

### Root Cause

The functions were written with the assumption that the frontend would always pass the user's own IMO ID. No server-side enforcement existed.

### Fix

**File:** `supabase/migrations/20260223142951_leaderboard_rpc_auth.sql`

Both functions now include an auth block immediately after `BEGIN`, before any data queries:

```sql
-- Skip for service_role (server-to-server calls like slack-ip-leaderboard)
IF current_setting('request.jwt.claim.role', true) != 'service_role' THEN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND imo_id = p_imo_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this IMO';
  END IF;
END IF;
```

**Why `service_role` bypass:** The `slack-ip-leaderboard` edge function calls these RPCs server-side using the service role key. In that context `auth.uid()` is NULL, so the membership check would always fail. The service_role token is only available server-side and is never exposed to clients.

### Behavior Change

| Caller | Before | After |
|--------|--------|-------|
| Authenticated user, own IMO | Works | Works (no change) |
| Authenticated user, different IMO | Returns other org's data | `RAISE EXCEPTION` |
| service_role (edge functions) | Works | Works (bypassed) |
| Anon | Blocked by GRANT | Blocked by GRANT (no change) |

### Regression Risks

- If `user_profiles.imo_id` is NULL for a user, they'll be denied access to all IMOs (correct behavior — orphaned users shouldn't see data).
- The `slack-ip-leaderboard` edge function continues to work because it uses service_role.

### Test Verification (via `run-sql.sh`)

```sql
-- Should raise "Access denied" when called as a user not in that IMO
SELECT * FROM get_ip_leaderboard_with_periods('wrong-imo-uuid'::uuid);
```

---

## Phase 2: Carrier Contract Tenant Isolation

### Vulnerability

**2A.** The `check_upline_carrier_contract()` trigger on `carrier_contract_requests` validates that a recruit's upline has an approved contract for the requested carrier — but never checks that the carrier itself belongs to the recruit's IMO. A crafted request could reference a carrier from another tenant.

**2B.** The `"Staff can manage contracts in IMO"` RLS policy on `carrier_contracts` validates that the staff member and agent are in the same IMO, but the `WITH CHECK` clause doesn't validate that the **carrier** is also in that IMO. Staff could create contracts linking agents to carriers from other organizations.

### Root Cause

Carrier IMO validation was assumed to be handled at the UI level (the carrier dropdown only shows same-IMO carriers). No server-side enforcement existed.

### Fix

**File:** `supabase/migrations/20260223142952_carrier_tenant_isolation.sql`

**2A. Trigger patch** — Added carrier IMO check before the upline check:

```sql
-- NEW: Verify carrier belongs to the recruit's IMO
IF NOT EXISTS (
  SELECT 1 FROM carriers c
  WHERE c.id = NEW.carrier_id
  AND c.imo_id = v_recruit_imo_id
  AND c.is_active = true
) THEN
  RAISE EXCEPTION 'Carrier does not belong to your organization'
    USING ERRCODE = 'check_violation';
END IF;
```

Also fetches `up.imo_id` alongside `up.upline_id` in the initial SELECT (single query, no additional DB call).

**2B. RLS policy patch** — Dropped and recreated `"Staff can manage contracts in IMO"` with carrier validation in WITH CHECK:

```sql
WITH CHECK (
  -- Existing: staff and agent same IMO
  EXISTS (
    SELECT 1 FROM user_profiles caller
    JOIN user_profiles agent ON agent.id = carrier_contracts.agent_id
    WHERE caller.id = auth.uid()
    AND caller.imo_id = agent.imo_id
    AND (caller.roles @> ARRAY['trainer']::text[]
         OR caller.roles @> ARRAY['contracting_manager']::text[]
         OR caller.is_admin = true)
  )
  -- NEW: carrier must be in caller's IMO
  AND EXISTS (
    SELECT 1 FROM carriers c
    WHERE c.id = carrier_contracts.carrier_id
    AND c.imo_id = (SELECT imo_id FROM user_profiles WHERE id = auth.uid())
  )
)
```

### Audit Query (Manual)

Run after migration to detect any existing cross-tenant data:

```sql
-- Detect cross-tenant carrier_contracts
SELECT cc.id, up.imo_id AS agent_imo, c.imo_id AS carrier_imo
FROM carrier_contracts cc
JOIN user_profiles up ON up.id = cc.agent_id
JOIN carriers c ON c.id = cc.carrier_id
WHERE up.imo_id != c.imo_id;

-- Detect cross-tenant carrier_contract_requests
SELECT ccr.id, up.imo_id AS recruit_imo, c.imo_id AS carrier_imo
FROM carrier_contract_requests ccr
JOIN user_profiles up ON up.id = ccr.recruit_id
JOIN carriers c ON c.id = ccr.carrier_id
WHERE up.imo_id != c.imo_id;
```

### Regression Risks

- If a carrier record has `is_active = false`, the trigger will block new contract requests for it. This is correct behavior but could surface as "Carrier does not belong to your organization" if a carrier was recently deactivated.
- The `toggle_agent_carrier_contract` RPC (from the previous migration) already validates carrier IMO, so no changes needed there.

---

## Phase 3: Dedicated Request Update Edge Function

### Vulnerability

The "Request Update" button in `ContractingTab.tsx` fetched the upline's phone and email client-side (via a direct `user_profiles` query), then constructed SMS/email messages in the browser. This exposed upline PII to any staff user via browser dev tools or network inspection. The messages were sent by directly invoking `send-email` and `send-sms` edge functions from the client.

### Root Cause

The feature was implemented as a quick client-side orchestration without considering PII exposure. The upline contact query (`phone, email`) was protected by `permissions.isStaff` but still transmitted to the browser.

### Fix

**New file:** `supabase/functions/request-upline-contract-update/index.ts`

Server-side edge function that:

1. Validates JWT from Authorization header
2. Resolves caller identity via `supabaseAdmin.auth.getUser(jwt)`
3. Verifies caller is staff/admin (`trainer`, `contracting_manager`, `admin`, or `is_admin`)
4. Fetches recruit profile and verifies same IMO as caller
5. Fetches upline profile (including phone/email) **server-side only**
6. Verifies upline is in same IMO as caller (defense in depth)
7. Constructs message template server-side (hardcoded — no client-provided content)
8. Settings URL from `SITE_URL` env var (not client-provided)
9. Sends via Twilio (preferred if phone available) or Mailgun (fallback)
10. Returns `{ success: true, method: "sms"|"email" }` — no PII in response

**Input:** `{ recruitId: string }` — nothing else needed or accepted.

**Modified file:** `src/features/recruiting/components/ContractingTab.tsx`

Removed:
- `uplineContact` query (fetched phone/email client-side)
- `smsService` import
- `escapeHtml` helper function
- Direct `send-email` / `send-sms` invocations
- All PII handling in `handleRequestUpdate`

Replaced with:
```typescript
const { data, error } = await supabase.functions.invoke(
  "request-upline-contract-update",
  { body: { recruitId } },
);
```

The `uplineProfile` query (fetching only `first_name, last_name`) is retained for the upline name display in the banner — this is not PII in the regulatory sense and is needed for the UI.

### Security Properties

| Property | Before | After |
|----------|--------|-------|
| Upline phone in browser | Yes (via query) | Never leaves server |
| Upline email in browser | Yes (via query) | Never leaves server |
| Message content | Client-constructed | Server-hardcoded |
| Settings URL | Hardcoded in client | From `SITE_URL` env var |
| Auth check | `permissions.isStaff` (client-side) | JWT + role check (server-side) |
| IMO isolation | None | Caller, recruit, and upline IMO verified |

### Deployment Note

This function must be deployed before it will work. The CORS error seen in dev is expected — the function doesn't exist on Supabase yet:

```bash
supabase functions deploy request-upline-contract-update
```

---

## Phase 4: send-email / send-sms Hardening

### Vulnerability

Both `send-email` and `send-sms` edge functions had **zero authentication**. Any HTTP client that knew the function URL could:
- Send arbitrary emails through the organization's Mailgun account
- Send arbitrary SMS through the organization's Twilio account
- Potentially use these for spam, phishing, or cost abuse

The Supabase client JS library passes the `Authorization: Bearer <anon_key>` header automatically, but neither function validated it.

### Root Cause

The functions were built as internal utilities and authentication was never added. They were only called from the frontend (where the user was already logged in) and from other edge functions, so the lack of auth wasn't immediately apparent.

### Fix

**Modified files:**
- `supabase/functions/send-email/index.ts`
- `supabase/functions/send-sms/index.ts`

Both functions now include an identical auth gate at the top of the handler:

```
Authorization header → exact key comparison or getUser():
├─ bearerToken === SUPABASE_SERVICE_ROLE_KEY → Allow (server-to-server calls)
├─ supabaseAdmin.auth.getUser(bearerToken) succeeds → Allow (any authenticated user)
└─ neither matches → 401 Unauthorized
```

**Auth strategy:** The bearer token is compared directly against `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` — no JWT decoding or payload inspection. If that doesn't match, the token is validated via `supabaseAdmin.auth.getUser()`. Any authenticated user is allowed (not restricted to staff/admin roles), because these functions are called by automation flows (pipelineAutomationService), recruit-triggered actions (ContactsSection "Text Your Recruiter"), and trainer email compose — not just staff users.

**Additional hardening (both functions):**

| Change | Before | After |
|--------|--------|-------|
| Unknown request keys | Silently ignored | 400 error |
| Recipient logging (send-email) | `to: body.to` (full email array) | `recipientCount: body.to?.length` |
| Sender logging (send-email) | `from: body.from` (full address) | `hasSender: !!body.from` |
| Phone logging (send-sms) | `to: body.to`, `to: toNumber` | `hasRecipient: !!body.to` |
| Error messages to client | Detailed (Mailgun/Twilio errors) | Generic ("Something went wrong") |
| Mailgun/Twilio errors | Logged with full details | Details in server logs only |

### Prerequisite Fix

**Modified file:** `supabase/functions/slack-policy-notification/index.ts`

Lines 694 and 712: Changed `SUPABASE_ANON_KEY` → `SUPABASE_SERVICE_ROLE_KEY`.

This function calls `send-sms` server-to-server for milestone SMS notifications. After hardening, anon tokens are rejected. The service_role key is already available in the edge function environment and is the correct choice for server-to-server calls.

### Deployment Order Dependency

`slack-policy-notification` MUST be deployed before or simultaneously with `send-sms`. If `send-sms` is deployed first with auth hardening while `slack-policy-notification` still uses the anon key, milestone SMS notifications will silently fail (401 responses).

### Callers Affected

| Caller | Token Type | Impact |
|--------|-----------|--------|
| ContractingTab.tsx (old code) | authenticated user JWT | Was calling send-email/send-sms directly; **now removed in Phase 3** |
| slack-policy-notification | anon key → **service_role key** | Fixed in prerequisite |
| request-upline-contract-update (new) | N/A — sends directly via Twilio/Mailgun APIs | Not affected |
| send-email-change | N/A — sends directly via Mailgun API | Not affected |
| Other edge functions calling send-email | Need to verify they use service_role | **Audit recommended** |
| Frontend email compose (trainer email feature) | authenticated user JWT | Works — trainers have the `trainer` role |

### Audit: Other callers of send-email / send-sms

These edge functions may also call send-email or send-sms. Verify they use `SUPABASE_SERVICE_ROLE_KEY`:

```bash
grep -rl "send-email\|send-sms" supabase/functions/ --include="*.ts" | grep -v node_modules
```

---

## Phase 5: Email Change Flow Hardening

### Vulnerability

The email change flow disabled Supabase's `double_confirm_changes` (which requires both old and new email to confirm) in favor of a single-click flow from the new email only. This was done for UX simplicity but removed the compensating control that prevented unauthorized email changes. If an attacker gains session access (XSS, session fixation, shared computer), they can silently change the account email.

### Root Cause

`double_confirm_changes` was disabled because the dual-email flow had poor UX (users didn't understand why they received two emails). No compensating controls were added.

### Fix

Three compensating controls added:

#### 5A. Old Email Notification

**Modified file:** `supabase/functions/send-email-change/index.ts`

After sending the confirmation email to the new address, the function now sends a fire-and-forget notification to the **current** email:

> **Subject:** Security Alert: Email change requested — The Standard HQ
> **Body:** A request was made to change the email address on your The Standard HQ account. If this was you, no action is needed. **If you did not make this request, please contact support immediately.**

Implementation: Uses an awaited `fetch()` with a 5-second `AbortController` timeout. The notification completes before the function returns (edge runtimes drop pending async work after response), but is capped at 5 seconds to avoid blocking the user. Notification failure is logged but does not fail the overall operation. (See Post-Review Fix #4 for details on why fire-and-forget was changed.)

#### 5B. Password Re-verification

**Modified file:** `src/features/settings/components/UserProfile.tsx`

The email change form now requires the user's current password:

```typescript
// Verify password before proceeding
const { error: authError } = await supabase.auth.signInWithPassword({
  email: user?.email || "",
  password: emailChangePassword,
});
if (authError) {
  setEmailChangeError("Incorrect password");
  setEmailChangeStatus("error");
  return;
}
```

The UI adds a "Current password (required)" field below the new email input. The "Send Link" button is disabled until both fields are filled.

**Note:** `signInWithPassword` validates credentials and refreshes the session token, but since it's the same user re-authenticating, identity stays the same and the session continues normally. (See Post-Review Fixes for full clarification.)

#### 5C. PII-Redacted Logging

All `console.log` and `console.error` calls in `send-email-change` now log user IDs instead of email addresses:

| Before | After |
|--------|-------|
| `"Generating links for:", currentEmail, "→", trimmedNew` | `"Generating link for user:", userData.user.id` |
| `"Confirmation email sent to:", trimmedNew` | `"Confirmation email sent for user:", userData.user.id` |
| `"JWT validation failed:", userError` | `"JWT validation failed"` (no error details) |
| `err.message` in catch | `err instanceof Error ? err.message : "Unknown"` |

#### 5D. Input Validation

- Unknown keys in request body are rejected with 400
- Error messages to client are generic ("Something went wrong") instead of exposing Mailgun error details

### Regression Risks

- The `signInWithPassword` call in UserProfile.tsx triggers a Supabase auth request. If the auth service is slow, the email change flow will feel slower (adds ~200-500ms). This is acceptable for a security-sensitive operation.
- If a user has a social login (OAuth) without a password, the password field will always fail. This may need a separate flow for OAuth users in the future. Currently all users in this system use email/password auth.

---

## Files Changed

### Created (3 files)

| File | Phase | Purpose |
|------|-------|---------|
| `supabase/migrations/20260223142951_leaderboard_rpc_auth.sql` | 1 | IMO membership check on both leaderboard RPCs |
| `supabase/migrations/20260223142952_carrier_tenant_isolation.sql` | 2 | Carrier IMO check on trigger + RLS WITH CHECK |
| `supabase/functions/request-upline-contract-update/index.ts` | 3 | Server-side upline notification (replaces client PII exposure) |

### Modified (6 files)

| File | Phase | Changes |
|------|-------|---------|
| `src/features/recruiting/components/ContractingTab.tsx` | 3 | Removed: uplineContact query, smsService import, escapeHtml, client-side messaging. Added: edge function invocation. |
| `supabase/functions/send-email/index.ts` | 4 | Added: JWT auth gate (service_role/staff), unknown-key rejection. Changed: PII-redacted logs, generic error messages. |
| `supabase/functions/send-sms/index.ts` | 4 | Added: JWT auth gate (service_role/staff), unknown-key rejection. Changed: PII-redacted logs, generic error messages. |
| `supabase/functions/slack-policy-notification/index.ts` | 4 | Changed: `SUPABASE_ANON_KEY` → `SUPABASE_SERVICE_ROLE_KEY` (2 lines) |
| `supabase/functions/send-email-change/index.ts` | 5 | Added: old-email notification, unknown-key rejection. Changed: PII-redacted logs, generic error messages. |
| `src/features/settings/components/UserProfile.tsx` | 5 | Added: password field + re-verification before email change. |

---

## Deployment Procedure

### Order (critical — dependencies exist)

| Step | Action | Dependency |
|------|--------|------------|
| 1 | `./scripts/migrations/run-migration.sh supabase/migrations/20260223142951_leaderboard_rpc_auth.sql` | None |
| 2 | `./scripts/migrations/run-migration.sh supabase/migrations/20260223142952_carrier_tenant_isolation.sql` | None |
| 3 | `supabase functions deploy request-upline-contract-update` | None |
| 4 | `supabase functions deploy slack-policy-notification` | Must be before step 6 |
| 5 | `supabase functions deploy send-email-change` | None |
| 6 | `supabase functions deploy send-email` | Step 4 (slack-policy-notification must use service_role first) |
| 7 | `supabase functions deploy send-sms` | Step 4 (same reason) |
| 8 | Deploy frontend (Vercel) | Steps 3, 6, 7 (edge functions must exist) |

### Post-Deployment Verification

#### SQL regression tests (via `./scripts/migrations/run-sql.sh`)

```sql
-- Phase 1: Should raise "Access denied" for wrong IMO
-- (Run as an authenticated user in IMO A, passing IMO B's UUID)
SELECT * FROM get_ip_leaderboard_with_periods('wrong-imo-uuid'::uuid);
SELECT * FROM get_agencies_ip_totals('wrong-imo-uuid'::uuid);

-- Phase 2: Should raise "Carrier does not belong to your organization"
-- (Insert a carrier_contract_request with a carrier from another IMO)
INSERT INTO carrier_contract_requests (recruit_id, carrier_id, status)
VALUES ('recruit-in-imo-a', 'carrier-in-imo-b', 'requested');
```

#### curl tests for edge function auth

```bash
# Phase 4: Should return 401 for unauthenticated requests
curl -s -X POST "https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/send-email" \
  -H "Content-Type: application/json" \
  -d '{"to":["test@test.com"],"subject":"test","html":"<p>test</p>","from":"test@test.com"}'
# Expected: {"success":false,"error":"Unauthorized"}

curl -s -X POST "https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/send-sms" \
  -H "Content-Type: application/json" \
  -d '{"to":"+15551234567","message":"test"}'
# Expected: {"success":false,"error":"Unauthorized"}
```

#### Manual testing

- [ ] Leaderboard loads correctly for caller's own IMO
- [ ] Carrier contracting works for same-IMO operations
- [ ] "Request Update" button sends notification via new edge function
- [ ] send-email rejects unauthenticated curl requests (401)
- [ ] send-sms rejects unauthenticated curl requests (401)
- [ ] Slack milestone SMS notifications still work (via service_role)
- [ ] Email compose feature still works for trainers (authenticated + trainer role)
- [ ] Email change: old email receives security notification
- [ ] Email change: password field is required and validated
- [ ] Email change: wrong password shows error, does not proceed

---

## Build Verification

```
$ npx tsc --noEmit        → 0 errors
$ npm run build            → ✓ built in 44.14s, 0 errors
$ ./scripts/validate-app.sh → ✅ Validation Complete
```

Note: Deno-specific TypeScript diagnostics (e.g., `Cannot find name 'Deno'`) appear in IDE for edge function files. These are expected — edge functions run in Deno runtime, not Node.js. They do not affect the production build.

---

## Open Items / Follow-Up

1. ~~**Audit other send-email callers**~~: **Completed.** See Post-Review Fixes section below. All edge function callers use `SUPABASE_SERVICE_ROLE_KEY`.

2. **Rate limiting on request-upline-contract-update**: The plan called for a 24h per-recruit cooldown. The current implementation does not enforce this (commented out in code). Consider adding a `last_update_request_at` timestamp column or a dedicated log table.

3. **OAuth users and email change**: If any users authenticate via OAuth (no password), the password re-verification in Phase 5B will always fail. Currently all users use email/password. If OAuth is added, a separate verification flow will be needed.

4. **Cross-tenant audit**: Run the audit queries from Phase 2 to check for any existing cross-tenant carrier contracts that may have been created before this fix. (Initial audit returned 0 rows — clean.)

---

## Post-Review Fixes

A code review was performed after initial deployment. Four findings were identified and resolved. All fixes have been deployed.

### Finding #1 — CRITICAL: Forged service_role JWT bypass

**What was wrong:** The initial implementation of the auth gate in `send-email` and `send-sms` decoded the JWT using `atob(jwt.split(".")[1])` and checked the `role` field in the payload. JWT payloads are **unsigned** — the signature is in segment [2], and `atob` decodes segment [1] without verifying it. An attacker could forge a token with `{"role":"service_role"}` in the payload and bypass the auth gate entirely.

**Fix:** Replaced JWT payload decoding with **direct key comparison**:

```typescript
if (bearerToken === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
  // Server-to-server: allowed
}
```

The service_role key is a shared secret known only to the server environment. Comparing the bearer token directly against it is cryptographically sound — no JWT parsing needed.

**Verification:** Tested with a forged JWT containing `{"role":"service_role"}` in the payload → returns 401 (key comparison rejects it).

### Finding #2 — HIGH: Unknown-key rejection broke automation emails

**What was wrong:** The `ALLOWED_KEYS` whitelist in `send-email` was too restrictive. It included the standard Mailgun fields (`to`, `subject`, `html`, `text`, `from`, etc.) but omitted keys used by existing callers:

- `bodyHtml`, `bodyText` — used by `pipelineAutomationService.ts`
- `recruitId`, `senderId` — used by `UserEmailService.ts`
- `metadata` — used by `ActionConfigPanel.tsx`

The unknown-key rejection (400 error) would have silently broken these automation flows after deployment.

**Fix:** Expanded `ALLOWED_KEYS` to include all 20 keys used by existing callers:

```
to, cc, bcc, subject, html, text, from, replyTo, trackingId, userId,
threadId, messageId, inReplyTo, references, attachments, trainingDocuments,
recruitId, senderId, metadata, bodyHtml, bodyText
```

**How identified:** Searched all frontend callers (`emailService.ts`, `UserEmailService.ts`, `pipelineAutomationService.ts`, `ActionConfigPanel.tsx`) for the request body shapes they send.

### Finding #3 — HIGH: Staff-only gate broke recruit SMS

**What was wrong:** The initial auth gate required authenticated users to have staff/admin roles (`trainer`, `contracting_manager`, `admin`, or `is_admin`). This blocked:

- **Recruit-triggered SMS** via `ContactsSection.tsx` "Text Your Recruiter" — recruits are authenticated users with no staff role
- **Automation email flows** via `pipelineAutomationService.ts` — runs in the context of the workflow owner, who may not be staff

**Fix:** Changed the auth strategy from role-gated to **any-authenticated-user**:

```typescript
// Before (too restrictive):
const userProfile = await supabase.from("user_profiles")...
if (!isStaff) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

// After (correct boundary):
const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearerToken);
if (userError || !userData.user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}
// Any valid authenticated user can proceed
```

**Rationale:** The real security boundary is unauthenticated vs. authenticated. Unauthenticated/anon callers are blocked (prevents spam/abuse from the public internet). Authenticated users have already passed Supabase auth and are legitimate application users. Rate limiting and abuse prevention for authenticated users should be handled at the application layer, not the transport layer.

### Finding #4 — MEDIUM: Fire-and-forget old-email notification

**What was wrong:** The old-email security notification in `send-email-change` used a fire-and-forget pattern (`fetch().then().catch()`). In edge function runtimes (Deno Deploy / Supabase Edge), pending async work is **dropped** after the response is returned. The notification would never actually be sent because the `fetch()` promise would be abandoned when the function returned the success response.

**Fix:** Changed to an **awaited call with a 5-second timeout** using `AbortController`:

```typescript
const abortController = new AbortController();
const timeoutId = setTimeout(() => abortController.abort(), 5000);

try {
  const notifyResp = await fetch(MAILGUN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`api:${MAILGUN_KEY}`)}` },
    body: notifyForm,
    signal: abortController.signal,
  });
  console.log("[send-email-change] Old email notification sent, status:", notifyResp.status);
} catch (fetchErr) {
  console.error("[send-email-change] Old email notification failed:", ...);
} finally {
  clearTimeout(timeoutId);
}
```

The notification is now awaited (so it completes before the function returns) but capped at 5 seconds to avoid blocking the user's email change if Mailgun is slow. Notification failure is logged but does not fail the overall operation.

### Additional Clarification: signInWithPassword session behavior

During review, a concern was raised about whether `signInWithPassword` in `UserProfile.tsx` (used for password re-verification before email change) might create a new session or change the user's identity. This was investigated and documented with a code comment:

```typescript
// signInWithPassword refreshes the session token but identity stays the same
// (same user re-authenticating). No functional impact on the current session.
```

This is expected Supabase behavior — `signInWithPassword` validates credentials and refreshes the token, but since it's the same user, the session continues normally.

### Edge Function Caller Audit

Completed audit of all edge functions that call `send-email` or `send-sms`:

| Caller | Calls | Auth Token Used | Status |
|--------|-------|----------------|--------|
| `slack-policy-notification/index.ts` | `send-sms` | `SUPABASE_SERVICE_ROLE_KEY` | Fixed in Phase 4 |
| `process-workflow/index.ts` | `send-email` (Mailgun fallback) | `SUPABASE_SERVICE_ROLE_KEY` | Already correct |
| `process-workflow/index.ts` | `gmail-send-email` | `SUPABASE_SERVICE_ROLE_KEY` | Already correct |
| `create-auth-user/index.ts` | Direct Twilio API (not send-sms) | N/A | Not affected |
| `send-email-change/index.ts` | Direct Mailgun API (not send-email) | N/A | Not affected |
| `request-upline-contract-update/index.ts` | Direct Twilio/Mailgun API | N/A | Not affected |

Frontend callers (`emailService.ts`, `UserEmailService.ts`, `pipelineAutomationService.ts`, `ActionConfigPanel.tsx`, `smsService.ts`, `ContactsSection.tsx`) use the Supabase JS client, which automatically passes the authenticated user's JWT. These work correctly with the "any authenticated user" gate.

**Conclusion:** All server-to-server callers use `SUPABASE_SERVICE_ROLE_KEY`. No anon key usage remains.
