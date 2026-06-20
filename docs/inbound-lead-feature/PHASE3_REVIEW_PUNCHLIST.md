# Phase 3 — Thorough Review Punch-List

Adversarial review of the un-reviewed/high-risk Phase 3 surface (broadcast pop cutover, disposition/
intake RPCs, realtime provider). 5 angles → 14 verified findings (13 confirmed, 1 plausible). Status
below reflects what's **fixed + proven** vs **deferred (needs a product decision)** vs **accepted/minor**.

## ✅ Fixed + proven (this pass)

| # | Sev | Finding | Fix | Proof |
|---|-----|---------|-----|-------|
| 1 | HIGH | Late agent-resolve on a still-ringing call never popped (trigger fired only on INSERT; ON CONFLICT fills agent on a later UPDATE) | Trigger now opens the pop on `INSERT(fired_pop)` **OR** an UPDATE that first resolves the agent on a ringing row (mig `20260619165354`) | `test-inbound-scale-fixes.sql` T8/T9 PASS |
| 5,6,7 | HIGH/MED | Broadcast is fire-and-forget — a pop fired during page-load / reconnect / the auth-subscribe gap is lost forever (no replay, no backfill) | **Rehydration on (re)subscribe**: `InboundCallContext` queries the agent's currently-ringing call on SUBSCRIBED and pops it if none shown | `verify-rehydrate.py` PASS (pop fired *before* subscribe still appears) |
| 2 | HIGH | Zero-row RPC return treated as success — a no-match save showed a green "saved" toast but persisted nothing | Both save hooks now check the RPC's returned id; NULL (no row matched) throws a clear error | typecheck/build; RPC contract (`RETURN QUERY SELECT v_id`) |

## ⏳ Deferred — needs your product decision (the "#3/#4" round)

| # | Sev | Finding | Decision needed |
|---|-----|---------|-----------------|
| 3 | HIGH | Caller hangs up mid-intake → the `ended` broadcast auto-dismisses the modal and **wipes unsaved work** | Warn before dismiss? Keep the modal open (just mark "call ended")? Auto-save draft? |
| 4 | HIGH | A second call to the same agent **overwrites** the first call's open intake (single `activeCall`) | Block/queue the 2nd pop while one is open? Warn? A small "incoming" indicator instead of replacing? |

## 🟡 Accepted / lower-priority (scoped, not blocking)

| # | Sev | Finding | Note |
|---|-----|---------|------|
| 8,11 | MED | 3-write save is non-transactional → partial commit on failure | Fixed by the scale review's consolidation RPC (`crm_save_inbound_intake`) — post-launch |
| 10 | MED | "New caller" pop with null `client_id` discards typed intake | Needs find-or-create-client on save (part of the consolidation RPC) |
| 9 | MED | Full-blob intake REPLACE drops concurrent/out-of-band edits | Latent until a 2nd writer to `clients.intake`; the migration's documented trade-off |
| 12 | LOW | `realtime.send` lengthens the advisory-lock hold on same-phone bursts | Minor; revisit only if same-household burst contention shows up |
| 13 | LOW | A missed `ended` broadcast never auto-clears a phantom pop | Largely mitigated by rehydration (only returns *ringing* calls); a stuck-pop reaper is the full fix |
| 14 | LOW | Super-admin *acting-as* can't write disposition (no-op) — now surfaced as an error by the #2 fix | Edge case; acceptable |

## Go-live readiness

The HIGH correctness/reliability bugs in the pop + save path are fixed and proven. The two remaining
HIGH items (#3, #4) are **UX behavior decisions**, not bugs in the wiring — they should be settled
before a high-volume partner go-live, but they don't block a demo. The MEDIUMs fold into the
post-launch consolidation RPC already scoped in `SCALE_REVIEW.md`.
