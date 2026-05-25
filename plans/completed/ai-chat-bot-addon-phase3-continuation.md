# AI Chat Bot Addon — Phase 3 Frontend Continuation

## What's Done

All files created and route/sidebar wired up. Build + typecheck passing as of last run.

### Created Files
- `src/features/chat-bot/hooks/useChatBot.ts` — React Query hooks (7 queries, 5 mutations) with `ChatBotApiError` class that handles 404/not-deployed gracefully (no retry spam)
- `src/features/chat-bot/components/ConnectionCard.tsx` — Reusable Close/Calendly connection card
- `src/features/chat-bot/components/SetupTab.tsx` — Bot config + connections
- `src/features/chat-bot/components/ConversationsTab.tsx` — Conversation list with 10s auto-refresh
- `src/features/chat-bot/components/ConversationThread.tsx` — Message thread dialog
- `src/features/chat-bot/components/AppointmentsTab.tsx` — Appointments table
- `src/features/chat-bot/components/UsageTab.tsx` — Lead usage progress bar + tier badge
- `src/features/chat-bot/components/ChatBotLanding.tsx` — Landing page (JUST REWRITTEN - see below)
- `src/features/chat-bot/ChatBotPage.tsx` — Main page with tabs
- `src/features/chat-bot/index.ts` — Barrel export

### Modified Files
- `src/router.tsx` — Added `chatBotRoute` at `/chat-bot` with `<RouteGuard noRecruits noStaffRoles>`
- `src/components/layout/Sidebar.tsx` — Added `Bot` icon + "Chat Bot" nav item in Tools group

## What Was Just Changed (needs verification)

The `ChatBotLanding.tsx` was rewritten with these improvements:
1. **Inline tier selection + purchase** — no more redirect to `/billing`. Calls `subscriptionService.addSubscriptionAddon(addonId, tierId)` directly
2. **Better copy** — explains what "leads/month" means (unique new leads, follow-ups don't count again)
3. **Real Close CRM logo** — full SVG component `CloseLogo`
4. **Real Calendly logo** — full SVG component `CalendlyLogo`
5. **Richer feature descriptions** — 6 feature cards with title + description instead of 4 one-liners
6. **Falls back to static tiers** if addon not configured in DB yet (shows "Coming Soon")

Key imports added to ChatBotLanding:
- `useAdminSubscriptionAddons`, `SubscriptionAddon`, `AddonTierConfig` from `@/hooks/admin`
- `useSubscription`, `subscriptionKeys`, `userAddonKeys` from `@/hooks/subscription`
- `subscriptionService` from `@/services/subscription`
- `useAuth` from `@/contexts/AuthContext`
- `useQueryClient` from `@tanstack/react-query`
- `toast` from `sonner`

## What Still Needs To Be Done

1. **Run `npm run typecheck`** — verify the rewritten ChatBotLanding compiles clean
2. **Run `npm run build`** — verify full build passes
3. **Visually test** — navigate to `/chat-bot` in the app, verify:
   - Landing page renders without console 404 spam (the `ChatBotApiError` fix)
   - Close + Calendly logos display correctly
   - Tier cards are selectable
   - "Activate" button shows (or "Subscribe to a plan first" if no active sub)
4. **Test purchase flow** — if user has active subscription + addon is in DB, clicking activate should add the addon inline via `subscriptionService.addSubscriptionAddon`

## Architecture Notes

- Purchase flow: `subscriptionService.addSubscriptionAddon(addonId, tierId)` → calls `manage-subscription-items` edge function → adds Stripe line item inline (no checkout redirect needed for users with active subs)
- Users without a subscription see "Subscribe to a plan first" disabled button + amber warning text
- The `chat-bot-api` edge function doesn't exist yet in Supabase — the `ChatBotApiError` class in `useChatBot.ts` catches 404s and returns `null` for the agent query (shows landing page), with `retry: false` so no console spam

## Styling Reference
- Follow `docs/styling/STYLING_GUIDE.md` — compact/data-dense, `text-[11px]` body, zinc palette, dark mode variants
- Follow `docs/COMPONENT_STYLING_GUIDE.md` — CSS variables, hover/active states
- Follow `docs/TANSTACK_QUERY_IMPLEMENTATION_GUIDE.md` — object syntax, structured keys, explicit invalidation
