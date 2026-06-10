# Contracting Hub (2026-06-10)

A Business-section hub where every approved (non-recruit) agent tracks **carrier
contracting** (submitted / approved / denied) and **writing numbers** — for
themselves and their downline — gets alerted when an upline's approval makes them
newly eligible for a carrier, and can request to contract under a **different
upline** (an *alternate sponsor*) when their normal upline is blocked.

Status: **shipped to production 2026-06-10** (6 migrations applied to prod;
frontend on `main` → Vercel).

## Owner decisions (locked)

1. **Override attribution** — when an agent contracts under an alternate sponsor
   for a carrier, the commission **override on that carrier's business rolls up
   the alternate sponsor's leg** (not the normal upline).
2. **Audience** — visible to **all approved agents**. Downline management only
   renders if the user actually has a downline.
3. **Eligibility alerts** — fire to **direct reports only** (mirrors the existing
   `check_upline_carrier_contract` rule: a downline is eligible for a carrier
   only once their *direct* upline holds an `approved` `carrier_contracts` row).

## Data model

- **Spine = `carrier_contracts`** (agent-centric). Statuses standardized to
  `{pending, submitted, approved, denied, terminated}` (no CHECK constraint —
  enforced in TS). No `imo_id` column; IMO scope comes via join to
  `user_profiles.imo_id`. UNIQUE `(agent_id, carrier_id)`.
- **`carrier_sponsorship_requests`** (new) — the alternate-sponsor flow. Snapshots
  `requesting_agent_id`, `carrier_id`, `normal_upline_id`, `alternate_sponsor_id`,
  `alternate_sponsor_upline_id`, two approval triples (sponsor + sponsor-upline),
  `overall_status` (`pending_sponsor → pending_sponsor_upline → approved | denied |
  cancelled`), `reason`, **`override_recipient_id`** (= alternate sponsor, set on
  final approval), `imo_id`. Partial unique on the in-flight states. RLS:
  SELECT = requester / alternate sponsor / sponsor-upline / same-IMO admin; writes
  via RPC only; `revocation_deny` RESTRICTIVE; helpers InitPlan-wrapped.

## Migrations (all on prod)

| Version | Purpose |
|---|---|
| `20260609203445` | `set_carrier_contract_status(agent, carrier, status, writing#)` RPC — upline/staff/super-admin for approved/denied/terminated; eligibility-gated agent-self for submitted/pending |
| `20260609203545` | AFTER trigger `notify_downline_carrier_eligible` (fires only on transition into `approved`, notifies **direct** reports) + `get_newly_eligible_carriers()` self-heal RPC |
| `20260609203645` | `carrier_sponsorship_requests` table + `create/approve/cancel_sponsorship_request` RPCs (two-approval flow; on final approval sets `override_recipient_id` + upserts requester's pending `carrier_contracts` row + notifies) |
| `20260609203845` | Alternate-sponsor override attribution in `create_override_commissions()` + `regenerate_override_commissions()` — **⚠ contained a regression, see below** |
| `20260609211703` | SECURITY DEFINER read RPCs: `get_my_downline_contracts`, `get_eligible_sponsors`, `get_my_sponsorship_inbox`, `get_my_sponsorships` (needed because `carrier_contracts` RLS is own-row + staff only) |
| `20260610072218` | **Corrective** — re-hardens the override calculators (see below) |

## Override attribution — prospective-only money rule

Both override calculators seed their upline-chain CTE with the normal upline by
default. When an **approved** `carrier_sponsorship_requests` row exists for
`(policy.user_id, policy.carrier_id)` with `override_recipient_id IS NOT NULL`
**AND** `approved_at::date <= policy.effective_date`, the seed becomes the
alternate sponsor and the chain walks up the sponsor's hierarchy instead. The
date gate lives **in the WHERE clause** (with `ORDER BY approved_at DESC LIMIT 1`)
so that with multiple approved sponsorships the one *in effect for that policy's
date* is chosen — it never silently falls back to the normal upline.

**Prospective-only invariant:** a sponsorship affects only business written
on/after approval. Re-running regeneration on an older policy can never move
already-computed override money to the alternate sponsor.

## ⚠ Code-review lesson: function-version content regression

Migration `20260609203845` re-defined `create_override_commissions()` and
`regenerate_override_commissions()` by branching from **pre-hardening** copies of
those functions, silently reverting shipped security guards:

- `regenerate` lost `PERFORM assert_in_acting_scope(v_policy.imo_id)` (cross-IMO
  write protection, from `20260531162205`) and `SET search_path TO 'public'`.
- `create` lost `IF is_book_duplication_mode() THEN RETURN NEW` (phantom-override
  suppression during book clone, from `20260524153637`), the in-body
  `lifecycle_status != 'active'` guard, and `SET search_path`.

The migration runner's downgrade-block **cannot catch this**: the
`function_versions` number rose (`…203845`) while the body regressed. Corrective
migration `20260610072218` restores the hardened bodies verbatim (branched from
the *current shipped* definitions) and re-applies only the alternate-sponsor seed.

**Rule:** when a migration re-defines an existing function, always branch from its
**current shipped body** — find it with
`grep -rln 'FUNCTION <name>' supabase/migrations | grep -v archive | tail` — never
from an older copy. The version number going up is not evidence the body is newer.

On prod the corrective was applied immediately after the regressed migration, so
the unhardened functions existed for ~1s with no traffic; final state verified
hardened (search_path + acting_scope/bookdup guards + alt-sponsor seed all present).

## Frontend (`src/features/contracting/`)

Concept C in the dark "departure-board" theme:

- **Always-on Action Center** rail — two boxes: *Newly Eligible* (carriers an
  upline just opened up; "Start request" self-submits) | *Approvals Needed*
  (sponsorship steps the user owes, with Approve/Deny).
- **My Contracting** tab — board card: status chipstrip + per-carrier table
  (Carrier · Status · Writing # · Submitted · Approved) + "Request different
  upline"; denied rows offer "Try alt upline".
- **My Downline** tab — side-by-side `340px` roster + agent detail (inline status
  `<Select>` + writing-number edit, `is_upline_of`-authorized).
- Shared `Pager` (client-side, page 25, auto-hides under one page) on the roster
  and own-carrier table. Notification deep-links resolve via the route
  `validateSearch` (legacy `?tab=approvals` → `mine`; the Approvals box is in the
  always-on Action Center, visible on both tabs).
- Nav: `public: true` + route guard `noRecruits` (the `agent` role is a system
  role and can't be granted a nav permission; `prevent_system_role_permission_changes`
  blocks it).

## Verification

- SQL smoke `scripts/smoke-contracting-sql.sql` (transactional): eligibility
  alert direct-only, self-submit gating, two-approval, and the money path
  (sponsored → alt-sponsor leg, pre-approval → normal upline, multi-sponsorship →
  in-effect sponsor) — all pass against the corrected functions.
- Render smoke `scripts/smoke-contracting.py` and functional click-through
  `scripts/smoke-contracting-interactive.py` (buttons fire + DB-persist), run as a
  throwaway `@epiclife-demo.test` manager.
- `tsc` / `eslint` / `npm run build` green; types regenerated from prod.
