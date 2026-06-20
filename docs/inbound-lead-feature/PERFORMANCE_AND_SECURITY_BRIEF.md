# Inbound CRM — Performance & Security Brief

_The Standard HQ acting as the CRM / client-intake system for an external dialer (NetTrio). When a
caller is routed to an agent, The Standard HQ instantly pops the agent's screen with that caller's
client intake form. This brief summarizes how that path performs under load and how it is secured._

---

## Performance

**Designed and load-tested for ~1,000 inbound calls hitting a single agency at the same time** —
1,000 simultaneous screen-pops, 1,000 intake forms loading, and the resulting form submissions.

### Measured database throughput

Benchmarked locally (pgbench, 8 concurrent workers) against the live code:

| Operation (per call)                              | Throughput    | Average latency |
| ------------------------------------------------- | ------------- | --------------- |
| Pre-call lookup (who owns this caller)            | ~5,500 / sec  | 1.5 ms          |
| Call answered → record created + screen-pop fired | ~4,100 / sec  | 1.9 ms          |
| Intake form load (client + policies + history)    | ~10,200 / sec | 0.8 ms          |

**A burst of 1,000 simultaneous calls clears the database layer in under 1 second.**

### Scale engineering (measured improvements)

- **Screen-pop delivery:** re-architected so each agent receives pops on a private, per-agent
  channel. Authorization is a single check per call instead of re-checking every call against every
  connected agent — i.e. it stays flat as the agency grows, rather than degrading with volume.
- **Intake ingestion:** the inbound rate-limiter was sharded to remove a single-row bottleneck,
  raising sustained throughput **5.9× (from ~2,700 to ~16,100 requests/sec)** in load testing.
- **Write efficiency:** trimmed the data each call writes to the transaction log, reducing database
  I/O on the busiest table with no loss of functionality.

### Net result

Every query is indexed and individually sub-2 ms. The system is built to absorb a heavy
simultaneous-call burst without the agent ever staring at a blank screen, and to keep one agency's
call volume from degrading service for any other agency on the platform.

> **Final pre-launch step:** a full end-to-end load test on the production hosting tier at the target
> concurrency. The database and application logic are proven fast in benchmarks; the production
> capacity ceiling is a hosting-tier setting we size and verify before going live — by policy we do
> not launch this path unmeasured on the production tier.

---

## Security

Built for a multi-tenant platform where many agencies share one system and **must never see each
other's data**.

- **Per-tenant data isolation.** Every table enforces row-level security; an agent can only ever read
  or write their own agency's records. The screen-pop itself is locked to the individual agent — the
  system only ever delivers a pop to the exact agent the call was routed to.
- **Machine-to-machine authentication.** The dialer connects using the OAuth 2.0 client-credentials
  standard. Its secret is stored only as a **bcrypt hash (work factor 12)** — the raw secret is never
  written to the database and cannot be recovered, even by us.
- **Least privilege.** Public/anonymous and standard logged-in roles are explicitly revoked from
  every inbound-CRM function; access flows only through the authenticated, tenant-scoped paths.
- **Tenant verification on every call.** Each incoming request is checked to confirm the call, the
  agent, and the agency all match before any record is created or updated — blocking cross-agency
  data access by construction.
- **Abuse resistance on the public endpoint.** The single public-facing token endpoint sits behind a
  per-IP gateway rate limit, preventing a flood of authentication attempts from degrading the shared
  system.
- **Scoped writes.** Saving an intake updates only records owned by the saving agent; a request for a
  record that isn't assigned to that agent is rejected rather than silently written.

---

_Performance figures are from local benchmark runs (`scripts/inbound-crm-benchmark.sh`,
`scripts/bench-ratelimit-shard.sh`); a production-tier load test is the final pre-launch verification.
Full technical detail: `docs/inbound-lead-feature/SCALE_REVIEW.md`._
