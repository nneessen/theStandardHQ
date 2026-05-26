# Continuation: Build Claude Code extensions that leverage the knowledge vault

**Created:** 2026-05-25
**Scope:** commissionTracker FIRST. Generalize to standard-leads / standard-chat-bot only after the commission-tracker set is proven.

---

## Mission

Figure out which **custom Claude Code extensions** — skills, hooks, subagents, and/or
slash commands — are worth building to make coding and building large-scale projects
faster and more reliable *by exploiting the Obsidian knowledge vault we just consolidated*.
Design them, then build + verify the high-value ones for the `commission-tracker`
namespace. Do NOT mass-produce extensions; pick the few with real leverage (the project
CLAUDE.md forbids over-engineering).

## Current state (read these first)

- **Memory:** `project_consolidated_knowledge_vault.md` (auto-loaded via MEMORY.md) — the
  full layout, namespaces, toolchain, cron, and gotchas. Read it before anything else.
- **Vault:** `~/projects/_knowledge-vault/` (own git repo). This project's slice:
  - Wiki (synthesized, read-first): `~/projects/_knowledge-vault/wiki/commission-tracker/` — start at `index.md`.
  - Raw snapshot (read-only): `~/projects/_knowledge-vault/raw-sources/commission-tracker/`.
  - Schema/method doc: `~/projects/_knowledge-vault/CLAUDE.md.md`.
- **Toolchain** (all take `-p commission-tracker`, run from the vault):
  `scripts/wiki-sync-check.sh` (read-only drift), `scripts/wiki-sync.sh` (cron drift →
  namespace-keyed self-clearing block in `Memory.md`), `scripts/wiki-lint.sh`,
  `scripts/sync-all.sh`, `scripts/morning_digest.py`.
- **Pointer already wired:** `commissionTracker/CLAUDE.md` has the "PROJECT KNOWLEDGE BASE"
  block telling Claude to read `wiki/commission-tracker/` before unfamiliar work and to
  re-sync the vault after producing durable docs.
- **Direction is fixed:** the repo's `docs/` is the source of truth; the vault is strictly
  downstream. Extensions must respect that (never let an extension write wiki content back
  into the repo as canonical, never hand-edit `raw-sources/`).

## What to produce

1. A short ranked list of candidate extensions with: the workflow pain each solves, the
   RIGHT mechanism (skill vs hook vs agent vs command — they are not interchangeable),
   where it lives, and a rough effort/payoff call.
2. Build the top 1–3 for `commission-tracker`, then VERIFY them by actually exercising the
   path (run the command, trigger the hook, invoke the agent) — typecheck/"file exists" is
   NOT verification (see memory `feedback_typecheck_is_not_verification`).
3. Note which generalize cleanly to the other two namespaces (don't build those yet).

## Candidate ideas to evaluate (seed list — refine, don't treat as final)

- **`/recall <topic>` slash command** — before working, pull the relevant
  `wiki/commission-tracker/` page(s) into context instead of grepping `docs/` cold.
- **`vault-librarian` subagent** — given a feature area, reads the matching wiki page(s)
  + linked pages and returns an oriented briefing (keeps the main context lean; fan-out
  reads happen in the subagent).
- **SessionStart hook** — surface this project's open `Memory.md` actions (the vault's
  drift items + hand-authored ones) at the top of a session.
- **Post-work "wiki drift" hook** (Stop / PostToolUse on `docs/**` writes) — run
  `wiki-sync-check.sh -p commission-tracker` and remind to fold new/changed docs into the
  wiki + lint. Cheap, $0, no LLM.
- **`/ingest <doc>` skill** — given a new/changed `docs/` file, copy it into
  `raw-sources/commission-tracker/` (exact basename), synthesize into the right wiki
  page(s), append `log.md`, bump `index.md` `updated:`, run lint to 0. Encodes the
  CLAUDE.md.md ingest procedure so it's one step, not five.
- **`/wiki-page <topic>` skill** — synthesize or refresh a single topic page from its raw
  sources following the schema doc.

## Mechanism reference + how to verify it's real

Confirm exact, current Claude Code mechanics BEFORE designing — use the
**`claude-code-guide`** agent (authoritative) rather than assuming:
- **Skills:** `SKILL.md` under `.claude/skills/<name>/` (or a plugin). Confirm invocation +
  frontmatter.
- **Hooks:** `settings.json` event handlers (`SessionStart`, `UserPromptSubmit`,
  `PreToolUse`/`PostToolUse` with matchers, `Stop`, …) running shell commands. Confirm
  event names, matcher syntax, and the JSON contract a hook receives/returns.
- **Subagents:** `.claude/agents/<name>.md` with frontmatter (name, description, tools,
  model). Confirm tool-scoping.
- **Slash commands:** `.claude/commands/<name>.md` prompt templates + argument handling.

Decide per extension whether it belongs in **`commissionTracker/.claude/`** (project-local,
travels with the repo) or **`~/.claude/`** (global, reused across all three projects). Vault
helper scripts an extension shells out to should live in `~/projects/_knowledge-vault/scripts/`.

## Constraints

- No over-engineering; minimal, local, only what earns its keep.
- Respect the downstream rule and the migration rules (no psql, etc.) if anything touches DB.
- Extensions that shell out must use the `-p commission-tracker` flag and absolute vault paths.
- Verify by running, not by compiling.

## First steps for the new session

1. Read memory `project_consolidated_knowledge_vault.md` + skim `wiki/commission-tracker/index.md`.
2. Spawn `claude-code-guide` to lock down the current skill/hook/agent/command mechanics.
3. Draft the ranked candidate list (above, refined) and confirm scope/priorities with the user.
4. Build + verify the top picks for `commission-tracker`.

## Definition of done

The top 1–3 extensions exist under the right `.claude/` location, are wired to the vault
with correct `-p commission-tracker` paths, and each has been exercised end-to-end (not just
created). A note records which ones generalize to the other two namespaces as the next batch.
