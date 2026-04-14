# RPC Removal Campaign — STATUS: PARTIAL

**Original plan date:** 2026-02-14
**Last executed:** 2026-02-27 (Batch 00 only)
**Archived:** 2026-04-14

## Summary

The Feb 14 plan targeted removal of **77 functions across 8 batches**. Only **Batch 00 (12 functions)** was executed, in migration `supabase/migrations/20260227155357_drop_dead_functions.sql` (commit `4c190118` — "chore(db): drop 12 verified dead functions").

The remaining **65 functions (Batches 01–07)** were never processed. The campaign lost momentum after the first batch and was not resumed.

## If resuming

These plan files are **2+ months stale** as of archival:
- Re-run the preflight SQL in `rpc-removal-staged-plan-2026-02-14.md` against the live DB — some functions may have been added/removed/refactored since Feb 14.
- Cross-reference current client/edge-function/RLS usage before dropping.
- Do not trust the `rpc-trace-2026-02-14.tsv` snapshot — call-site inventory has drifted.

## Functions already dropped (Batch 00, verified)

See migration `20260227155357_drop_dead_functions.sql` for the canonical list.

## Why archived rather than deleted

Preserves the preflight SQL template, batch-sequencing rationale, and guardrails (24–48h soak) in case the work is resumed. Not historical — it's a half-finished plan.
