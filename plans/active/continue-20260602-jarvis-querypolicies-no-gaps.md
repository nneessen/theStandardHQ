# CONTINUATION — Jarvis: close the "no data gaps" demand (`queryPolicies` tool) + roadmap

**Created:** 2026-06-02 · **Branch:** `main` · **Surface:** `/command-center` (Jarvis AI assistant)
**Prev session:** db1ad84a-9118-4ae7-a296-f62873fa2ee7
**Memory:** `project_jarvis_phase1_perf_databugs.md` (+ MEMORY.md index line)

---

## TL;DR — start here

> **UPDATE 2026-06-02 — `queryPolicies` is now SHIPPED.** Built per §2, committed `477d82d0`,
> pushed to main, DEPLOYED to prod `pcyaqwodnyrpkaiojnpz` (warm-ping `{ok,warm}` 200). Deno
> suite 90/0 green; tenant-isolation PROVEN on prod via the new
> `scripts/test-queryPolicies-tenancy.sh` (stranger sees 0/1996; regular agent 0/121 other-IMO).
> Routing fix added (`polic(y|ies)`→production-analyst — the user's "pending policies" example
> was falling to executive-briefing). **ONLY OPEN ITEM:** the §3.4 live typed-text smoke needs
> a USER prod JWT (I have none) — user must type "find my pending policies in the last two
> weeks" at `/command-center` and confirm it calls queryPolicies (status pending, 14-day range,
> scope mine — NOT MTD). Then the build phase is fully closed and Phases 2–5 (§5) are next.
> Memory: `project_jarvis_querypolicies.md`.

Phase 1 (speed + 2 data-scoping bugs) and all the voice fixes are **SHIPPED, committed, pushed,
and deployed to prod**. The **one in-flight task** is the user's repeated, emphatic demand:

> "we have all the data: policies, application statuses, policy statuses, multiple columns in that
> table. We should be able to access anything from those tables regarding that specific agent and/or
> that agent's team. There should not be any gaps when it comes to pulling data from the database."

The answer is a new **flexible `queryPolicies` Jarvis tool** — design fully advisor-validated last
session, **not yet built** (confirmed: `tools/queryPolicies.ts` does not exist). Build it per
**Section 2** below, verify per **Section 3**, ship per **Section 4**. Do NOT start with a workflow
for the doc; this file IS the handoff.

**Set honest expectations with the user up front:** a comprehensive *structured* query over the
policies table closes the real gaps **safely**. Truly arbitrary cross-table text-to-SQL is a
**deliberate NO** for a money/multi-tenant system (RLS-bypass + injection + PII-leak risk). The plan
gives them "anything from the policies table for me or my team" without that risk.

---

## 0. CRITICAL footguns (read before touching anything)

1. **Migrations: NEVER psql.** Always `./scripts/migrations/run-migration.sh FILE`. The runner
   **DEFAULTS TO LOCAL** — for prod you MUST prefix `DATABASE_URL="$REMOTE_DATABASE_URL"`. (I once
   applied to local and misreported "prod.") For ad-hoc SQL: `./scripts/migrations/run-sql.sh "..."`,
   same `DATABASE_URL=` prefix rule for prod. **`queryPolicies` as designed needs NO migration** (it
   runs PostgREST directly on the user-scoped client), so this only matters if you add an RPC.

2. **A background process autocommits foreign files.** Right now `git` is **ahead of origin/main by 5
   commits — all foreign `board`/Team-Analytics autocommits, NOT Jarvis work** (last real Jarvis
   commit is `a17bce18`, already pushed). When you commit Jarvis changes:
   - `git add` **explicit paths only** (never `git add -A`/`.`).
   - `git commit --no-verify` (the pre-commit lint-staged hook + the background autocommit have
     swept foreign `src/features/hierarchy/components/analytics/Team*.tsx` into a commit before).
   - **After committing, ALWAYS run `git diff-tree --no-commit-id --name-only -r HEAD`** and confirm
     ONLY your files are in it.
   - When you `git push`, you'll also push those 5 foreign board commits (they're already ahead).
     That's the user's own background process's work — it's fine to carry them up, just don't
     *attribute* them to Jarvis. If unsure, ask before pushing.

3. **`database.types.ts` is ~162k tokens — NEVER read whole** (PreToolUse hook blocks it). Use
   `node scripts/dbtype.mjs <name>` / `--list`. Regenerating from the prod CLI reorders the whole
   file (33k-line churn) — if a type is needed, hand-add it surgically. `queryPolicies` needs **no
   type regen** (orchestrator uses the loose `ToolDbClient`, nothing app-side compiles against it).

4. **Prod health-check gotcha:** `.env` `VITE_SUPABASE_ANON_KEY`/URL point to **LOCAL**
   (127.0.0.1:54321). A warm-ping with that key validates LOCAL, not prod. For a real prod boot check
   fetch the prod anon key: `npx supabase projects api-keys --project-ref pcyaqwodnyrpkaiojnpz
   --output json`.

5. **Tenant isolation is the crown-jewel invariant** (money + team data). `queryPolicies` MUST run on
   `ctx.db` (the user-scoped, RLS-enforced client) and **NEVER** `adminClient` / a `SECURITY DEFINER`
   RPC. Put that as a header-comment invariant in the file. Never select PII columns into LLM context
   (see allowlist in §2).

6. **Edge deploy:** `assistant-orchestrator` is authed-only and already jwt-verified — deploy with a
   **plain** `supabase functions deploy assistant-orchestrator` (NO `--no-verify-jwt`; that flag is
   only for public webhooks). Then prod warm-ping with the **prod** anon key.

---

## 1. STATE OF THE WORLD — what's already done (do not redo)

### Phase 1 — SHIPPED (commit `97e14209`, pushed; migration `20260601191455` on PROD; orchestrator deployed)
- **Perf:** parallelized 5 pre-Anthropic fetches (`Promise.all`, gates still ordered before any
  spend); parallelized tool execution within a model turn (side-effects re-ordered after);
  per-agent `model?`/`maxTokens?` on `AgentConfig` (haiku `claude-haiku-4-5-20251001` for the 5
  draft-only agents, sonnet for data agents); dynamic `import()` of the underwriting engine;
  `cache_control` breakpoint on last history message; voice silence-hold 1100→800ms (configurable)
  + per-turn JWT cache.
- **Bug A** ("can't pull my own production"): new `tools/getMyProduction.ts` →
  `get_command_center_summary(p_scope:'personal')`. Wired into production-analyst + executive-briefing.
- **Bug B** ("my team leaks other teams"): `getTeamProductionSummary` + `getDailyBriefingData` team
  section repointed to `get_command_center_summary(p_scope:'team')`; new SECDEF RPC
  `get_my_team_leaderboard` (mig `20260601191455`) + `tools/getTeamLeaderboard.ts`, wired into
  production-analyst + coaching. Tenant-isolation impersonation smoke PASSED on the cross-IMO edge.

### Voice fixes — SHIPPED
- `fbc817cf` — AudioContext `resume()` when suspended (fixed "stuck at listening"; voice never
  detected speech-START). Frontend; ships via Vercel.
- `0a1f88fe` — orchestrator injects **current date** (`Intl.DateTimeFormat`, `ASSISTANT_TIMEZONE`
  default America/New_York) into the system prompt + a hard "resolve relative dates from this, pass
  explicit YYYY-MM-DD" rule. Fixed "yesterday → July 13" hallucination. Deployed.
- `a17bce18` — TTS intelligibility: `optimize_streaming_latency` 3→**2** (at 3 ElevenLabs' text
  normalizer is OFF → digit-by-digit numbers + garble); `spoken-text.ts` keeps commas + groups bare
  4+ digit ints via `toLocaleString` (years 1900–2099 left alone); `ELEVENLABS_SPEED` 1.1→**1.15**;
  added BASE rules to HONOR THE EXACT SPAN (don't substitute MTD for "last two weeks") and not to
  relabel metrics tools don't expose. Deployed.

### Still UNVERIFIED by the user (ask them to confirm next time they test):
- Live typed-text E2E at `/command-center`: Bug A ("my production" → real numbers, not
  `no_team_data`), Bug B ("how is my team"/"who is leading" → caller-scoped only), reconciliation
  (sum(leaderboard IP) == team aggregate IP for a ≤25-member team; anchor ~$40,252 MTD AP).
- Voice by ear: gibberish gone? numbers spoken as cardinals? pace OK? "last two weeks" honored?

---

## 2. THE TASK — build `queryPolicies` (advisor-validated design)

**Goal:** one read tool that lets Jarvis answer *any* structured question over the `policies` table,
for the caller (`scope:'mine'`) or their team (`scope:'team'`, RLS handles the subtree), across the
real status vocabularies and date fields — with an **exact count**, an **AP/IP sum**, and a capped
list of **safe** columns. This is the "no gaps" answer.

### 2.0 Verified facts (from last session, prod)
- **`policies` columns:** agency_id, annual_premium, cancellation_date, cancellation_reason,
  carrier_id, client_id, commission_percentage, created_at, effective_date, expiration_date, id,
  imo_id, lead_purchase_id, lead_source_type, lifecycle_status, monthly_premium, notes,
  payment_frequency, policy_number, product, product_id, referral_source, status, submit_date,
  term_length, updated_at, user_id.
- **`status` vocabulary (prod):** approved (1478), pending (305), withdrawn (114), denied (99).
- **`lifecycle_status` vocabulary (prod):** active (1427), null (516), cancelled (40), lapsed (13).
- **RLS on `policies` already scopes correctly** — own (`user_id = auth.uid()` ∩ imo), downline
  (`is_upline_of(user_id)` ∩ imo, which matches the **full hierarchy_path subtree**, so "team" here
  reconciles with the leaderboard/command-center "team"), revocation_deny, super/imo-admin policies.
  **This is why no RPC is needed** — PostgREST on the user-scoped client inherits all of it.

### 2.1 Extend `ToolDbClient` (`tools/types.ts`)
Current shape only supports `.rpc()` and `.from(t).insert().select().single()`. Add a **thenable
query builder** for SELECT. Keep it esm-free (it's just an interface). Suggested addition:

```ts
/** Chainable, awaitable SELECT builder — structural subset of PostgREST's. */
export interface ToolSelectBuilder
  extends PromiseLike<{ data: unknown; count: number | null; error: unknown }> {
  eq(column: string, value: unknown): ToolSelectBuilder;
  in(column: string, values: readonly unknown[]): ToolSelectBuilder;
  gte(column: string, value: unknown): ToolSelectBuilder;
  lte(column: string, value: unknown): ToolSelectBuilder;
  order(column: string, opts?: { ascending?: boolean }): ToolSelectBuilder;
  limit(count: number): ToolSelectBuilder;
}
```
Then widen `from(table)` to also expose
`select(columns?: string, opts?: { count?: "exact" | "planned" | "estimated" }): ToolSelectBuilder;`
(keep the existing `insert(...)` branch). The real supabase client satisfies this already; you're
only teaching the *type* about it. **Update the test mock** (`tools/__tests__/tools.test.ts`
`makeCtx`) to add a chainable builder that records the calls and returns
`{ data, count, error }` — it currently only supports `rpc()` + `insert().select().single()`.

### 2.2 Create `tools/queryPolicies.ts` (template: `getMyProduction.ts`)
**Header-comment invariant (write it):** "Runs on `ctx.db` — the signed-in user's RLS-scoped client.
NEVER adminClient / SECURITY DEFINER. RLS guarantees own (∩imo) + downline-subtree (∩imo). Selects a
SAFE column allowlist only — never notes/cancellation_reason/referral_source/client_id (PII)."

**Params (inputSchema):**
- `scope`: `"mine" | "team"` (default `"mine"`). `mine` adds `.eq("user_id", ctx.userId)`; `team`
  relies on RLS (own + downline). (RLS still constrains `mine` too — the `.eq` is just narrowing.)
- `status`: string[] — optional, from {approved, pending, withdrawn, denied}. `.in("status", …)`.
- `lifecycleStatus`: string[] — optional, from {active, cancelled, lapsed}. `.in("lifecycle_status", …)`.
  (Note: `null` lifecycle exists — document that "active policies" usually means `status=approved`
  and/or `lifecycle_status=active`; let the model choose, but the description must explain the two
  fields so it doesn't conflate "pending" (a `status`) with lifecycle.)
- `product`: string[] — optional. `.in("product", …)`.
- `dateField`: `"submit_date" | "effective_date" | "expiration_date" | "cancellation_date"`
  (default `submit_date`). Apply `.gte(dateField,startDate)` / `.lte(dateField,endDate)` when provided.
- `startDate` / `endDate`: YYYY-MM-DD, optional.
- `limit`: int, default 50, **hard cap 200** (clamp server-side — row JSON is model *input*,
  `maxTokens` does not bound it).

**Query:** `ctx.db.from("policies").select(SAFE_COLS, { count: "exact" })` then conditionally chain
`.eq/.in/.gte/.lte`, `.order(dateField, {ascending:false})`, `.limit(clampedLimit)`, then `await`.

**SAFE_COLS (allowlist — exact):** `status, lifecycle_status, product, annual_premium,
monthly_premium, submit_date, effective_date, expiration_date, cancellation_date, policy_number,
payment_frequency, carriers(name)` (embed carrier name via FK; verify the relationship name with
`node scripts/dbtype.mjs policies` — it's `carrier_id → carriers`). **NEVER** notes,
cancellation_reason, referral_source, client_id, user_id-of-others, lead_purchase_id.

**Return shape (grounded, mirrors other tools):**
```ts
return {
  available: true,            // zero rows is STILL available:true (it's a real "none")
  data: {
    count,                    // exact total matching the filter (may exceed returned rows)
    returned: rows.length,
    truncated: count != null && count > rows.length,   // tell the model the list is partial
    totalAnnualPremium: sum(rows.annual_premium),       // over RETURNED rows; flag partial via truncated
    totalMonthlyPremium: sum(rows.monthly_premium),
    policies: rows.map(safeShape),
  },
};
```
On `error` → `{ available:false, reason:"unavailable" }`. Use the `num()` helper pattern from
`getMyProduction.ts`. **Important:** the AP/IP sums are over *returned* rows only; when `truncated`
is true the description must tell the model to report `count` as the authoritative total and treat
the sum as "of the N shown" (or to narrow the filter). For an exact total-AP-over-all-matches you'd
need an RPC — out of scope for v1; `count` + `truncated` is the honest v1.

### 2.3 Register + wire
- `tools/index.ts` — import + add `queryPolicies` to the registry array.
- `core/registry.ts` — metadata (category `production` or a new `policies`, read). **Description is
  load-bearing** — it's how the model picks fields. Include: the two status vocabularies and what
  each means; the dateField→question mapping ("written/submitted"→submit_date, "active/in-force as
  of"→effective_date, "expiring"→expiration_date, "cancelled/lapsed when"→cancellation_date);
  "pending is a `status`, not a lifecycle"; "for personal numbers prefer getMyProduction; use
  queryPolicies to LIST or COUNT or FILTER policies"; "`count` is the true total, the list may be
  truncated — don't present a truncated sum as the team total."
- `core/agents.ts` — add `queryPolicies` to `allowedToolNames` for **production-analyst** and
  **policy-risk** (and consider coaching). Update those agents' prompts: "To list/count/filter
  individual policies (by status, lifecycle, product, or date), call `queryPolicies`. Use `scope`
  'mine' for the user's own book, 'team' for their downline." Keep `getMyProduction`/`getTeamLeaderboard`
  for aggregate/leaderboard asks.

### 2.4 Why not an RPC / not text-to-SQL (tell the user)
- RLS on `policies` is already correct and complete → a SECDEF RPC would *re-implement* tenancy and
  risk a leak; PostgREST on `ctx.db` inherits the proven policies for free.
- Arbitrary SQL is a money/tenant no: injection surface, RLS-bypass temptation, PII columns. The
  allowlisted structured tool gives "anything from the policies table" without those risks.

---

## 3. VERIFICATION (all must pass before shipping)

1. **Typecheck/lint:** `npm run typecheck` + `npm run lint`.
2. **Deno edge suite:** `./scripts/test-assistant-edge.sh` stays green. Extend the
   `tools.test.ts` mock (§2.1) and add `queryPolicies` cases: (a) filter returns rows + exact count;
   (b) zero rows → `available:true`, count 0; (c) `truncated:true` when count>limit; (d) AP sum
   correct over returned rows; (e) `scope:'mine'` adds the `user_id` eq, `scope:'team'` does not.
3. **Tenant isolation (the non-negotiable):** SQL-impersonation smoke in a rolled-back txn (mirror
   `test-assistant-recipient-authz.sh` / the Bug B smoke). Set `request.jwt.claims` to **two agents
   in different teams/IMOs**; run the same filter as each; assert each sees only own+downline, **no
   other-team / other-IMO policy_numbers**. This proves RLS does the scoping the tool relies on.
4. **Real prod query (the user's exact complaint):** with the E2E Bearer JWT, POST to
   `/assistant-orchestrator`: "find my pending policies in the last two weeks" → must hit
   `queryPolicies` with `status:["pending"]`, `dateField:"submit_date"`, the correct 14-day range,
   `scope:"mine"` — NOT month-to-date, NOT `no_team_data`. (Last session this exact ask wrongly went
   MTD; the date-grounding + EXACT-SPAN rules + this tool should fix it.)
5. **App-boot (project rule):** load `/command-center` in the dev server, run one typed turn, confirm
   no console/loading errors. (If a script is missing, create one under `scripts/` per CLAUDE.md.)

---

## 4. SHIP SEQUENCE
1. Edit → all of §3 green.
2. `git add` **explicit paths only**: `tools/queryPolicies.ts`, `tools/types.ts`, `tools/index.ts`,
   `core/registry.ts`, `core/agents.ts`, `tools/__tests__/tools.test.ts` (+ any new script).
3. `git commit --no-verify -m "feat(jarvis): queryPolicies — flexible RLS-scoped policy queries"`.
4. **`git diff-tree --no-commit-id --name-only -r HEAD`** → confirm ONLY your files.
5. `git push` (carries the 5 foreign board commits too — see §0.2; ask if unsure).
6. `supabase functions deploy assistant-orchestrator` (plain, no `--no-verify-jwt`).
7. Prod warm-ping with the **prod** anon key (§0.4) → expect `{ok,warm}` / HTTP 200.
8. Update `project_jarvis_phase1_perf_databugs.md` + MEMORY.md index line.

---

## 5. AFTER queryPolicies — the capability roadmap (designed, not built; owner wants all four, in order)

The owner's bigger vision: Jarvis should reach "anything regarding that user, and all things they've
integrated — calendar, Close CRM, emailing, SMS, policy retention," run proactive automations, work
beyond insurance (daily events), and let users build a personal **"second brain."** Send posture
stays **draft → human approves**. Payment reminders **deferred** (no forward-looking draft/EFT date
on `policies` yet). Full detail in `~/.claude/plans/jarvis-is-super-slow-whimsical-scroll.md`.

- **Phase 2 — Connect what already exists (low-risk bridges, keep draft→approve).** Most "weakness"
  is *unwired*, not missing. Full Close CRM writes (`draftCloseSequence`, opportunity create/update,
  lead-status — client + endpoints exist in `close-ai-builder/close/`); send via the user's Gmail
  (`gmail-send-email` + `gmail_integrations` OAuth exist → add a `gmail_email` executor channel);
  post to Slack (`slack-send-message` exists → `draftSlackMessage` + executor branch); more personal
  scoped-RPC tools (your book, your at-risk policies as a seller). All route through the existing
  `assistant-action-execute` approval gate.
- **Phase 3 — Second brain (per-user knowledge + RAG).** Greenfield, self-contained: new
  `user_knowledge_entries` (RLS `user_id=auth.uid()`), `pgvector` + `embedding vector(1536)`,
  `embed-knowledge-entry` edge fn (OpenAI `text-embedding-3-small`), `match_documents` RPC, a
  `searchUserKnowledge` tool + knowledge-aware agent, gated by `assistant_preferences.enabled_knowledge`.
  Ingestion via in-app note editor + voice daily-log (reuse `assistant-voice-stt`).
  **Obsidian verdict (final):** no server-callable Obsidian API (Local REST plugin is on-device;
  edge fns can't reach localhost). Build the in-app second brain + a one-click **"Export to Obsidian"**
  (`.zip` of `.md` with YAML frontmatter) the user drops into their own vault.
- **Phase 4 — Calendar.** Confirmed greenfield (Gmail OAuth has no `calendar.*` scope). Build on the
  exact Gmail OAuth pattern: `google_calendar_integrations` + init/callback/refresh edge fns +
  read-availability / draft-booking tools (booking stays draft→approve). Turns the `calendar` agent
  from "no live connection" into real scheduling.
- **Phase 5 — Proactive automation (draft→approve).** Reuse `evaluate-alerts`
  (`policy_lapse_warning`, `persistency_warning`) + `chargebacks` + `process-automation-reminders` /
  `workflows` + pg_cron. Jarvis queues retention/lapse nudges + pushed daily briefings as pending
  approvals (no autonomous send). **All sends must route through `send-sms` / `send-automated-email`
  so the TCPA suppression gate applies** — `process-automation-reminders` currently BYPASSES it
  (Twilio direct); fix when building. Payment reminders deferred until a forward-looking
  `draft_date`/`next_payment_date` exists on `policies` + a population source is chosen.

---

## 6. Reuse / templates (don't reinvent)
- `tools/getMyProduction.ts` — closest template for `queryPolicies` (input parse, `num()`, grounded
  return, RLS-via-ctx.db).
- `tools/types.ts` — `ToolDbClient`, `toSection`, `optionalString`, `requireString` helpers.
- `core/redaction.ts` reduces arrays to `{count:n}` for audit, `core/grounding.ts` reads top-level
  `available` — both already compatible with the proposed return shape.
- `get_command_center_summary` (mig `20260529174133`) + `get_my_team_leaderboard`
  (mig `20260601191455`) — the existing scoped aggregate/leaderboard RPCs; `queryPolicies`
  complements them (list/count/filter vs aggregate/rank), don't duplicate.
- Tenancy smoke template: `scripts/.../test-assistant-recipient-authz.sh` (the Bug B Part-2 smoke).

## 7. Related memory
[[project_jarvis_phase1_perf_databugs]], [[project_jarvis_latency_fixes]],
[[project_command_center_scoped_production]], [[project_jarvis_close_crm_integration]],
[[project_jarvis_data_correctness]], [[project_security_audit_20260531]].
