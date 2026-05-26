# Plan — Duplicate FFG book of business → Epic Life (Minyo, Engel, Strohm, Neessen)

**Created:** 2026-05-24
**Target DB:** REMOTE only (these are production users; local has no copy)
**Mode chosen by Nick:** DUPLICATE (agents active under BOTH IMOs) · EXCLUDE override_commissions
**Critical safety requirement:** no Slack notifications, sync webhooks, or workflow fanout during the backfill

## Agent identity map (matched by first/last name / explicit email for Nick)

| Agent | FFG source `user_id` | Epic target `user_id` |
|---|---|---|
| Andrew Engel | `88791683-be7d-4ea7-8b62-b0d9cf905a85` | `453c718c-186f-49ee-af57-53dc6ef90409` |
| James Minyo | `1ad4d5a8-369c-4bb8-871b-966683db350a` | `bd6a0cd1-18b9-4b26-a61a-498c44e75dac` |
| Nick Neessen | `d0d3edea-af6d-4990-80b8-1765ba829896` | `69559ef2-9350-44d3-81a1-5f59a2e6b42d` |
| Kelby Strohm | `4936e301-33e7-4816-95c4-6d8838bad5b4` | `97d0dd80-314b-416f-9db2-9de57ac96b7f` |

- FFG IMO: `ffffffff-ffff-ffff-ffff-ffffffffffff`
- Epic Life IMO: `89514211-f2bd-4440-9527-90a472c5e622`

## Scope (source counts, FFG)

| Entity | Count | Action |
|---|---|---|
| policies | 121 | duplicate, remap all FKs |
| commissions (agents' own) | 130 | duplicate, remap user/imo/policy + related_advance (2-pass) |
| clients | 114 distinct | duplicate, remap user_id → Epic agent |
| bot_policy_attributions | 42 | duplicate, remap policy_id + user_id |
| carriers | 12 distinct | create in Epic (none exist there), build map |
| products | 27 distinct | create in Epic, remap carrier_id |
| override_commissions | 150 | **EXCLUDED** — Kerry Glass (111) + Nick Neessen (39) |
| recommendation_outcomes | 0 | nothing to copy |
| agencies | 2 distinct | currently plan to null `agency_id` in Epic copies |
| policies with lead_purchase_id | 72 | null `lead_purchase_id` in Epic copies |

## FK remap rules (per duplicated row)

- `imo_id` → Epic (`89514211…`)
- `user_id` / `base_agent_id` → Epic agent (via agent map; FFG→Epic)
- `carrier_id` → new Epic carrier (carrier map; NOT NULL — always remapped)
- `product_id` → new Epic product (product map; nullable)
- `client_id` → new Epic client (client map; nullable, but present on all 70)
- `agency_id` → **NULL** (FFG agencies; Epic agency structure not in scope; column nullable)
- `lead_purchase_id` → **NULL** (FFG billing artifact; 29 policies)
- `commissions.related_advance_id` → **2-pass**: insert NULL, then UPDATE from commission map
- enum columns (`product`, `payment_frequency`, `lead_source_type`) → copy as-is (global enums)
- `policy_number` → copy as-is (unique index is `(policy_number, user_id)`; new user_id avoids collision)
- new PKs → `gen_random_uuid()`

## Schema facts confirmed

- `clients` has NO `imo_id` (scoped by `user_id` only) → no tenant column to set.
- `policies` unique index: `(policy_number, user_id) WHERE policy_number IS NOT NULL`.
- `policies.client_id`, `product_id`, `agency_id`, `user_id` all nullable; `carrier_id` NOT NULL.
- None of the source carriers exist in Epic by name → create all, no match-or-create.

## Live trigger / side-effect facts (REMOTE DB, 2026-05-24)

These are live production definitions, not just migration history:

- `public.policies` inserts currently fire:
  - `trigger_notify_slack_on_policy_insert` → `notify_slack_on_policy_insert()` → `net.http_post(...)` to Slack edge function
  - `policies_sync_webhook` → `notify_policy_webhook()` → `net.http_post(...)` to `sync-policy`
  - `trigger_workflow_on_policy_created` → `on_policy_created()` → inserts `workflow_runs`
  - `create_override_commissions_trigger` and `trigger_create_override_commissions_on_active` → `create_override_commissions()`
- `public.clients` inserts currently fire:
  - `clients_sync_webhook` → `notify_client_webhook()` → `net.http_post(...)` to `sync-client`
- `public.commissions` inserts/updates currently fire:
  - `trigger_workflow_on_commission_received` → `on_commission_received()` → inserts `workflow_runs`

Implication: a normal INSERT-based backfill is not safe, even for a dry-run, because external HTTP calls and workflow rows can be created during the transaction.

## Recommended execution shape

Use a two-step production-safe approach:

1. Deploy a narrow trigger-function guard migration that no-ops **only when** a session-local backfill flag is set.
2. Run the duplication script in a transaction that sets that flag, performs the copy, verifies counts, and commits.

Proposed session flag:

```sql
SELECT set_config('app.book_duplication_mode', 'on', true);
```

Functions that should early-return when `current_setting('app.book_duplication_mode', true) = 'on'`:

- `notify_slack_on_policy_insert()`
- `notify_policy_webhook()`
- `notify_client_webhook()`
- `on_policy_created()`
- `on_commission_received()`
- `create_override_commissions()`

Why this shape:

- Prevents any Slack post into the Self Made channel.
- Prevents policy/client sync webhooks from pushing duplicated data into downstream systems.
- Prevents workflow-run creation for synthetic backfill inserts.
- Prevents override rows from being auto-created while keeping the normal FK/consistency triggers active.
- Keeps suppression tightly scoped to one transaction instead of broadly disabling triggers for the whole table.

## Audit / idempotency / rollback design

Sidecar map table (created `IF NOT EXISTS` at top of script):

```sql
CREATE TABLE IF NOT EXISTS public.epic_book_dup_map (
  entity_type    text    NOT NULL,           -- carrier|product|client|policy|commission|bot_attribution
  source_id      uuid    NOT NULL,
  new_id         uuid    NOT NULL,
  source_imo_id  uuid,
  target_imo_id  uuid,
  batch_label    text    NOT NULL DEFAULT 'ffg_to_epic_2026_05',
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, source_id)
);
```

- **Idempotency:** each entity step only inserts source rows `WHERE NOT EXISTS (… in map)`; map PK prevents double-map. Re-running is a no-op.
- **Remap pattern (per entity):** a CTE selects `source_id` + `gen_random_uuid() AS new_id` + columns; one branch INSERTs into the target using `new_id`, another INSERTs the `(source_id,new_id)` pair into the map. Subsequent entities JOIN the map for FK remap. (gen_random_uuid materialized once per CTE row → stable across both inserts.)
- **Rollback:** delete in reverse FK order WHERE id IN (SELECT new_id FROM epic_book_dup_map WHERE entity_type=… AND batch_label=…), then delete the map rows. Reversible because nothing else references the new Epic rows yet.

## Execution order (FK-safe)

1. `CREATE TABLE IF NOT EXISTS epic_book_dup_map`
2. carriers → map
3. products (remap carrier_id) → map
4. clients (remap user_id) → map
5. policies (remap user/imo/carrier/product/client; null agency/lead_purchase) → map
6. commissions (remap user/imo/policy; related_advance_id = NULL) → map
7. UPDATE commissions SET related_advance_id = map(old related_advance_id)
8. bot_policy_attributions (remap policy_id/user_id) → map

## Verification (before COMMIT — run as BEGIN…ROLLBACK dry-run first)

- Per-entity: `count(new rows) == count(source rows)` (carriers 12, products 27, clients 114, policies 121, commissions 130, bot 42).
- No Epic policy with `carrier_id`/`product_id`/`client_id` pointing at an FFG-owned row (all FKs resolve within Epic / agent-owned).
- `override_commissions` for Epic agents = 0 (confirms exclusion).
- No `workflow_runs` created by the backfill batch.
- No `net.http_request_queue` rows created by the backfill batch for Slack or sync webhooks.
- Spot-check each Epic profile sees the same policy count as its FFG counterpart.
- RLS smoke: query policies as each Epic user_id context resolves carrier/product/client names (no nulls from broken joins).

## Open item to confirm with Nick before COMMIT

- `agency_id` nulled in Epic copies — acceptable, or should Epic agencies be created/mapped?
- Duplicating 114 client PII records into a second tenant is intentional (DUPLICATE mode).
