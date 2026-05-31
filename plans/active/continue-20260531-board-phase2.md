# Continue: "The Board" redesign — Phase 2 (per-archetype page sweep)

**Paste this into the new session:**

> Continue the "The Board" departure-board redesign. **Phase 1 (foundation + lit rail + dashboard) is DONE and build-green, uncommitted on `main`.** Start **Phase 2: the per-archetype page sweep.**
>
> 1. Read `docs/handoff-board-redesign.md` first — it has the full state, the Phase 2 plan, the critical files, and the verification steps. Also read memory `project_board_redesign.md`.
> 2. Obey the **TWO HARD RULES** (non-negotiable, both from user corrections):
>    - **Theme is SCOPED to `.theme-v2` in `src/index.css`, never global.** Never touch `:root`/`.dark`/`body`/global fonts. Public pages (landing, auth, `/join`, `/register`, legal) must stay on their original design.
>    - **Surfaces are NEUTRAL CHARCOAL** (bg `#0d0d0e`, panel `#161617`, panel2 `#1b1b1c`, tile `#222224`) — **never brown**. Text = cream; accents = blue (primary) / cyan (Jarvis only) / amber/red/green (status).
> 3. Phase 2 = reskin the ~48 in-app pages **one archetype at a time** (data-table lists FIRST, then tabbed hubs, detail views, wizards, dashboards, settings/billing/editors). For each: sweep hardcoded `bg-white`/`text-black`/`bg-zinc-*` → tokens, then apply `Board`/`SoftCard`/`Cap`/`Num`/`BoardPageHeader` chrome. Validate one representative page (build + look) before propagating.
> 4. **Exclude:** `/command-center`, the public marketing family, and `/recruiting/my-pipeline` + auth screens (unless I opt them in).
> 5. Track progress with `npm run audit:zinc:count` (≈142 files at start) and verify with `npm run build` + the running app (typecheck is NOT verification). Reuse the board component library in `src/components/board/*`.
>
> Do NOT commit or push unless I ask. Begin with the **data-table list** archetype (Policies, Expenses, Overrides, Downlines, Leaderboard, Contracting, …) — propose a shared table-header reskin first, then sweep.

---

## Pointers
- **Full plan / state:** `docs/handoff-board-redesign.md` (also synced to the Obsidian vault → `wiki/commission-tracker/frontend-design-system.md`).
- **Memory:** `project_board_redesign.md` (indexed in `MEMORY.md`).
- **Original approved plan:** `~/.claude/plans/need-to-completely-streamed-rose.md`.
- **Board components:** `src/components/board/*`. **Tokens (scoped):** `src/index.css` `.theme-v2` block + `src/components/board/tokens.ts`.
- **Smoke/verify:** `scripts/smoke-board-redesign.py [BASE_URL]`.

## Status snapshot (2026-05-31)
- Phase 1 uncommitted on `main`. Build/typecheck/lint green; `three` lazy-chunked; public pages Playwright-verified unaffected.
- Pending user action: visually confirm the authenticated `/dashboard` + lit rail (no dev JWT was available in-session).
