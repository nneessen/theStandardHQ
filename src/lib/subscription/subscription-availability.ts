// src/lib/subscription/subscription-availability.ts
// Central kill-switch for self-serve subscriptions / plan upgrades.
//
// When `false` (current state):
//   - Every "Upgrade to Pro/Team" CTA and Stripe checkout entry point is hidden
//     across the app, so no user can start a new subscription or change plans.
//   - The Billing page is restricted to users who already hold an active paid
//     subscription (plus super-admins) so they can still manage/cancel it.
//
// This is a UI-level gate. To re-enable self-serve subscriptions, flip this to
// `true` — no other code changes are required.
//
// ENABLED (Jun 2026): single $25/mo "Standard" plan is self-serve. Outside-team
// users subscribe via Stripe checkout; the owner's team gets everything free via
// the Epic Life `free_all_features` entitlement (so they see no upgrade prompts).

export const NEW_SUBSCRIPTIONS_ENABLED = true;
