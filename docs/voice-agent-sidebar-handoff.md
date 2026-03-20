# AI Voice Agent Sidebar + Feature Handoff

**Date:** 2026-03-19
**Repo:** `commissionTracker`
**Status:** Ready for independent implementation

## Problem

`commissionTracker` already has partial Premium Voice work:

- billing-page `Coming Soon` treatment for Premium Voice
- server-side self-serve purchase block
- voice entitlement + voice usage read paths from `standard-chat-bot`
- voice sync state living alongside chat-bot subscription state
- voice usage surfaced inside the existing Chat Bot usage tab

What is still missing is the product surface.

There is **no separate sidebar navigation item** for the voice product, and there is **no dedicated AI Voice Agent feature page** in `commissionTracker`.

The user explicitly wants voice to appear as its own feature in the sidebar even if it still shares some underlying methods and sync contracts with the SMS/chat bot.

## Product intent

Treat `AI Voice Agent` as:

- a separate nav item
- a separate feature page
- a separate paid add-on
- currently **not self-serve purchasable**
- visually aligned with the rest of `commissionTracker`

Do **not** collapse it into the existing `Chat Bot` nav item.
Do **not** expose purchase controls yet.
Do **not** move Retell runtime ownership into `commissionTracker`.

## Current state to preserve

These existing changes should remain intact:

- `src/features/billing/BillingPage.tsx`
  - has a visible Premium Voice `Coming Soon` card
- `src/features/billing/components/PremiumAddonsSection.tsx`
  - has coming-soon treatment for Premium Voice
- `src/lib/subscription/voice-addon.ts`
  - rollout flag remains off
  - launch pricing/copy should remain aligned with `$149/mo`
- `src/features/chat-bot/hooks/useChatBot.ts`
  - already includes `get_voice_entitlement` and `get_voice_usage`
- `src/features/chat-bot/components/UsageTab.tsx`
  - already renders voice entitlement/usage details
- `supabase/functions/manage-subscription-items/index.ts`
  - already blocks self-serve Premium Voice purchase

## Goal

Add a dedicated `AI Voice Agent` feature entry to the sidebar and a dedicated route/page for it.

The page should:

- feel like a first-class product area
- explain that voice is separate from SMS chat bot billing
- show current sync/entitlement status if available
- show usage snapshot if available
- show `Coming Soon` / managed rollout messaging instead of purchase controls
- reuse existing data hooks where sensible instead of duplicating API logic

## UX requirements

### Sidebar

Add a new sidebar nav item under the same general product/tools area as `Chat Bot`.

Recommended label:

- `AI Voice Agent`

Recommended behavior:

- visible in the sidebar even when the user has not purchased voice
- not hidden behind subscription gating at the nav level
- page itself handles state and messaging, same general pattern as `Chat Bot`

Recommended placement:

- near `Chat Bot`, not buried in billing/settings

### Dedicated page

Add a dedicated page/route, recommended path:

- `/voice-agent`

The page should have three main states:

1. `No voice entitlement / not launched to self-serve yet`
   - show a polished overview page
   - show the `$149/mo` launch plan and `500 included minutes`
   - clearly mark it as `Coming Soon`
   - make it obvious this is a separate add-on from Chat Bot
   - no active purchase CTA
   - CTA should be informational only, such as `Coming Soon`, `Contact Support`, or `Managed Rollout`

2. `Voice entitlement exists but rollout is still operationally managed`
   - show entitlement status
   - show usage summary
   - show sync health / last sync info if available
   - show feature flags included in the entitlement snapshot if available
   - explain that full runtime setup still happens in `standard-chat-bot`

3. `Service degraded / unavailable`
   - follow the current app style for temporary service issues
   - show a helpful but restrained degraded-state message
   - do not dump raw edge-function errors into the UI

### Design constraints

The UI should match the existing `commissionTracker` look and feel.

Avoid:

- generic AI-marketing page style
- duplicate purchase cards that conflict with billing
- self-serve Stripe CTAs
- exposing Retell credentials or agent IDs

Prefer:

- same card density and spacing used in existing product pages
- same muted/zinc styling already used in `Chat Bot`
- straightforward product language
- compact, operator-oriented status panels

## Data/model requirements

Reuse existing voice read paths before adding new ones.

Start from:

- `useChatBotVoiceEntitlement()`
- `useChatBotVoiceUsage()`
- existing chat-bot agent bootstrap data if useful

Do not build a second independent voice data client unless absolutely necessary.

If additional data is needed for a better dedicated page, prefer extending the existing `chat-bot-api` contract rather than creating unrelated parallel plumbing.

## Architectural direction

This feature is a `commissionTracker` commercial/admin surface, not the voice runtime owner.

That means:

- `commissionTracker` may display voice status, usage, sync health, and rollout messaging
- `commissionTracker` should not own Retell prompts, API keys, phone provisioning, or live call behavior
- those remain in `standard-chat-bot`

The page can mention where runtime setup lives, but should not attempt to recreate the full `standard-chat-bot` voice configuration UI.

## Suggested implementation slices

### 1. Sidebar nav item

Update:

- `src/components/layout/Sidebar.tsx`

Add:

- new nav item for `AI Voice Agent`
- keep it public/visible similar to `Chat Bot`

### 2. Route registration

Update:

- `src/router.tsx`

Add:

- route for `/voice-agent`
- page component import

### 3. New feature module

Create a new feature folder, for example:

- `src/features/voice-agent/`

Suggested files:

- `VoiceAgentPage.tsx`
- `components/VoiceAgentLanding.tsx`
- `components/VoiceAgentStatusCard.tsx`
- `components/VoiceAgentUsageCard.tsx`
- `index.ts`

You do not need to use these exact filenames if the repo has a better pattern, but keep the feature modular.

### 4. Reuse existing hooks

Reuse from:

- `src/features/chat-bot/hooks/useChatBot.ts`

Avoid copying the same entitlement/usage query logic into a new hook file unless you are extracting shared behavior cleanly.

### 5. Coming-soon gating

Preserve these rules:

- no self-serve subscribe flow
- no `addSubscriptionAddon()` call for voice from this page
- no purchase button that triggers Stripe checkout

Allowed CTA examples:

- `Coming Soon`
- `Managed Rollout`
- `Contact Support`
- `Available Soon`

## Content requirements

At minimum, the dedicated voice page should communicate:

- Voice is a separate add-on from the AI Chat Bot
- Launch plan is `$149/mo`
- Includes `500` minutes
- The feature currently follows a managed rollout / coming-soon model
- Runtime setup is completed in the connected `standard-chat-bot` system
- Current entitlement/usage status if the user already has voice provisioned

## Acceptance criteria

1. Sidebar contains a separate `AI Voice Agent` nav item.
2. Clicking it opens a dedicated page, not a Chat Bot tab.
3. The page matches existing `commissionTracker` styling conventions.
4. The page clearly treats voice as a separate paid feature from Chat Bot.
5. The page does not allow self-serve purchase.
6. The page shows `Coming Soon` messaging when voice is not provisioned.
7. If voice data exists, the page surfaces entitlement and usage without duplicating backend plumbing.
8. Existing Premium Voice billing teaser and server-side purchase block remain intact.
9. No Retell secret/config runtime ownership is moved into `commissionTracker`.

## Nice-to-have

If it fits naturally, add:

- a small note linking users to `/billing` for plan visibility
- a sync-status panel using existing voice sync fields if those are already available in local data
- a compact comparison callout between `AI Chat Bot` and `AI Voice Agent`

## Out of scope

Do not implement these in this task:

- self-serve voice checkout
- Retell phone number provisioning
- Retell credential management UI
- full voice runtime configuration UI
- direct edits inside `standard-chat-bot`
- sidebar IA refactors unrelated to this feature

## Validation

At minimum run:

- relevant typecheck
- targeted lint on touched files if practical

If you add route/nav wiring, verify:

- sidebar renders correctly in collapsed and expanded states
- route loads cleanly when navigated directly
- page behaves sensibly for users with and without voice data

## Notes for implementer

There is already a lot of voice information inside the current Chat Bot surface. The goal here is not to copy that page 1:1. The goal is to create a dedicated voice entry point that acknowledges voice as its own product while reusing the existing data contracts behind the scenes.
