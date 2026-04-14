# Stripe + Subscription Billing Audit

Date: 2026-02-21  
Scope: End-to-end subscription/billing/Stripe implementation audit across frontend, service layer, Supabase functions, RLS/RPC/migrations, and live Stripe account configuration.

## 1) What I audited

### Frontend/UI

- `src/features/billing/BillingPage.tsx`
- `src/features/billing/components/PricingCards.tsx`
- `src/features/billing/components/CurrentPlanCard.tsx`
- `src/features/billing/components/PremiumAddonsSection.tsx`
- `src/features/billing/components/TeamUWWizardManager.tsx`
- `src/features/billing/components/AddonUpsellDialog.tsx`
- `src/features/billing/components/CheckoutSuccessDialog.tsx`
- `src/components/auth/RouteGuard.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/router.tsx`
- `src/features/underwriting/hooks/useUnderwritingFeatureFlag.ts`

### Service/hooks

- `src/services/subscription/subscriptionService.ts`
- `src/services/subscription/SubscriptionRepository.ts`
- `src/services/subscription/adminSubscriptionService.ts`
- `src/services/subscription/subscriptionSettingsService.ts`
- `src/hooks/subscription/useSubscription.ts`
- `src/hooks/subscription/useFeatureAccess.ts`
- `src/hooks/subscription/useSubscriptionSettings.ts`
- `src/hooks/subscription/useTeamUWWizardSeats.ts`
- `src/hooks/subscription/useUserActiveAddons.ts`

### Edge functions

- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-portal-session/index.ts`
- `supabase/functions/manage-subscription-items/index.ts`
- `supabase/functions/stripe-webhook/index.ts`

### DB migrations/policies/RPCs

- `supabase/migrations/20260216141453_stripe_migration.sql`
- `supabase/migrations/20260216144006_fix_stripe_idempotency.sql`
- `supabase/migrations/20260217145520_stripe_live_mode_and_team_uw_wizard.sql`
- `supabase/migrations/20260217145707_stripe_live_mode_and_team_uw_wizard.sql`
- `supabase/migrations/20260217152153_fix_team_uw_wizard_security.sql`
- `supabase/migrations/20260217152650_seat_pack_idempotency.sql`
- `supabase/migrations/20260217162956_add_stripe_subscription_item_ids.sql`
- `supabase/migrations/20260127135651_add_subscription_admin_system.sql`
- `supabase/migrations/20260127144007_fix_subscription_rls_and_remove_starter.sql`
- `supabase/migrations/archive/2025/20251218_005_subscription_tiering_system.sql`
- `supabase/migrations/archive/2025/20251218_006_lemon_squeezy_integration.sql`
- `supabase/migrations/20260128075800_subscription_settings.sql`
- `supabase/migrations/20260128093306_fix_subscription_gating.sql`
- `supabase/migrations/20260131103758_fix_default_subscription_to_free.sql`

### Docs

- `docs/subscription-tiers/doc.md`
- `docs/billing/subcriptions.md`
- `docs/billing/TEMPORARY_FREE_ACCESS.md`

## 2) Current implementation flow

### Main subscription checkout

1. UI calls `subscriptionService.createCheckoutSession(...)` from `PricingCards`/`AddonUpsellDialog`.
2. Service invokes `create-checkout-session`.
3. Edge function creates Stripe Checkout Session (`mode: subscription`) and includes `metadata.user_id`.
4. Stripe webhook handles:
   - `checkout.session.completed` to store customer/session IDs.
   - `customer.subscription.created|updated|resumed|deleted|paused` for subscription state sync.
   - `invoice.paid` and `invoice.payment_failed` for payment records and status changes.
5. Billing page polls/refetches subscription state and shows success dialog.

### Customer portal

1. UI calls `subscriptionService.createPortalSession(...)`.
2. Service invokes `create-portal-session`.
3. Edge function creates Stripe Billing Portal session and returns portal URL.

### Add-ons + seat packs

1. UI calls `manage-subscription-items` through service methods (`addSubscriptionAddon`, `addSeatPack`, etc.).
2. Function mutates Stripe subscription line items.
3. Function mirrors line-item state into `user_subscription_addons` / `team_seat_packs`.
4. Webhook `customer.subscription.updated` also reconciles removed line items.

## 3) Live Stripe account state (verified)

Verified via Stripe API on 2026-02-21 using live key in environment.

- Account: US, charges enabled, payouts enabled.
- Live mode confirmed (`livemode: true` on price objects).
- Products configured: Pro Plan, Team Plan, UW Wizard Starter, UW Wizard Professional, Team Seat Pack.
- Prices configured and active (9 total) and matching code-used IDs.
- Webhook endpoint exists and enabled:
  - URL: `https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/stripe-webhook`
  - Events include: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`
- Billing portal configuration exists and is active/default.
- Live subscriptions: 0
- Live invoices: 0
- Live customers: 0
- Checkout sessions: 1 (expired, unpaid, created 2026-02-17 20:17:39 UTC, no subscription created)

Note: webhook endpoint probe returns function-level `"Missing signature"` (not gateway auth error), so deployed endpoint currently accepts unauthenticated webhook calls and relies on Stripe signature verification as intended.

## 4) Live DB billing state (verified)

Verified via read-only SQL on 2026-02-21.

- `user_subscriptions`: 105 rows
- `active/trialing`: 105
- rows with `stripe_subscription_id` set: 0
- `subscription_payments`: 0
- `subscription_events`: 0
- All 105 users are on `free` plan currently.
- `user_subscription_addons`: 5 rows, all `manual_grant`, none Stripe-linked.
- `team_seat_packs`: 0 active
- `subscription_settings.temporary_access_enabled`: `false`
- Free plan feature matrix is broadly enabled (many paid-like features set to true).

## 5) What is completed/correct

- Stripe migration from Lemon exists across schema and edge functions.
- Webhook signature verification is implemented (`stripe.webhooks.constructEvent`).
- Webhook idempotency exists at event level (`subscription_events.stripe_event_id`) and payment level (`ON CONFLICT (stripe_invoice_id)`).
- Checkout, portal, add-on, and seat-pack flows are implemented end-to-end in code.
- Payment-failed webhook path exists and sets base subscription status to `past_due`.
- Stripe live account has required products/prices/webhook/portal configured.

## 6) Critical / high issues

### CRITICAL-1: Privileged Stripe RPCs are callable by `PUBLIC`/`anon`/`authenticated`

Evidence:

- `process_stripe_subscription_event` + `record_stripe_payment` are `SECURITY DEFINER` and can mutate billing tables (`supabase/migrations/20260216141453_stripe_migration.sql:107`, `supabase/migrations/20260216141453_stripe_migration.sql:224`).
- Live grants show `EXECUTE` for `PUBLIC`, `anon`, and `authenticated` (verified via `information_schema.routine_privileges`).
- No authorization check inside these functions (no `auth.uid()` guard).

Impact:

- Client-side callers could forge subscription/payment events.
- Potential unauthorized plan/status changes, fake payments, and cross-user mutation by passing arbitrary `p_user_id`.

### CRITICAL-2: Users can directly update their own `user_subscriptions` row

Evidence:

- Live RLS policy `user_subscriptions_update_own` allows any authenticated user to update any columns on own row.
- Table privileges include `UPDATE` for `authenticated`.

Impact:

- Users can self-upgrade in DB (e.g., set `plan_id`, `status='active'`) without payment.
- Direct entitlement bypass risk independent of Stripe.

### HIGH-1: “Change Plan” creates a new Stripe subscription instead of modifying existing one

Evidence:

- UI button shows “Change Plan” when a subscription exists (`src/features/billing/components/PricingCards.tsx:306`).
- Flow still calls new checkout session (`src/features/billing/components/PricingCards.tsx:123`).
- Checkout function creates `mode: subscription` new sessions (`supabase/functions/create-checkout-session/index.ts:83`).

Impact:

- Possible double subscriptions and double billing in Stripe.
- Local DB tracks only one `stripe_subscription_id`, so extra subscriptions can become orphan charges.

### HIGH-2: Team plan displayed price does not match Stripe live charge

Evidence:

- DB plan price currently Team = `$150/mo` (`15000`) and `$1650/yr` (`165000`) in production.
- Team Stripe price IDs in DB still point to live Stripe prices `$250/mo` and `$2750/yr`.
- Audit log confirms pricing changed in DB on 2026-02-20 from 25000/275000 to 15000/165000.

Impact:

- Users can see one price in UI but be charged a higher amount in Stripe checkout.

### HIGH-3: Seat pack schema/code mismatch

Evidence:

- Live DB has `UNIQUE(stripe_subscription_id)` on `team_seat_packs`.
- Code inserts one row per seat-pack purchase and also contains logic expecting multiple rows per subscription item.

Impact:

- Additional seat-pack purchases likely fail DB write and require rollback.
- If rollback fails, Stripe can remain changed while DB fails to reflect it.

## 7) Medium issues

### MED-1: Checkout trusts client-provided `priceId`

Evidence:

- `create-checkout-session` uses request `priceId` directly (`supabase/functions/create-checkout-session/index.ts:66`, `supabase/functions/create-checkout-session/index.ts:84`).
- No server-side allowlist check against `subscription_plans`.

Impact:

- A caller can attempt checkout for any active price in account.
- Can create billed subscriptions that do not map cleanly to app plans.

### MED-2: Portal return URL is client-controlled

Evidence:

- `create-portal-session` accepts `returnUrl` from request and passes directly to Stripe (`supabase/functions/create-portal-session/index.ts:66`, `supabase/functions/create-portal-session/index.ts:87`).

Impact:

- Open-redirect style behavior after portal exit to attacker-supplied URL.

### MED-3: Missing code-handled event for `invoice.payment_action_required`

Evidence:

- Webhook handles `invoice.paid` and `invoice.payment_failed`, but not explicit action-required flows.

Impact:

- Incomplete dunning/UX for SCA-required scenarios.

### MED-4: `stripe-webhook` auth mode is not codified in repo

Evidence:

- No `supabase/functions/stripe-webhook/config.toml` file in repo.
- Deployed endpoint currently behaves as public webhook (signature-verified), but this is config drift risk.

Impact:

- Future redeploy/config changes could accidentally re-enable JWT requirement and break webhooks.

## 8) Payment failure handling: what exists vs missing

### Exists

- `invoice.payment_failed` sets base subscription to `past_due` and records failed payment (`supabase/functions/stripe-webhook/index.ts:870`).
- Payment failure email path exists.
- Feature checks using `useSubscription().isActive` generally treat `past_due` as inactive.

### Missing / weak

- No robust dunning workflow state model in app.
- No explicit access revocation workflow beyond status-dependent checks.
- UW Wizard add-on access path can remain decoupled from base subscription state (depends on add-on row status/period, not base subscription `past_due`).

## 9) Can users be double-charged or get access without paying?

### Double-charge risk: Yes

- Plan changes currently create new subscriptions instead of updating existing subscriptions.
- Concurrent add-on/seat actions can still race at Stripe line-item level.

### Not charged but still get access: Yes (critical paths)

- Direct self-edit of `user_subscriptions` via permissive update policy.
- Forged invocation of privileged Stripe RPCs exposed to `PUBLIC`/`anon`.
- Existing manual grants on free-plan users (`user_subscription_addons` manual grants).

## 10) Docs/status drift

- `docs/subscription-tiers/doc.md` is stale (still references Lemon, 4-tier baseline, old pricing).
- `docs/billing/subcriptions.md` is placeholder/incomplete.
- `docs/billing/TEMPORARY_FREE_ACCESS.md` is stale relative to current DB-driven settings and current feature matrices.
- Billing page banner (“not live yet / full access”) partially conflicts with real behavior (billing infra exists; free plan is highly permissive but not literally full-access for every feature).

## 11) Recommended remediation order

1. Lock down Stripe RPCs immediately.
   - Revoke execute from `PUBLIC`, `anon`, `authenticated`.
   - Restrict to service role only.
   - Add explicit caller auth checks in function body for defense in depth.
2. Remove direct user update rights for billing-critical columns.
   - Replace `user_subscriptions_update_own` with constrained RPCs or column-safe paths.
3. Fix plan-change flow.
   - For existing subscribers, use Stripe subscription update/schedule/portal flow, not new checkout subscription.
4. Resolve Team pricing mismatch.
   - Align DB displayed price and Stripe price IDs immediately.
5. Fix seat-pack model mismatch.
   - Either remove unique constraint or change implementation to one-row quantity model.
6. Add server-side checkout allowlist.
   - Map requested plan to DB and resolve allowed price IDs server-side.
7. Validate/allowlist portal return URLs.
8. Add missing payment-action-required handling and clearer dunning UX.
9. Commit `stripe-webhook/config.toml` with explicit `verify_jwt = false` to avoid deployment drift.

## 12) Final status summary

- Stripe foundation is implemented and partially production-configured.
- No live paid subscriptions have completed yet.
- Current state is not safe to launch billing as-is due to critical authorization flaws and pricing/plan-change correctness risks.
