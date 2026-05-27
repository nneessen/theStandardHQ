# Self-Serve Subscriptions Disabled + Billing-Page Access Gate (2026-05-27)

> Platform-wide UI change that hides every "Upgrade to Pro/Team" CTA and blocks
> all new subscription sign-ups, and restricts the Billing page to users who
> already hold a paid subscription — while keeping existing (including
> delinquent) payers able to manage/cancel via the Stripe portal.

## Decision

No user may start a new subscription or change plans. Every upgrade CTA is
hidden across the app, and the Billing page is shown only to users who already
have a paid (Pro/Team) subscription to manage. This is a **UI-level gate**, not
a server-side disablement of the `create-checkout-session` edge function. It
aligns with the platform's 2026 wind-down posture (see the FFG/Self Made
selective-revocation work in `project-meta-status` / `security-multi-tenancy`).

## Mechanism — single central flag

`src/lib/subscription/subscription-availability.ts` exports:

```ts
export const NEW_SUBSCRIPTIONS_ENABLED = false;
```

Flipping it to `true` fully reverses every behavior below with **no other code
changes** — the route guard and sidebar gate both derive their restriction from
`!NEW_SUBSCRIPTIONS_ENABLED`, and all CTAs/checkout paths re-enable.

### What the flag controls (when `false`)
- **Upgrade CTAs hidden, locked state kept.** Shared `UpgradePrompt` /
  `FeatureGate` suppress their CTA and neutralize "Upgrade to X" copy (locked
  indicator remains). Scattered feature surfaces gated the same way:
  dashboard (`DashboardHeader`, `GatedKPISection`, `GatedStat`, `GatedAction`,
  `TeamRecruitingSection`), `BasicRecruitingView`, `TheStandardTeamPage`,
  `MessagesPage`, `AnalyticsDashboard`, `UsageOverview`, `UWLimitReachedDialog`,
  `ChatBotLanding`.
- **Checkout entry points dead.** `BillingPage` hides `<PricingCards>`;
  `PricingCards.handleSelectPlan`, `AddonUpsellDialog`, and `ChatBotLanding`'s
  purchase handler all early-return when the flag is off (defense in depth).
- **Billing route + sidebar item gated** to paid subscribers only (below).

## Billing-page access gate — `hasManageableSubscription`

`subscriptionService.hasManageableSubscription(subscription)` decides who may see
Billing:

```ts
hasManageableSubscription(subscription) {
  if (!subscription?.plan) return false;
  return this.isPaidPlan(subscription.plan); // price_monthly > 0 || price_annual > 0
}
```

Exposed via `useSubscription()`; consumed by `RouteGuard` (new
`requiresPaidSubscription` prop → redirects to `/dashboard`) and
`useSidebarNavigation` (new `requiresPaidSubscription` item flag → hides the
Billing nav item). Super-admins bypass both. The route/sidebar both pass
`!NEW_SUBSCRIPTIONS_ENABLED`, so the restriction only applies while sign-ups are
off.

### Why "on a paid tier", NOT "active paid" (the bug an independent review caught)
The first implementation gated on `isPaidPlan && isSubscriptionActive`.
`isSubscriptionActive` only accepts status `active`/`trialing`, so a subscriber
in `past_due`/`unpaid`/`incomplete` (declined card) would be **redirected off
Billing with the nav hidden — unable to reach the Stripe portal to fix payment
or cancel**, while charges kept retrying. The gate was changed to require only a
paid plan (`isPaidPlan`), regardless of status. Cancellation reverts the row to
the Free plan (existing webhook behavior), which `isPaidPlan` correctly
excludes. Regression tests cover `past_due`/`unpaid` (must retain access) and
reverted-to-Free (must lose access).

## Preserved behavior
- Existing paid subscribers keep `CurrentPlanCard` → "Manage Subscription"
  (`createPortalSession`) — the Stripe customer portal for invoices, card
  updates, and cancellation. This is the only billing action a subscriber can
  still take; there is no in-app upgrade/downgrade/change-plan path.
- `ChatBotPage` bot re-provision (`addSubscriptionAddon`) is left intact: it is
  gated on the user *already owning* the addon, so it repairs an existing
  subscription rather than starting a new one.

## Edge cases & decisions
- **Grandfathered FREE-plan users** (the ~97 from migration `20260425161000`)
  are on a free plan → excluded from Billing. Acceptable: the "subscribe before
  expiry" notice is moot while sign-ups are disabled, and the gate reopens to
  them automatically when the flag flips back.
- **$0-price paid tier** would be misclassified as Free by `isPaidPlan`
  (pre-existing limitation used throughout the codebase). Current DB prices are
  non-zero; noted as a latent contract issue, not introduced here.
- **Marketing copy inside `BillingPage`** (e.g. "Upgrade once, stay ahead
  always", Team early-access strip, FAQ "subscribe before…") was left in place;
  it is seen only by existing paid subscribers and carries no purchase CTA.

## Verification
- Static only: `tsc --noEmit` clean, ESLint 0 errors on changed files,
  `npm run build` exit 0, new `hasManageableSubscription` unit tests pass
  (incl. delinquent-payer cases).
- **Not** runtime-tested in a live browser across free / paid / past_due user
  types — the free-vs-paid behavior depends on `useSubscription()` data shape at
  runtime.
- 4 pre-existing failures in `subscriptionService.test.ts`
  (`findByUserIdWithPlan` mocking, `getUsageStatus` overage math) are unrelated.

## To re-enable self-serve subscriptions
Set `NEW_SUBSCRIPTIONS_ENABLED = true`. Pricing cards, all upgrade CTAs, and
checkout reactivate; `/billing` and the Billing nav item reopen to all users.
Before doing so, note the unresolved billing-system issues documented in
`billing-stripe` (privileged Stripe RPCs, self-upgrade RLS policy, Team
DB/Stripe price mismatch, plan-change duplicate-subscription bug).
