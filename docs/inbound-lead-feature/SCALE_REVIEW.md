# Inbound-CRM — Scale / Performance / Architecture Review

**Scenario evaluated:** ~1,000 inbound calls arriving simultaneously in ONE agency → 1,000 realtime
screen-pops → 1,000 intake forms loading → thousands of form submissions.
**Method:** 6 parallel dimension analysts (realtime fan-out, ingestion writes, intake reads,
submission writes, data model/indexes, capacity) over the real code + architect synthesis, plus a
live DB benchmark (`scripts/inbound-crm-benchmark.sh`). 34 findings (6 critical, 10 high, 9 med, 9 low).

> **STATUS UPDATE (implemented + proven):** the top blockers below are now DONE and verified.
> - **Rate-limit convoy (#1):** sharded the bucket key — load-tested **5.9× throughput** (`scripts/bench-ratelimit-shard.sh`).
> - **REPLICA IDENTITY (#2):** dropped FULL → DEFAULT (migration `20260619134243`).
> - **Broadcast-from-trigger pop (#4):** implemented (migration `20260619134244`), client cut over
>   (`InboundCallContext` → private per-agent broadcast), and `inbound_calls` dropped from the
>   postgres_changes publication (migration `20260619150628`). **End-to-end verified** with the old
>   path removed (`scripts/verify-broadcast-pop.py` PASS; `scripts/test-inbound-scale-fixes.sql` 7/7).
> - Remaining (post-launch de-loading): #3 bcrypt gateway limit (deploy-time), #6/#7 read/write
>   consolidation RPCs, #8 tier sizing. All scoped below.

---

## Verdict

**The design does NOT hold at 1,000 concurrent — but the failure is architecture/fan-out, not query
cost.** Every query is indexed and the data model is fine; the feature topples on **four
single-points-of-serialization**, none of which is Postgres throughput.

### Benchmark evidence (local DB, pgbench, c=8) — the DB layer is fast

| Workload (per call) | TPS | Avg latency |
|---|---|---|
| `crm_lookup_aor` (pre-call lookup, READ) | ~5,500 | 1.5 ms |
| `crm_upsert_call` (on-answer INSERT, fires pop, WRITE) | ~4,100 | 1.9 ms |
| intake read (client+policies+intake, READ) | ~10,200 | 0.8 ms |

A 1,000-call burst drains in **<1s at the DB layer**. The bottlenecks are everywhere *except* the queries.

### What topples, in order

1. **Pre-call GET serializes on ONE `rate_limits` row.** All 1,000 `?ani=` AoR lookups do
   `INSERT … ON CONFLICT … request_count+1` on a single row (bucket key = one credential per agency)
   → row-lock convoy *before the routing lookup runs*. Plus a 2000/hr agency-wide cap trips inside one burst.
2. **postgres_changes pop delivery breaks the feature promise.** Pops ride `postgres_changes` on
   `inbound_calls`. Supabase drains ALL publication changes on **one single-threaded WAL reader**,
   re-evaluating RLS per change per subscriber. ~2,000 changes through one reader → pops arrive
   seconds-to-tens-of-seconds late or drop. Agent answers a ringing line with a blank screen.
   It also **head-of-line-blocks the shared realtime feed** → notifications/chat go stale tenant-wide.
3. **Publicly-floodable bcrypt CPU-DoS.** `crm-oauth-token` runs `verify_jwt=false` (public) and does
   a cost-12 bcrypt **inside the shared Postgres primary** (incl. a decoy hash on unknown client_ids).
   A few dozen concurrent token requests pin the CPU every tenant shares. P0 — independent of dialer behavior.
4. **Shared PostgREST/PgBouncer pool saturates** under the read fan-out (~6 reads/pop × 1,000 ≈ 6,000
   requests in <5s) + the 3-write save path (3,000 writes). Degradation, not collapse.

**Single highest-leverage change:** move the pop off `postgres_changes` onto **Broadcast-from-trigger**
(per-agent private topic). Collapses 6 findings, turns pop authorization from O(changes × subscribers)
into O(1) per call, and restores isolation for the existing notifications/messages realtime.

---

## Go-live blockers (ranked by impact × likelihood / effort)

| # | Change | Severity / Effort | File |
|---|--------|-------------------|------|
| 1 | **Remove / per-IP-gateway-replace the GET rate-limit** (or shard the bucket key + raise cap ~100×). Kills the single-row lock convoy + the agency-wide cap on the AoR path. | CRITICAL / **1 line** | `supabase/functions/crm-leads/index.ts:89-98` |
| 2 | **`ALTER TABLE inbound_calls REPLICA IDENTITY DEFAULT`** — both realtime handlers read only `payload.new`; FULL writes the whole before-image (incl. 4KB notes) to WAL for zero benefit. | HIGH / **1 line** | `…phase0_schema.sql:160` |
| 3 | **Gateway IP rate-limit in front of the bcrypt, shipped in the SAME change as `verify_jwt=false`.** App limiter runs *after* the hash. Optionally cost 12→10. | CRITICAL / small | `crm-oauth-token/index.ts`, `config.toml` |
| 4 | **Broadcast-from-trigger pop (headline).** `AFTER INSERT OR UPDATE` trigger → `realtime.send()` to `inbound:<agent_id>`; client subscribes via `.on('broadcast')`; drop `inbound_calls` from the publication; gate with RLS on `realtime.messages`. | CRITICAL / medium | `InboundCallContext.tsx:41-75` + new trigger migration |
| 5 | **Size the Supabase compute tier + load-test the POST + pop path at 1,000 concurrency on that tier.** The ceiling is config, not in the repo — don't launch unmeasured. | HIGH / config | Supabase tier |

## Post-launch de-loading (do under traffic)

| # | Change | File |
|---|--------|------|
| 6 | **Prefetch carriers + active call-types at shell mount** (long staleTime). IMO-global, byte-identical for all 1,000 agents, yet fetched per browser (~2,000 redundant requests). | `App.tsx`, `InboundCallModal.tsx:50-51` |
| 7 | **`crm_get_intake_bundle(client_id)` RPC** — collapse the 3-read pop fan-out (getWithPolicies = findById + policies, then a *second* `select intake`) into one. **GUARD: SECURITY DEFINER must filter `user_id = auth.uid()`** or it's a cross-tenant read hole. | new RPC + `useInboundCallIntake.ts:14` |
| 8 | **`crm_save_inbound_intake` RPC** — collapse the 3-write save (2 hit the same clients row, no txn → partial-save bug) into one atomic write. **GUARD: keep `AND user_id = auth.uid()` on the clients UPDATE.** | new RPC + `useInboundCallIntake.ts:119-143` |
| 9 | Composite indexes `idx_clients_user_phone(user_id, phone_e164)`, `idx_inbound_calls_client_callstart(client_id, call_start DESC)`; skip advisory lock when phone is NULL; record-query staleTime. | migrations |
| 10 | `crm_lookup_aor` planner pin (hoist `is_access_revoked()` out of per-row WHERE); autovacuum/retention plan for high-churn `inbound_calls`. | `…phase0_rpcs.sql:16-49` |

**Do NOT:** raise client `eventsPerSecond` (non-issue with the per-agent filter); drop `inbound_calls`
from the publication *without* Broadcast in place (kills pop+dismiss); add locking on the save path
(1,000 disjoint rows — no contention there).

---

## Capacity model (burst = 1,000 calls in ~3s)

- **Ingestion:** ~3,000 edge invocations (GET+POST+PATCH), ~4,000 PostgREST txns, mostly in the first seconds.
- **`inbound_calls` writes:** ~3,000 (1k INSERT + 1k 'ended' UPDATE + 1k disposition), each carrying a FULL before-image to WAL today.
- **Pop reads:** ~6,000 PostgREST reads in <5s (>1,200 req/s) on the shared pool → ~2,000 after #6/#7, ~0 carriers/call-types after #6.
- **Realtime:** ~1,000 websocket connections × ~2 subscriptions = ~2,000 always-on; postgres_changes worst-case authorization ≈ changes × subscribers ≈ **~10⁶ RLS evals through one reader**. After Broadcast: ~2 messages/call routed by topic, 1 auth check per subscribe.

**Binding constraints:** one hot `rate_limits` row, one single-threaded WAL reader, one shared
PostgREST pool, one shared Postgres primary for bcrypt — four serialization points, none Postgres throughput.

---

## Benchmark

`scripts/inbound-crm-benchmark.sh` — pgbench-driven, LOCAL-only (hard guard), self-cleaning. Drives
`crm_lookup_aor`, `crm_upsert_call`, and the intake read at configurable concurrency; reports TPS +
latency. Does NOT cover Realtime websocket fan-out (needs a separate WS load test, e.g. k6/artillery
vs the Realtime endpoint — that is finding #2's domain).

```
scripts/inbound-crm-benchmark.sh -c 50 -T 20 -n 2000      # run
scripts/inbound-crm-benchmark.sh --clean                  # remove fixtures
```
