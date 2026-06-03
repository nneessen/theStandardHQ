# Continuation — Pre-Sunset Protection: Task 2A (engineering) → 2B (legal handoff)

**Created:** 2026-05-31 • **Priority:** HIGH • Paste this whole block into a fresh Claude Code session.

---

Continue the commissionTracker pre-sunset protection work. **Task 1 (ADA/WCAG audit) is DONE and
committed** (`109814c5` on main) — do NOT redo it. Now do **Task 2A (engineering protection audit,
in-repo)**, then assemble the **Task 2B legal handoff packet**.

## READ FIRST (in full, before any work)
- `plans/active/continue-20260531-ada-audit-and-presunset-protection.md` ← PRIMARY plan; §2A, §2B, §2C are the spec
- `docs/business/accessibility-audit-2026-05-31.md` ← what Task 1 delivered (context only)
- `docs/security/SECURITY_AUDIT_2026-05-31.md` ← security posture (done/deployed/pending)
- `docs/business/compliance-gap-assessment-2026-05-31.md` ← TCPA/CAN-SPAM/ADA/CCPA status
- `plans/active/continue-20260527-platform-sunset-phase2-edge-fns-frontend.md` ← the sunset/RED-BUTTON build state
- Memory: `project_platform_sunset_ffg_revocation.md`, `project_ada_accessibility_audit_20260531.md`,
  `project_platform_ip_ownership.md`, and the MEMORY.md entries dated "May 31, 2026"

## HARD GUARDRAIL (do not violate)
**DO NOT execute the platform sunset / wipe.** The irreversible wipe must not run until counsel
clears Task 2B. You may exercise the REVERSIBLE flag (`imos.access_revoked_at`) only via
BEGIN/ROLLBACK or against throwaway/seeded data — never commit a real revocation. Treat the wipe
function as read-only/audited code this session.

---

## TASK 2A — Engineering protection audit (do these, in priority order)

### 2A.1 — export ⊆ wipe parity (THE #1 control) — ✅ DONE 2026-05-31
Goal: prove that `generate-user-export-bundle` exports **every table/column the wipe touches**, so no
revoked Founders/Self Made user can claim "you destroyed records I could never retrieve."

OUTCOME: The parity test was already built by a prior session (NOT an open TODO as the plan assumed) —
`src/features/sunset/__tests__/wipe-export-parity.test.ts`. Running it **caught a real drift**: the wipe
SQL fn (`wipe_user_business_data`, migration 20260527060621) still hardcoded `signature_submitters` in
`c_explicit_tables`, but today's DocuSeal removal (`20260531172935_remove_docuseal_signature_tables.sql`
+ the uncommitted `owned-tables.ts` registry edit) dropped that table. Runtime-benign (the fn's
`to_regclass` guard skips a missing table) but exactly the drift this control exists to catch.

FIXES (this session):
- New behaviour-preserving migration `20260531193559_wipe_drop_signature_submitters_ref.sql` —
  `CREATE OR REPLACE FUNCTION wipe_user_business_data` with `signature_submitters` removed from both
  positional arrays (`c_explicit_tables` + matching `c_explicit_cols` index); body otherwise
  byte-identical (same guards/order/grants). Applied to LOCAL via runner (fn version → 20260531193559).
- Fixed the test's brittle path coupling: it had hardcoded the `20260527060621` migration path, so it
  would have validated stale SQL after any future recreation. Now globs `supabase/migrations/*.sql`,
  selects the latest file defining `c_explicit_tables text[] := ARRAY[`, and `throw`s loud if none match.
- Verified: `npx vitest run …wipe-export-parity` → 7 static pass; `RUN_DB_TESTS=1 …` → all 11 pass
  (live-catalog confirms registry matches the real local catalog post-drop).

DOCUMENTED EXCLUSIONS: intentional non-exported-but-wiped rows live in `WIPE_ONLY_TABLES` in
`owned-tables.ts` (caches, OAuth tokens, quotas, prefs) — the registry IS the rationale record.

RESIDUAL (out of scope for the static test → 2A.2): an un-enumerated CASCADE child that gets wiped but
was never in the registry/export. The gated live-catalog tests + remote catalog check (2A.2) cover this.

OPEN FOLLOW-UPS:
- **PROD**: the deployed prod fn still carries the stale `signature_submitters` ref (runtime-benign).
  Apply `20260531193559_…sql` to remote to keep prod/local in sync — needs explicit go from Nick.
- **COMMIT SCOPING**: the migration + test edit are consistent ONLY together with the uncommitted
  `owned-tables.ts` registry change (HEAD still has signature_submitters → test would fail against HEAD).
  So a 2A.1 commit must include `owned-tables.ts`, which entangles it with the broader DocuSeal-removal
  working tree. Decide whether to commit the registry change with 2A.1 or as part of a DocuSeal commit.
  NOT committed this session (per "commit only when asked").

### 2A.2 — export actually DELIVERS (verify on REMOTE, not local)
KNOWN local-stack limits (env artifacts, hosted is fine): local Supabase storage-api rejects all
object DELETEs, and signed URLs embed `kong:8000` (browser can't resolve). So **export download +
the wipe's storage removeAll/recovery-GC can only be observed on remote.** Do a controlled remote
check: curl-upload an object, generate an export bundle for a seeded test user, confirm the signed
URL resolves and the bundle is complete + openable. Record evidence.

### 2A.3 — audit logging / evidence trail
Confirm revocation + export + wipe each write a tamper-evident, timestamped record (who/what/when/why).
Verify it exists end-to-end; add it where missing. This is Nick's defensive evidence trail.

### 2A.4 — no collateral to Epic Life (re-verify on prod)
Re-verify `get_effective_imo_id()` sentinel path, RLS gating, and the 7 anon SECURITY DEFINER RPCs all
respect `access_revoked_at` — revoked users cut off, Epic Life untouched, no cross-tenant leak either
direction. Most shipped already; re-verify, don't assume.

### 2A.5 — reversibility
Confirm the two-switch design: reversible `access_revoked_at` flag vs irreversible wipe. Prove the
reversible step genuinely restores access (BEGIN/ROLLBACK or seeded data).

### 2A.6 — keep security/compliance green
TCPA/CAN-SPAM suppression infra is built but edge fns NOT deployed (needs env: `UNSUBSCRIBE_SECRET`,
`COMPANY_POSTAL_ADDRESS` [real deliverable address], `SMS_WEBHOOK_URL` + Twilio). Don't let this
regress; flag deploy as a Nick-blocked step. Note: lots of uncommitted prior work sits on main
(DocuSeal removal etc.) — leave it; make scoped commits only.

## TASK 2B — Legal handoff packet (engineering CANNOT solve this in code)
Do NOT attempt to "resolve" legal items. Produce a single clean, attorney-ready document
(`docs/business/presunset-legal-handoff-<date>.md`) that, for each item below, states the engineering
facts + evidence we can show and the specific question counsel must answer:
- **Agent agreement(s) with Founders** — IP/work-product, non-compete, non-solicit, data ownership,
  platform/tooling clauses. (Biggest open risk per `project_platform_ip_ownership.md`.)
- **Platform Terms adequacy** for an adversarial shutoff (right to discontinue, no uptime/warranty,
  limitation of liability, CO governing law, anti-IMO clauses already in `TermsPage.tsx`).
- **Data-wipe legality** — right to delete agents' business data; insurance record-retention duties;
  bless the export-first sequence.
- **Tortious interference / business disruption** — notice period? wind-down? documented legitimate
  business rationale (not retaliation)?
- **Entity shield + insurance** — LLC owning the IP? cyber + tech E&O + GL confirmed? (Nick owns it
  personally today = full personal exposure.)
Attach the 2C evidence list (IP-independence declaration, Terms-acceptance records, documented business
reason, pre-wipe full DB+storage backup snapshot).

## OPEN QUESTIONS FOR NICK (needed to scope 2B; ask early)
1. Roles of Cary Glass / Bowen Sweeney at Founders/Self Made (owners? upline? counsel?).
2. Target sunset timeline.
3. Does an LLC own/operate the platform? Insurance in place?
4. Has the agent agreement been reviewed by an attorney yet?

## SUGGESTED ORDER
2A.1 (parity test) → 2A.2 (remote export delivery) → 2A.3 (audit trail) → 2A.4/2A.5 (isolation +
reversibility) → assemble 2B packet → hand 2B to Nick's attorney. **Do NOT trigger the sunset until
counsel clears 2B.**

## WORKING RULES (from CLAUDE.md)
- Migrations ONLY via `./scripts/migrations/run-migration.sh`; queries via `run-sql.sh`. Never raw psql.
- Regenerate `database.types.ts` if schema changes; `npm run build` must be 0 errors.
- Typecheck passing ≠ verification — exercise the real code path (curl the deployed fn, confirm DB
  side-effect). On 5xx, read the actual server log first.
- Scoped commits to main only; never push non-main branches (Vercel deploys on push).
- After durable docs land under `docs/`, sync the knowledge vault (`/ingest`).
