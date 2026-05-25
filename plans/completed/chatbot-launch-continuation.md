# Chatbot Launch + Stripe Production Readiness — Continuation

## Status: In Progress (needs hook fix + deploy)

## What's Done (code changes committed to working tree, NOT committed to git)

### 1. ChatBotPage.tsx — UNDER_DEVELOPMENT gate removed
- `UNDER_DEVELOPMENT` constant removed entirely
- `Construction` import, `isSuperAdminEmail` import, `useAuth` import, `isAdmin` variable all removed
- The "Under Development / Coming Soon" banner block removed
- File: `src/features/chat-bot/ChatBotPage.tsx`

### 2. stripe-webhook/config.toml — Created
- New file: `supabase/functions/stripe-webhook/config.toml`
- Contains `verify_jwt = false` (Stripe authenticates via HMAC signature, not JWT)

### 3. create-checkout-session — priceId validation added
- File: `supabase/functions/create-checkout-session/index.ts`
- After the `!priceId` check, added DB lookup to validate priceId against `subscription_plans` table
- Returns 400 "Invalid price ID" if not found

### 4. stripe-webhook — Admin notifications added
- File: `supabase/functions/stripe-webhook/index.ts`
- Added `sendAdminNotification()` helper function (plain-text emails via Mailgun to nickneessen@thestandardhq.com)
- Non-fatal: wrapped in try/catch so webhook processing never breaks
- Added at 4 call sites:
  - `customer.subscription.created` — "New Subscription: {name} ({plan})"
  - `customer.subscription.deleted` — "Subscription Cancelled: {name}"
  - `invoice.payment_failed` — "Payment Failed: {name} - {amount}"
  - `checkout.session.completed` (addon) — "New Addon Purchase: {name} ({tier})"

### 5. setup-addon-stripe-products edge function — Created
- New file: `supabase/functions/setup-addon-stripe-products/index.ts`
- Super admin only edge function
- Creates Stripe product via `stripe.products.create()`, then creates monthly + annual prices for each paid tier
- Writes all IDs back to `tier_config` JSONB (including `stripe_product_id` at the config level)
- Idempotent — skips tiers that already have price IDs

### 6. AddonsManagementPanel.tsx — Tier editor unlocked for all addons + Stripe setup button
- File: `src/features/billing/components/admin/AddonsManagementPanel.tsx`
- **BUG TO FIX**: Changed `supportsTiers` from `addon.name === "uw_wizard"` to `!!tierConfig?.tiers && tierConfig.tiers.length > 0` — this is correct
- **BUG TO FIX**: Added `useState(false)` for `isSettingUpStripe` AFTER the `useEffect` hook — this violates React's Rules of Hooks and causes a crash. The `useState` call must be moved to the TOP of the `AddonEditorDialog` component, alongside the other `useState` calls (before any `useEffect` or conditional logic).
- Added `handleSetupStripeProducts` function that calls `supabase.functions.invoke("setup-addon-stripe-products")`
- Added `hasMissingPriceIds` computed boolean
- Added amber banner with "Setup Stripe Products & Prices" button in the tier editor section
- Added imports: `Zap` from lucide-react, `supabase` from services/base, `toast` from sonner
- Changed `tierConfig` passing in `handleSave` to always pass tierConfig (not just for `supportsTiers`)

## What Needs Fixing

### CRITICAL: React Hooks Order Violation in AddonsManagementPanel.tsx
In the `AddonEditorDialog` component (~line 254), `useState(false)` for `isSettingUpStripe` was added AFTER the `useEffect` hook. Move it to be with the other `useState` calls at the top of the component (around line 220-227, after `const [tierConfig, setTierConfig] = useState<TierConfig | null>(null);`).

## What's NOT Done (manual steps after deploy)

1. **Deploy edge functions**: `stripe-webhook`, `create-checkout-session`, `setup-addon-stripe-products`
2. **Open admin panel** > Billing > Addons > Configure AI Chat Bot
3. **Click "Setup Stripe Products & Prices"** button — this auto-creates the Stripe product + 6 prices
4. **Verify Stripe Dashboard** > Settings > Customer emails: enable receipts + dunning reminders

## Files Modified (summary)

| File | Status |
|------|--------|
| `src/features/chat-bot/ChatBotPage.tsx` | Done |
| `supabase/functions/stripe-webhook/config.toml` | Done (new) |
| `supabase/functions/stripe-webhook/index.ts` | Done |
| `supabase/functions/create-checkout-session/index.ts` | Done |
| `supabase/functions/setup-addon-stripe-products/index.ts` | Done (new) |
| `src/features/billing/components/admin/AddonsManagementPanel.tsx` | NEEDS HOOK FIX |

## Verification After Fix
1. `./scripts/validate-app.sh` — must pass
2. Open admin panel, configure chatbot addon — no React errors
3. All 4 tiers (free, starter, growth, scale) visible in tier editor
4. "Setup Stripe Products" button visible when paid tiers lack price IDs
