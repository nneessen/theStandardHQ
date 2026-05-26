# Continuation — Epic Life FULL tenant-isolation sweep (every domain)

**Generated:** 2026-05-23. **Branch:** main. Read this BEFORE coding; prior work is live.

## Why this exists
Nick (logged in as `epiclife.neessen@gmail.com`) saw FFG recruiting pipelines while in Epic Life. Investigation proved that specific case was NOT an RLS leak — it was global-super-admin **see-all** behavior. **That account has since been demoted to an Epic-scoped admin** (`is_super_admin=false`, `roles={admin,agent}`, imo=Epic `89514211-f2bd-4440-9527-90a472c5e622`). After Nick re-logs-in he IS a normal Epic user, so his own session is now the correct isolation test bed.

Nick's requirement, verbatim and absolute: **a user created/assigned under Epic Life must see NOTHING from FFG — pipelines, carriers, products, users, emails, messaging, slack, leaderboards, lead vendors, training, commissions, policies — nothing, period.** Epic Life gets its own everything.

## The systemic antipattern to hunt (this is the real target)
`pipeline_templates` RLS uses `(imo_id = get_my_imo_id() OR imo_id IS NULL)`. The **`imo_id IS NULL`** branch makes any row with a null IMO a "global" row visible to EVERY tenant — a cross-IMO leak for even a normal user IF such rows exist. (pipeline_templates happened to have 0 null-imo rows, so it was clean, but the PATTERN is everywhere.) Likewise watch for `super_admin_in_scope(imo_id)` policies (fine — only affect super-admins) vs. genuinely missing imo gates.

**For every tenant table, classify it:**
1. Tenant-private (policies, recruits, leads, messages, slack creds, user_profiles, pipeline_templates, recruiting_* …): RLS MUST be `imo_id = get_my_imo_id()` (+ `super_admin_in_scope` for super-admins). A `imo_id IS NULL` escape hatch here = LEAK if any null-imo rows exist → either backfill imo_id or drop the null branch.
2. Intentionally-global reference data (carriers, products may be a shared catalog): **ASK NICK per-domain** whether Epic should get its own or share. Don't assume — he said "nothing," but a shared carrier catalog may be deliberate. Surface each global-visible domain as a decision.

## Methodology (run as read-only against remote prod first)
1. **Enumerate every table with `imo_id`** and its RLS policies; flag any SELECT policy whose `qual` contains `imo_id IS NULL` OR lacks `get_my_imo_id()/get_effective_imo_id()/row_in_acting_scope/super_admin_in_scope`:
   ```sql
   SELECT tablename, policyname, qual FROM pg_policies
   WHERE schemaname='public' AND cmd IN ('SELECT','ALL')
     AND (qual ~ 'imo_id IS NULL'
          OR qual !~ '(get_my_imo_id|get_effective_imo_id|row_in_acting_scope|super_admin_in_scope)')
   ORDER BY tablename;
   ```
   For each hit: does the table actually hold null-imo rows? `SELECT imo_id, count(*) FROM <t> GROUP BY imo_id;` — null rows are the leak.
2. **Tables with NO imo_id but tenant data** (e.g. pipeline_phases, commissions via policy, clients): verify they're gated through a parent FK that IS imo-scoped. Trace the join.
3. **SECURITY DEFINER functions** still to finish from the earlier audit — see sibling handoff `continue-20260523_2010-tierB-isolation.md` (Tier B + cron-helper triage, NOT yet done). That covers get_org_chart_data agent scope, getuser_commission_profile, get_downline_with_emails, etc.
4. **Per-domain spot check as a NORMAL Epic user** (use Nick's now-demoted session, or create a throwaway Epic user). For each domain page, confirm zero FFG rows.

## Domain checklist (verify each, as a normal Epic user)
- [ ] Recruiting: pipeline_templates ✅(clean), pipeline_phases, pipeline_automations, recruits/leads (recruiting_leads, recruiting_progress), recruiter slugs
- [ ] Carriers & products (DECISION: shared catalog vs Epic-owned — ASK NICK)
- [ ] Users / team / hierarchy / org chart (org-chart agent scope still ungated — Tier B)
- [ ] Email templates, messages, threads, contacts
- [ ] Slack integrations + credentials (creds already locked to service_role ✅; check agency_slack_integrations visibility)
- [ ] Leaderboards (get_*_leaderboard_* — several gated already; re-verify imo scope)
- [ ] Lead vendors / lead packs / lead purchases
- [ ] Training modules, lessons, quizzes, progress, leaderboard
- [ ] Underwriting guides / rule sets / wizard
- [ ] Commissions, overrides, policies, clients, expenses, targets
- [ ] Landing/recruiting page settings, custom domains (public side already hardened ✅)

## Known-clean / already-shipped (don't redo)
- Public discovery surfaces hardened (`20260523192047`).
- Slack creds revoked to service_role (`20260523195335`).
- Tier A imo/agency getters gated/revoked (`20260523195642`).
- pipeline_templates RLS verified clean (0 null-imo rows; all FFG-owned).
- epiclife.neessen demoted to Epic-scoped admin (data update on prod).

## Output
Produce a per-table verdict table (private/global, gated?, null-imo rows?, action), apply fixes as migrations (local+remote via runner, commit to main), and a behavioral confirmation as a normal Epic user. For each "intentionally global" domain, get Nick's explicit yes/no before changing.

## Critical reminders
- Test isolation as a NORMAL Epic user, NEVER as a super-admin (super-admins see-all by design).
- Some `imo_id IS NULL` rows are legit-global (system seed data) — backfilling/Epic-cloning may be needed instead of just dropping the null branch. Decide per table.
- Migrations: apply to BOTH local + remote (`run-migration.sh`), regen types if signatures change, `npm run build`, push to main (prod deploys from main).
- Watch for RLS-helper functions before revoking anything (get_downline_ids is in user_profiles RLS — revoking caused an outage risk earlier).
