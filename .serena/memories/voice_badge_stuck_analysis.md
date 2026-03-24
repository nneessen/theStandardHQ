# Voice Agent "Draft needs publishing" Badge Stuck Issue — Root Cause Analysis

**Date:** March 24, 2026  
**Status:** Backend publish API fix is deployed, but badge still shows "Draft needs publishing"

---

## The Problem

After a successful publish, the badge should immediately flip to "Live" (or disappear), but it remains "Draft needs publishing" = `is_published: false`.

---

## Key Finding: THE SMOKING GUN

**File:** `src/features/chat-bot/hooks/useChatBot.ts`, lines 1270–1279

The `usePublishRetellAgentDraft` mutation's `onSuccess` callback **explicitly avoids invalidating** `retellRuntime` and `voiceSetupState` queries. The comment explains why:

```typescript
onSuccess: () => {
  toast.success("Voice draft published.");
  // Only invalidate retellLlm — do NOT invalidate retellRuntime or
  // voiceSetupState here.  The optimistic update already set
  // is_published / published = true in both caches.  Retell's API has
  // a propagation delay, so an immediate (or short-delayed) re-fetch
  // returns stale is_published=false and overwrites our optimistic data,
  // flipping the badge back to "Draft needs publishing".  The natural
  // staleTime (30 s for runtime, 15 s for setupState) will background-
  // refresh once Retell has had time to propagate.
  void queryClient.invalidateQueries({
    queryKey: chatBotKeys.retellLlm(),
  });
}
```

This is a **deliberate design choice** — the code expects Retell's API to have a propagation delay, and relies on the natural background refresh (`staleTime`) to eventually pick up the correct value.

---

## Where the Badge is Drawn

**File:** `src/features/voice-agent/components/VoiceAgentRetellStudioCard.tsx`, line 274

```typescript
const draftPendingPublish = runtime?.agent?.is_published === false;
```

And lines 486–495:

```tsx
{draftPendingPublish ? (
  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
    Draft needs publishing
  </Badge>
) : (
  runtime?.agent?.is_published === true && (
    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
      Live
    </Badge>
  )
)}
```

**The badge is ONLY driven by `runtime?.agent?.is_published`.**

---

## The Two Caches

The optimistic update targets BOTH:

1. **`retellRuntime`** (staleTime: 30 seconds)
   - Used by: `VoiceAgentRetellStudioCard.tsx` to show the badge
   - Query: `useChatBotRetellRuntime()` at VoiceAgentPage.tsx:558

2. **`voiceSetupState`** (staleTime: 15 seconds)
   - Used by: VoiceAgentPage.tsx for display logic (line 571–577)
   - **BUT ACTIVELY POLLS** every 5 seconds via `refetchInterval` (line 842–843 in useChatBot.ts)

---

## THE ROOT CAUSE HYPOTHESIS: Polling Overwrites Optimistic Update

**File:** `src/features/chat-bot/hooks/useChatBot.ts`, lines 819–850

The `useChatBotVoiceSetupState` query has:

```typescript
staleTime: 15_000,
gcTime: 300_000,
refetchInterval: (query) =>
  shouldPollVoiceSetupState(query.state.data) ? 5_000 : false,
```

**Polling conditions** (lines 490–506):

```typescript
function shouldPollVoiceSetupState(
  setupState: ChatBotVoiceSetupState | null | undefined,
): boolean {
  if (!setupState) return false;

  const nextActionKey = setupState.nextAction?.key?.trim().toLowerCase();
  if (nextActionKey && VOICE_SETUP_POLLING_ACTION_KEYS.has(nextActionKey)) {
    return true;  // Polls if nextAction.key is "wait_for_provisioning"
  }

  const provisioningStatus = setupState.agent?.provisioningStatus
    ?.trim()
    .toLowerCase();
  return Boolean(
    provisioningStatus && VOICE_AGENT_PENDING_STATUSES.has(provisioningStatus),
    // Polls if agent.provisioningStatus is one of: "pending", "queued", "requested", "creating", "provisioning"
  );
}
```

**THE PROBLEM:** After publish, if the backend still returns:
- `agent.provisioningStatus = "pending"` (or similar)
- OR `nextAction.key = "wait_for_provisioning"`

Then `shouldPollVoiceSetupState` returns `true`, activating the 5-second polling.

---

## The Flow After Publish

1. User clicks "Publish Draft"
2. `usePublishRetellAgentDraft.mutate()` fires
3. **`onMutate`** runs:
   - Cancels in-flight `retellRuntime` and `voiceSetupState` queries
   - Sets optimistic update in both caches: `is_published: true` and `published: true`
4. Backend API call succeeds
5. **`onSuccess`** runs:
   - Shows toast "Voice draft published."
   - Invalidates ONLY `retellLlm` (not `retellRuntime` or `voiceSetupState`)
6. **BUT THEN:** The `voiceSetupState` polling timer (5 seconds) fires, and makes a fresh API call to `get_voice_setup_state`
7. If Retell's propagation delay is >5 seconds, the fresh response returns `published: false` (or no `published` field) PLUS still has `nextAction.key = "wait_for_provisioning"` or `agent.provisioningStatus = "pending"`
8. The polling re-fetch **overwrites** the optimistic cache entry with the stale data
9. The badge flips back to "Draft needs publishing"

---

## The QueryClient Global Config

**File:** `src/index.tsx`, lines 201–224

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,         // 5 minutes
      gcTime: 10 * 60 * 1000,           // 10 minutes
      refetchOnWindowFocus: false,      // ← Won't trigger on focus
    },
  },
});
```

**Key point:** `refetchOnWindowFocus: false` — so the badge is NOT being stuck by a refetch-on-focus. It's the **active polling** from `voiceSetupState` that's the culprit.

---

## Additional Context from VoiceAgentPage

**File:** `src/features/voice-agent/VoiceAgentPage.tsx`, lines 575–577

```typescript
const voiceAgentPublished =
  voiceSetupState?.agent?.published === true ||
  retellRuntime?.agent?.is_published === true;
```

The page logic **ORs both sources**, but the badge in `VoiceAgentRetellStudioCard` **only checks `retellRuntime`**. This explains why the badge can be wrong even if the upstream data is correct.

---

## Summary: What's Actually Happening

1. **Badge logic:** Only checks `runtime?.agent?.is_published`
2. **Optimistic update:** Sets `is_published: true` in `retellRuntime` cache after publish succeeds
3. **The design intent:** Wait for Retell's propagation, then let `staleTime` (30s) trigger a background refresh
4. **What's breaking it:** `voiceSetupState` polling (every 5s) keeps firing BECAUSE the backend API response still has `nextAction.key = "wait_for_provisioning"` or `agent.provisioningStatus = "pending"`
5. **The 5-second polling catches stale data from Retell BEFORE it propagates** (which takes >5 seconds)
6. **Result:** The optimistic update is overwritten by stale data, badge flips back

---

## Root Cause Identified

**The polling is correctly designed to continue while provisioning is pending.** But the backend might be returning "provisioning pending" AFTER publish succeeds, causing polling to restart and overwrite the optimistic cache with stale Retell data.

This is a **backend state management issue**, not a frontend caching issue. The backend needs to:

1. **Stop marking the agent as "provisioning pending" after successful publish**
2. **Clear or update the `nextAction` once publish completes**
3. **Ensure the response includes the correct `published: true` flag immediately**

OR the frontend needs to:

1. **Stop polling after publish** — set a flag to suppress `shouldPollVoiceSetupState` for 30+ seconds
2. **Delay the polling interval** — use exponential backoff, starting at 30+ seconds after a publish
3. **Trust the optimistic update completely** — don't let any polling overwrite it until staleTime expires

---

## Next Investigation Needed

Check what the backend API (`get_voice_setup_state`) is returning IMMEDIATELY after a successful publish. Does it:
- Include `published: true`? (Yes = good)
- Still have `nextAction.key = "wait_for_provisioning"`? (This would trigger polling)
- Still have `agent.provisioningStatus = "pending"`? (This would trigger polling)

If the backend is still returning pending status after publish, that's the bug.

