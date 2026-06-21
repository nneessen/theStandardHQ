# RESUME PROMPT — Spotlight / Social Studio (paste into a fresh session)

**Created Jun 21 2026.** Self-contained handoff to continue the Spotlight "Agent of
the Week" build. Read this top-to-bottom, then continue at **NEXT ACTION** below.
Everything from prior sessions is **UNCOMMITTED** on branch `main` (do NOT `git add -A`
— the tree is mixed with unrelated WIP; stage the EXACT co-commit set in §4, no more).

───────────────────────────────────────────────────────────────────────
0. ENVIRONMENT — start the app FIRST, before any code work
───────────────────────────────────────────────────────────────────────
Run `npm run dev` (boots Docker → local Supabase → Vite :3000 + API :3001 + edge
:54321). Confirm `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
returns **200**.

⚠️ KNOWN FAILURE (hit + FIXED Jun 21 2026): `npm run dev` died with
`supabase_db_… container is not ready: unhealthy`. ROOT CAUSE: after an unclean
shutdown, the Postgres **replication-slot state files were zeroed** →
`PANIC: replication slot file "pg_replslot/<slot>/state" has wrong magic number: 0`
→ container restart-loops. Both Realtime slots (`cainophile_*` and
`supabase_realtime_replication_slot_`) were corrupt. FIX (safe — slots are Realtime
logical-replication, recreated on boot; NO data loss; 47 users / 588 policies / the
spotlight bucket all verified intact afterward):

```bash
docker stop supabase_db_pcyaqwodnyrpkaiojnpz
# delete every corrupt slot dir (repeat per slot named in the PANIC line):
docker run --rm -v supabase_db_pcyaqwodnyrpkaiojnpz:/data alpine \
  sh -c 'rm -rf /data/pg_replslot/*'
docker start supabase_db_pcyaqwodnyrpkaiojnpz
# poll: docker inspect supabase_db_pcyaqwodnyrpkaiojnpz --format '{{.State.Health.Status}}'  → healthy
supabase start            # brings the rest of the stack back up
```
(The container name embeds the project ref `pcyaqwodnyrpkaiojnpz`. The DB data volume
is `supabase_db_pcyaqwodnyrpkaiojnpz`.) Prefer cleanly `supabase stop` at end of
session to avoid recurrence.

───────────────────────────────────────────────────────────────────────
1. WHERE WE ARE — Steps 1–4 ALL DONE (AOTW build COMPLETE), owner sign-off pending.
───────────────────────────────────────────────────────────────────────
> **✅ STEP 4 DONE (Jun 21 2026, UNCOMMITTED).** Template library: save the current card
> STYLE + pick from 6 starters or saved templates. Migration `20260621095010_social_templates.sql`
> APPLIED LOCAL + PROD (RLS mirrors `prospects`; anon denied, authenticated RLS-scoped; grant-hardened).
> A template stores STYLE only (`toTemplateConfig` strips photo + bg-image data URLs); applying preserves
> the agent photo, clears the per-post bg image. Gallery tiles mount the REAL scaled card (no stored
> thumbnail). Service `socialTemplateService` + hook `useSocialTemplates` mirror the prospects CRUD
> pattern. Verify: tsc/build 0, vitest 1773, `social-library-smoke.py` 7/7, studio smoke re-scoped +
> green, RLS/grant SQL check passed. Full detail in `continue-20260620-spotlight-aotw-library-build.md`
> Step-4 status block + memory [[social-studio-build]].

> **✅ STEP 3 DONE (Jun 21 2026, UNCOMMITTED).** Font / background / size / agency-name
> controls shipped as an AOTW "Style" panel. The critical advisor gate — that the real
> `html-to-image` download (a DIFFERENT, lossy renderer than the harness's native
> screenshot) embeds custom fonts + survives backdrop-blur/bg-image — was VERIFIED by
> reading real exports (Google + Fontshare fonts both embed). Also fixed a latent bug:
> the app `index.html` wasn't loading the AOTW design fonts at all (only the harness was),
> so the in-app preview + production download were silently using fallback fonts. Full
> detail + file list in the Step-3 status block of `continue-20260620-spotlight-aotw-library-build.md`.
> Verify: tsc/build 0, smoke 31/31 + 0 console errors, 4 real exports READ. NEXT = STEP 4
> (template library). New diagnostic: `scripts/aotw-export-probe.py` (drives the REAL download).

The full build plan + exact file-by-file state + review-fixed-bug list lives in
**`plans/active/continue-20260620-spotlight-aotw-library-build.md`** — READ IT; it is
the source of truth. Memory: `project_social_studio_build_20260620.md`. Summary:

- **STEP 1 DONE** — "Agent of the Week" wired as the 4th Social-Studio view + a
  design picker (Aurora / Editorial / Noir). Live = week's #1 producer; thin data
  falls back to `SAMPLE_AOTW`. The 0-producer path FORCES sample (no fabricated
  "Marcus Webb" as live/downloadable — do NOT regress).
- **STEP 2 DONE** — agent photo upload to a new PUBLIC `spotlight-assets` Storage
  bucket (migration `20260620192348_spotlight_assets_bucket.sql`, applied **local +
  prod**). Card renders the photo from a **data URL** (CORS-proof export), file also
  uploaded for the public URL. Read policy `TO authenticated`; write scoped to
  `${auth.uid()}/aotw-photo` (stable key + upsert, never orphans). Remove button
  calls `storage.remove`.
  - ⚠️ LOCAL LIMITATION: the local storage emulator's `storage.prefixes` table has
    RLS-on/no-policy → object DELETE 400s for EVERY bucket locally. PROD has no such
    table → delete works. So "Remove" is verified by mechanism + on prod, NOT
    locally. **Owner must confirm Remove on prod with a real upload+remove.**

VERIFY STATUS (Step 2): tsc 0, `npm run build` 0, `deno check` (caption fn) 0,
`scripts/social-studio-smoke.py` 22/22 + 0 console errors, RLS check 4/4 local+prod,
HTTP public GET 200 / anon list `[]`. `database.types.ts` unchanged (storage-only).

PENDING (not blocking next step): owner visual sign-off on the 3 AOTW designs + photo
upload; owner to confirm prod Remove; **edge fn `generate-social-caption` is still
DEPLOY-PENDING** (the `view:"aotw"` allowlist change is local only — deploy before
relying on AI captions for AOTW in prod). Nothing is committed.

───────────────────────────────────────────────────────────────────────
2. NEXT ACTION — AOTW build is COMPLETE; remaining = owner sign-off + the automation backend
───────────────────────────────────────────────────────────────────────
Steps 1–4 are all DONE (see §1). The AOTW/customization/library track in
`continue-20260620-spotlight-aotw-library-build.md` is finished. What remains:

1. **OWNER VISUAL SIGN-OFF** on Steps 1–4 (nothing committed yet; stage the EXACT
   co-commit set listed in §4 — the tree is mixed with unrelated WIP, do NOT `git add -A`).
2. **DEPLOY-PENDING:** the `generate-social-caption` edge fn (built, not deployed → AI captions
   inert in prod). Confirm prod "Remove photo" (storage delete; local emulator can't test it).
3. **THE AUTOMATION BACKEND (the bigger, separate phase)** — spec in
   `continue-20260620-social-studio-implementation.md` P2–P4: persistence (schedule +
   generated-post tables), a Vercel `@sparticuz/chromium` server-side render fn, a cron worker
   (P2); Instagram connect + 2-step auto-post + per-cadence on/off toggles, default OFF (P3); AI
   one-offs + multi-agency (P4). This is gated — needs an explicit owner "continue".
4. Deferred polish: a deeper portrait-optimized restyle of the daily/weekly/monthly cadence cards
   (they render correctly in portrait now). AI image enhancement = owner chose SKIP.

⚠️ GATING: the owner has gated EVERY step. Do NOT start the automation backend without a
"continue"/confirmation. A bare "continue" advances one step/phase.

KEY GOTCHA TO CARRY FORWARD: the download path (`html-to-image`) is a different, LOSSY renderer
from the render harness (native screenshot). ALWAYS verify exports with `scripts/aotw-export-probe.py`
(reads the REAL download), never trust harness PNGs for fidelity. Instagram POST default is now
**4:5 portrait 1080×1350** (not square); story/reel = 9:16. Template thumbnails + the studio preview
mount the real cards, so smoke assertions scope to `[data-testid=social-preview]`.

───────────────────────────────────────────────────────────────────────
3. PROCESS RULES (from CLAUDE.md — MUST follow)
───────────────────────────────────────────────────────────────────────
- Migrations ONLY via `./scripts/migrations/run-migration.sh <file>`; queries via
  `run-sql.sh`. NEVER psql directly. Prod-apply pattern:
  `set -a; source .env; set +a; DATABASE_URL="$REMOTE_DATABASE_URL"
  ./scripts/migrations/run-migration.sh <file>`. DB target this project = **local + prod**.
- After any schema change: regenerate `src/types/database.types.ts`
  (`npm run generate:types`). NEVER read database.types.ts whole — use
  `node scripts/dbtype.mjs <name>`.
- Naming: Components PascalCase, files kebab-case, functions camelCase. No mock data in
  prod code. Active session files in `plans/active/` (not root).
- After every code change, run `scripts/social-studio-smoke.py` (authed; creds in
  `.env.local` E2E_EMAIL/E2E_PASSWORD) — extend it for new controls. Render card
  visuals via `scripts/leaderboard-card-render/run.mjs` and READ the PNGs to
  self-verify before showing the owner.
- Adversarial review before declaring a step done (the prior two steps each caught
  real bugs that inspection missed); then an advisor() pass; make the deliverable
  durable (code + plan doc + memory) BEFORE the final advisor call.
- Branding: "THE STANDARD" (agency) / "EPIC LIFE" (network); last-initial names.
- Run `quick-check` (tsc + eslint) — but note `npm run build` does NOT run eslint, and
  the feature has pre-existing `no-restricted-imports` deep-import lint debt that is a
  PUSH-TIME concern (no `leaderboard/social` barrel exists). Build must be 0 errors.

───────────────────────────────────────────────────────────────────────
4. CO-COMMIT SET — the EXACT paths to stage (verified against the tree Jun 21 2026)
───────────────────────────────────────────────────────────────────────
"Social-Studio paths" is NOT just `src/features/social-studio/`. The feature spans the
leaderboard card components, the agency-scoped data path, the route + nav wiring, fonts,
the regenerated DB types, two migrations, an edge fn, and the smoke/render scripts. Stage
ALL of these together (one feature commit) — staging a subset ships a broken/unreachable
page. Do NOT `git add -A` (unrelated WIP — avgAP override, inbound-CRM, light-mode — is
also dirty). Add these paths explicitly:

⚠️ UPDATED Jun 21 2026 (post code-review). The card components MOVED
`features/leaderboard/social/` → **`features/social-cards/`** and several new files were
added (state model, services, hooks, a 3rd migration). The AUTHORITATIVE current set + the
rationale for every fix is the **RESOLUTION block at the top of
`continue-20260621-spotlight-code-review.md`** — read that first; the list below is the
reconciled snapshot.

NEW (untracked):
- `src/features/social-studio/`                      ← page, components, hooks, types, sampleData, **previewModel.ts**, **__tests__/**
- `src/features/social-cards/`                       ← AOTW + leaderboard/monthly cards, socialFormat, **index.ts barrel**, **__tests__/** (MOVED from leaderboard/social/)
- `src/services/social-studio/`                      ← socialTemplateService + **spotlightAssetService** + **socialCaptionService** + index + **__tests__/**
- `supabase/migrations/20260620192348_spotlight_assets_bucket.sql`   ← Step 2 (applied local+prod)
- `supabase/migrations/20260621095010_social_templates.sql`          ← Step 4 (applied local+prod)
- `supabase/migrations/20260621124027_get_agency_ap_leaderboard.sql` ← #2 additive AP-count RPC (applied local+prod)
- `supabase/functions/generate-social-caption/`      ← AI caption fn (NOT yet deployed)
- `scripts/leaderboard-card-render/`                 ← Vite+Playwright render harness
- `scripts/social-studio-smoke.py`, `scripts/social-library-smoke.py`
- `scripts/aotw-export-probe.py`, `scripts/aotw-showcase.py`         ← real-download fidelity probes
- `scripts/spotlight-assets-rls-check.sql`
- plan docs in `plans/active/` (this file + the two `continue-20260620-*` + the code-review doc)

MODIFIED (M) — all Social-Studio additions, NOT unrelated WIP:
- `src/router.tsx`                                   ← adds `socialStudioRoute` (super-admin only)
- `src/components/layout/sidebar/sidebar-nav.config.ts`  ← adds the "Spotlight" nav item
- `src/services/leaderboard/leaderboardService.ts`  ← `getAgencyAgentLeaderboard` (+ the #2 submitted-count merge) + **__tests__/getAgencyAgentLeaderboard.test.ts** (new)
- `src/hooks/leaderboard/useLeaderboard.ts` + `src/hooks/leaderboard/index.ts`  ← `useAgencyAgentLeaderboard`
- `src/types/leaderboard.types.ts`                   ← adds optional `submittedPolicies`
- `index.html`                                       ← AOTW Google + Fontshare font links
- `src/types/database.types.ts`                      ← REGENERATED from prod (see caveat ↓)

⚠️ `database.types.ts` CAVEAT: additive only. Now contains `social_templates` +
**`get_agency_ap_leaderboard`** (ours) **plus** incidental `inbound_calls` prod-schema drift
from a SEPARATE prod change — NOT ours, but harmless (type-only, additive). Stage the WHOLE
file; do NOT hand-trim a generated file. Confirm the diff is additive-only
(`git diff --numstat src/types/database.types.ts` → `N  0`) before staging.
