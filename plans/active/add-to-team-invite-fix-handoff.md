# Add to Team — invite fix + self-service resend + offboarding (handoff)

Status as of 2026-06-26. Plan: `~/.claude/plans/fizzy-forging-cascade.md`.

## What this delivers (3 asks, all on the "Add to Team → Agent" / create-auth-user flow)

1. **Invite no longer dies early.** Replaced the Supabase *recovery* link (whose real
   lifetime was the project OTP/email-link expiry — the 72h `expiresIn` was silently
   ignored — and which email scanners could burn on pre-click) with an **app-owned setup
   token**: real 7-day expiry, read-only validation (scanner-safe), resendable.
2. **Self-service resend** for every team leader (own downline) + the admin path.
3. **Reversible "disable access"** (auth ban) + re-enable, preserving hierarchy/commissions.

## Files changed

DB (migrations — applied LOCAL only so far):
- `supabase/migrations/20260626142357_account_setup_tokens.sql` — table + `get_account_setup_by_token` (read-only validate, anon) + `upsert_account_setup_token` (service-role, create/rotate, cap 5).
- `supabase/migrations/20260626142400_user_access_disable_columns.sql` — `user_profiles.access_disabled_{at,by,reason}` (NOT `archived_at` — preserves rollups).

Edge functions:
- `_shared/account-setup.ts` (buildSetupEmail "7 days" + createOrRefreshSetupToken + sendSetupEmail Gmail→Mailgun), `_shared/team-authz.ts` (downline/admin authorization).
- `create-auth-user/index.ts` — swapped recovery-link block for the setup token; removed local email builders; "72h"→"7 days" copy.
- NEW: `set-account-password/` (public, `--no-verify-jwt`), `resend-account-setup/`, `set-member-access/`.
- `config.toml` — `[functions.set-account-password] verify_jwt = false`.

Frontend:
- `services/users/accountSetupService.ts`, `hooks/team/{useTeamAccess,useAccountSetup,index}.ts`.
- `features/auth/SetPasswordPage.tsx` + route `set-password/$token` (`router.tsx`, public in `App.tsx`).
- `features/hierarchy/components/AgentTable.tsx` — row actions (Resend / Disable / Re-enable) + "Disabled" badge.
- `features/admin/components/EditUserDialog.tsx` — resend now routes to `resend-account-setup` (was the broken `send-password-reset`).

## Verified ✅
- `npm run build` (tsc + vite) zero errors; ESLint clean on all changed files.
- Migrations apply cleanly (LOCAL).
- `get_account_setup_by_token`: valid / not_found / already_used JSON shapes match the service.
- `upsert_account_setup_token`: create + return shape + resend cap at 5.
- Auth ban API (`scripts/verify-member-access-ban.mjs`): `ban_duration:"876600h"` sets `banned_until`, `"none"` clears it, `getUserById` works.

## NOT yet verified ⚠️ (do before/at prod)
- Edge-function HTTP layer + the `team-authz` hierarchy check (upline authorized, non-upline 403) — not curled.
- Full browser E2E: add agent → email link `/set-password/{token}` → set password → login; disable → can't log in; resend.
- `set-account-password` consume path end-to-end (DB-level already_used is verified).

## Remaining steps to ship (NOT done — needs your go-ahead; outward-facing/prod)

1. **Apply migrations to PROD** (runner needs the remote URL override):
   `DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh supabase/migrations/20260626142357_account_setup_tokens.sql`
   then the `..142400..` one.
2. **Regenerate types from PROD** and drop the two bridges:
   `npx supabase gen types typescript --project-id pcyaqwodnyrpkaiojnpz > src/types/database.types.ts`
   then remove the `(supabase as any)` cast in `accountSetupService.ts` and the local
   `access_disabled_at?` field in `AgentTable.tsx` (both annotated; harmless if left).
3. **Deploy edge functions:** `create-auth-user`, `resend-account-setup`, `set-member-access`,
   and `set-account-password --no-verify-jwt`. Confirm `SITE_URL` is set on the project.
4. Commit + push to main (Vercel deploys the frontend).
