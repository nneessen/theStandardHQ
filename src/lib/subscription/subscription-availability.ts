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

export const NEW_SUBSCRIPTIONS_ENABLED = false;
