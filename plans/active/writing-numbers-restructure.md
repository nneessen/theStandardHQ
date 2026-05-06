# Writing Numbers — Restructure Plan

**Status:** Draft, awaiting sign-off
**Date:** 2026-05-05
**Route affected:** `/the-standard-team`
**Files in scope:** `src/features/the-standard-team/**`, `src/components/layout/Sidebar.tsx`, `src/router.tsx`

---

## Why

The page was supposed to be a simple way for agents to keep track of their carrier writing numbers, with uplines able to view team status. It grew into a four-mode workspace (tab × team-vs-agent × agent-search × selected-agent) with three unrelated concepts crammed in (writing numbers, state licenses, agency state classifications) plus a right sidebar for carrier-contract toggles. Nick's verdict: too confusing for normal users, way more complicated than the actual job requires. State licenses tab confirmed as not really being used.

This plan strips the page back to its actual job and cuts what isn't earning its place.

---

## Scope

**In scope:** UI restructure of `/the-standard-team`, deletion of unused state-licenses + classifications code, sidebar nav label update.

**Out of scope:**
- DB migrations (orphaned `agent_state_licenses` and `agency_state_classifications` tables are left in place; cleanup is a separate decision).
- Backend changes — this is purely a frontend rework.
- Permissions / billing gating logic (`useLicensingWorkspaceAccess` stays as-is).
- Carrier contract toggle UX — already lives in Settings → Profile per the trial banner copy.

---

## The new page

Three view modes, single route. Default to the simplest. Power tools are explicit opt-ins, not on-by-default.

### 1. Default — "My Writing Numbers"

Every user lands here. Looks like a settings screen, not a spreadsheet.

```
┌────────────────────────────────────────────────────────────┐
│ Writing Numbers                       [ View team → ]      │  ← upline only
│ ─────────────────────────────────────────────────────────  │
│ 8 saved · 7 missing            [ Search… ]   [ ☐ Missing only ]
│ ─────────────────────────────────────────────────────────  │
│ ✓ Aetna                   ABC-12345              [ Edit ]  │
│ ✓ Foresters               99887766               [ Edit ]  │
│ ⚠ Mutual of Omaha         [                  ]   [ Save ]  │
│ ⚠ Americo                 [                  ]   [ Save ]  │
│ ✓ Transamerica            TR-555-2024            [ Edit ]  │
│ …                                                          │
└────────────────────────────────────────────────────────────┘
```

- One flat list of all active carriers from `useActiveCarriers`.
- Inline edit on click — saved state shows the value, missing state shows an empty input.
- Two filters only: search + "missing only" toggle.
- Coverage strip removed (the saved/missing count tells the same story without a progress bar repeating it).

### 2. Upline view — "Team Writing Numbers"

Snapshot first, drill-in second. Only visible to users with at least one downline (gate on `agents.length > 1` from `useTheStandardAgents`, which is already hierarchy-scoped).

```
┌────────────────────────────────────────────────────────────┐
│ Team Writing Numbers              [ ← My numbers ]         │
│ ─────────────────────────────────────────────────────────  │
│ 5 agents · 31 of 75 carrier slots filled                   │
│ ─────────────────────────────────────────────────────────  │
│ Mike Chen        ██████████  15/15            [ View ]     │
│ Sarah Johnson    ████████░░   8/15            [ View ]     │
│ Alex Rivera      ██████░░░░   6/15            [ View ]     │
│ Jordan Smith     █████░░░░░   5/15            [ View ]     │
│ Lisa Park        ███░░░░░░░   3/15  ⚠         [ View ]     │
│ ─────────────────────────────────────────────────────────  │
│ [ Compare side-by-side ]                                   │
└────────────────────────────────────────────────────────────┘
```

- Each row: agent name, fill bar, count, "View" button.
- "View" drops into that agent's writing-numbers list (read-only or editable based on `canManageDownlineContracts` — same permission rules already in `AgentCarrierContractsCard`).
- The progress bar uses semantic tokens (`bg-success` ≥80%, `bg-warning` ≥40%, `bg-destructive` below).

### 3. Power-user — "Compare side-by-side"

The existing matrix view, kept but framed as an explicit analysis tool rather than the default.

- Reuse `WritingNumbersTable.tsx` (already exists, renders a real grid).
- Drops the "Coverage Board" / "Matrix" toggle that's currently inside `WritingNumbersTab` — there's only one matrix mode now.
- No filter chrome above the matrix beyond search + "missing only" — same toolbar as the personal view, single concept.

---

## What gets cut

| File | Lines | Why |
|---|---:|---|
| `components/StateLicensesTab.tsx` | 802 | Tab not really used |
| `components/StateLicensesTable.tsx` | 245 | Same |
| `components/StateClassificationDialog.tsx` | ~120 | Color classification feature gone with the tab |
| `hooks/useAgentStateLicenses.ts` | — | No remaining consumers |
| `hooks/useStateClassifications.ts` | — | No remaining consumers |

External callers verified: `grep` shows zero usages of these symbols outside the feature folder. Safe to delete.

The right-side `AgentCarrierContractsCard` sidebar also goes away from this page. The component itself stays (lives in `@/features/contracting`) — Settings → Profile is the only remaining home.

---

## What gets kept

| File | Treatment |
|---|---|
| `TheStandardTeamPage.tsx` | Heavy rewrite — three-column workspace collapses to single column with a top toolbar |
| `components/WritingNumbersTab.tsx` | Split into three components: `MyWritingNumbersView`, `TeamWritingNumbersOverview`, `WritingNumbersMatrixView` |
| `components/WritingNumbersTable.tsx` | Kept for the matrix mode — minor cleanup (remove `agents-rows`/`carriers-rows` toggle, just pick one) |
| `hooks/useAgentWritingNumbers.ts` | Unchanged |
| `hooks/useTheStandardAgents.ts` | Unchanged |
| `hooks/useLicensingWorkspaceAccess.ts` | Unchanged — billing gate stays |
| `index.ts` barrels | Updated for the new component shape |

---

## Routing & navigation

- Route stays at `/the-standard-team` — too entrenched in muscle memory and bookmarks to rename right now.
- The `?tab=` search param is dropped from the schema (no longer two tabs to pick from). Any old link with `?tab=state-licenses` or `?tab=writing-numbers` lands on the new default view; the param is silently ignored.
- `Sidebar.tsx:285` label currently reads "Licensing" (or similar — to verify when implementing) — rename to "Writing Numbers" to match the page's actual scope.
- Optional follow-up: alias `/writing-numbers` → `/the-standard-team` for cleaner future linking. **Not in this plan**, easy to add later.

---

## DB cleanup (separate decision, NOT this PR)

Two tables become orphaned by this restructure:
- `agent_state_licenses`
- `agency_state_classifications` (or wherever color classifications persist)

**Recommended sequencing:** ship the UI restructure first, leave the tables untouched. After ~30 days with no UI exercising them, run a separate migration to drop. This way if you ever want to revisit "state licenses" as a clean standalone feature, the historical data is preserved. If after 30 days you're sure, the cleanup migration is one-shot.

If you want them gone immediately as part of this PR, that's a separate `supabase/migrations/YYYYMMDDHHMMSS_drop_state_licensing.sql`. Flagged as an open decision below.

---

## Risks

1. **Hidden consumers I didn't find.** Verified `grep` shows no external usages of state-license hooks/components, but a runtime-only string lookup could exist (unlikely but possible). Mitigation: ship behind a feature flag for one day, watch error logs, then remove flag.
2. **Carrier-contract toggles in the right sidebar.** The trial banner says these "remain in Settings → Profile" — need to verify that path still works for both self and downline contract management before deleting the sidebar version. If the Settings → Profile version doesn't support managing downline contracts (only self), uplines lose a feature. **This is the most important pre-implementation check.**
3. **WritingNumbersTab is currently 966 lines** mixing my-view + team-overview + matrix logic. Splitting into three components risks subtle bugs in shared state (search query, filter mode, draft state). Mitigation: each new component owns its own state; no shared draft store.

---

## Open decisions for Nick

1. **Drop orphaned tables now or later?** I lean later (30-day soak). Yes/no?
2. **Sidebar label** — "Writing Numbers" or something else? Currently maps to a "Licensing" entry I haven't visually confirmed.
3. **Single PR or feature-flagged?** Single PR is fine for an internal-only tool, but flag adds a one-day safety window.
4. **Should the upline "Team" view show carriers that no agents have entered yet?** (i.e., should an unfilled column appear?) Either is defensible; I'll default to "yes, show all active carriers" for consistency with the personal view, but flag this for confirmation.

---

## Implementation order (if approved)

1. Verify Settings → Profile carrier-contract toggle works for downlines (Risk #2 check).
2. Build new `MyWritingNumbersView` component.
3. Build new `TeamWritingNumbersOverview` component.
4. Refactor `WritingNumbersMatrixView` from existing `WritingNumbersTab`/`WritingNumbersTable`.
5. Rewrite `TheStandardTeamPage` to host the three modes with view-mode state instead of tabs.
6. Delete state-license + classification files.
7. Update `Sidebar.tsx` label.
8. Update `router.tsx` to drop `?tab=` search param.
9. Type-check + `npm run build` clean.
10. Manual smoke: solo agent view, upline view, drill-in, matrix.

Estimated diff: -1,500 lines (net reduction), 5 files deleted, 3 files heavily rewritten.
