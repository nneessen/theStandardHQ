# Continuation — Ship the Add Policy wizard to prod + untangle the working tree

**Date:** 2026-06-20 · **Owner:** Nick · **Status:** plan staged, awaiting 4 decisions before execution

---

## Continuation prompt (paste to resume)

> Resume the Add Policy dialog work per `plans/active/continue-20260620-ship-wizard-and-untangle.md`.
> The 4-step Guided Wizard (Direction A) is built, verified, and pushed on
> `feat/add-policy-dialog-redesign` (tip `e13e1523`). The WRONG version — Direction B (two-pane) —
> is live on prod at `main@9611e44b`. The local working tree mixes 4 unrelated piles. Execute the
> plan IN ORDER: park every pile to its own branch first (lose nothing), then ship the wizard to
> main via a clean cherry-pick. **Do not `git merge` the stale branch** (it's based on pre-merge
> phase3). Confirm the 4 open decisions at the top before touching `main`.

---

## Current state (facts, 2026-06-20)

- **`main` @ `9611e44b`** = Direction **B** (two-pane) — **LIVE on prod**. This is the version the
  owner did NOT want. Sits on top of merged phase3 (PR #24, `9781df68`).
- **`feat/add-policy-dialog-redesign` @ `e13e1523`** (pushed to origin) = the **wizard**.
  History on top of **pre-merge** phase3: `184d1d7a` (B) → `0ccd6a02` (wizard) → `e13e1523`
  (toast/dialog/inbound fixes). ⚠️ Based on pre-merge phase3 → **NEVER `git merge` this into main**.
- Wizard is verified: tsc/eslint/build green, 71 vitest, `scripts/policy-dialog-smoke.py` walks all
  4 steps in light/dark/mobile with 0 console errors; owner did a real create successfully.
- **Uncommitted working tree = 4 piles:**
  1. *(committed already in `e13e1523`)* — my session fixes: inbound-pop guard, PolicyForm
     sold-today-dialog removal, DashboardHome toast, SubmitDateConfirmDialog deletion.
  2. **Insights-band WIP** (Jun-19, sign-off pending): `PolicyList.tsx`, `hooks/usePolicies.ts`,
     `types/client.types.ts`, the insights part of `PolicyDashboard.tsx`, + new
     `components/PolicyInsightsBand.tsx`, `utils/policyInsights.ts`,
     `utils/__tests__/policyInsights.test.ts`, `scripts/policies-noscroll-check.py`.
     ⚠️ `PolicyDashboard.tsx` also carries the **`/policies`-page toast fix** (still uncommitted,
     entangled here).
  3. **Not mine:** `src/features/call-reviews/components/scripts/ScriptDetailPage.tsx` (+20/−3);
     two **deleted** `.docx` (`CRM_Integration_Requirements_2026-06-16.docx`,
     `INTEGRATION_RESPONSE.docx`).
  4. **Untracked:** `docs/inbound-lead-feature/client-info-screenshots-dashboard/*.png` (**PII**),
     `carrier_product_named.csv`, `docs/epic-life/dialer-setup-videos/instructions.md`,
     `plans/active/continue-20260619-*.md`, `plans/active/continue-20260620-crm-oauth-*.md`.

---

## OPEN DECISIONS — answer before executing (only the owner can call these)

1. **Insights band** — still wanted? Default plan: **keep** → commit to its own branch
   `feat/policies-insights-band` off main for independent review/ship (preserves it regardless of
   sign-off). Or: discard.
2. **`ScriptDetailPage.tsx`** (+20/−3, call-reviews) — *not my change*. Yours and keep, discard, or
   investigate first?
3. **The 2 deleted `.docx`** — intentional removal (commit the deletion) or accidental
   (`git restore` them)?
4. **Execute vs review** — next session **executes the prod ship**, or just leaves this plan staged
   for your review first?

**Defaults applied unless you say otherwise:** Theme = **theme-aware** (light+dark; dark matches the
reference — a dark-only dialog would clash with the app's light mode). Ship = **yes, replace B with
the wizard on prod** (the wrong version is currently live).

---

## Execution plan — clean the tree FIRST, then ship

### Phase 0 — Park every pile (lose nothing). Do all of this from a clean `main` checkout.

0.1 **Gitignore the sensitive/scratch files so this can't re-tangle:**
   add to `.gitignore`: `docs/inbound-lead-feature/client-info-screenshots-dashboard/` and
   `carrier_product_named.csv`. (PII screenshots must never enter git history.) Commit `.gitignore`.

0.2 **Insights band → its own branch** (only if kept, decision #1):
   `git checkout main && git checkout -b feat/policies-insights-band`
   Stage ONLY: `PolicyList.tsx`, `hooks/usePolicies.ts`, `types/client.types.ts`,
   `PolicyDashboard.tsx`, `components/PolicyInsightsBand.tsx`, `utils/policyInsights.ts`,
   `utils/__tests__/policyInsights.test.ts`, `scripts/policies-noscroll-check.py`.
   (`PolicyDashboard.tsx` carries the toast hunk here — fine; the ship branch re-applies its own copy
   in step 1.3, so a trivial 2-line conflict may surface when this branch later merges — resolve by
   keeping the guard.) Commit "feat(policies): insights band above table (WIP)"; tsc/build; push.
   **Do not merge to main without owner sign-off.**

0.3 **`ScriptDetailPage.tsx` + the `.docx` deletions** → per decisions #2/#3 (own branch / restore /
   discard). Do not let them ride any other commit.

0.4 **Plans + `docs/epic-life/instructions.md`** → commit to main if wanted (plans belong in
   `plans/active/` per project convention); this plan file is one of them.

   ✅ Gate: after Phase 0, `git status` on `main` is clean (or only deliberately-kept items remain).

### Phase 1 — Ship the wizard to prod (the one irreversible step)

1.1 `git fetch origin && git checkout -b ship/add-policy-wizard origin/main`
1.2 `git cherry-pick 0ccd6a02 e13e1523` — forward-supersede (apply the B→wizard diff on top of B).
   **NEVER** `git merge feat/add-policy-dialog-redesign` (pre-merge phase3 base). Not a revert of
   `9611e44b`.
1.3 **Re-apply the entangled PolicyDashboard toast fix HERE** (2 lines — it lives in the insights
   pile, not in the wizard commits):
   `PolicyDashboard.tsx`: `` `Policy ${result.policyNumber} created successfully!` `` →
   `` `Policy${result.policyNumber ? ` ${result.policyNumber}` : ""} created successfully!` ``
1.4 Theme: if dark-only was chosen (decision), apply; else leave theme-aware (default).
1.5 **Verify on THIS main-based tree** (surrounding code differs from the feature branch):
   `npx tsc --noEmit` → 0 · `npx eslint <changed>` → 0 · `npm run build` → green ·
   `npx vitest run src/features/policies` → green ·
   `set -a; source .env.local; set +a; python3 scripts/policy-dialog-smoke.py` → all 4 steps pass,
   light+dark, 0 console errors.
1.6 Land on main: `git checkout main && git merge --ff-only ship/add-policy-wizard && git push origin main`.
   → Vercel deploys the wizard to prod, replacing B.
1.7 **Post-deploy:** one real create on prod (including a BLANK policy number) → confirm it saves and
   the toast reads "Policy created successfully!" (no "null").

### Phase 2 — `semi_annual` money-math fix (contained; no migration)

Bug: the Select emits the DB-enum form `semi_annual`, but the type + calc switch on `"semi-annual"`,
so semi-annual premiums annualize ×1 instead of ×2. DB enum is already `semi_annual`; edit-mode reads
it back; transformer passes it through — so just align the type + calc:
- `src/types/policy.types.ts`: `PaymentFrequency` `"semi-annual"` → `"semi_annual"`.
- `src/utils/policyCalculations.ts`: `case "semi-annual"` → `case "semi_annual"` in
  `calculateAnnualPremium` AND `calculatePaymentAmount`.
- `src/features/policies/utils/policyFormTransformer.ts`: `case "semi-annual"` → `case "semi_annual"`
  in `calculateMonthlyPremium`.
- `grep -rn "semi-annual" src` to catch every straggler (landing pages, etc. are display-only).
- Add a test: semi-annual premium annualizes ×2 and monthly = annual/6. tsc/build/vitest green.
Can ride the ship branch or be its own tiny PR.

### Phase 3 — Cleanup

- Delete the stale `feat/add-policy-dialog-redesign` (local + `origin`) once the wizard is on main,
  so nobody resumes from the wrong (pre-merge-phase3) base.
- Delete the temporary `ship/add-policy-wizard` branch.

---

## Optional hardening (NOT required for "done")

- **Inbound pop:** the client-side recency guard shipped in `e13e1523` fixes the owner's symptom
  (stale `ringing` rows re-popping the intake). Optional belt-and-suspenders: a server-side TTL that
  auto-transitions abandoned `ringing` calls to `ended`, and/or `dismiss()` persisting an end.
  Only if desired — do not let this balloon scope.

---

## Definition of done

- [ ] Wizard (Direction A) is live on prod; Direction B is gone; a real create works incl. blank #.
- [ ] Working tree clean: insights band on its own branch (or discarded), ScriptDetailPage/.docx
      resolved, PII + scratch CSV gitignored.
- [ ] `semi_annual` annualizes ×2 (or explicitly deferred with a tracked task).
- [ ] Stale `feat/add-policy-dialog-redesign` + temp `ship/*` branches deleted.
