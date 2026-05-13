---
description: Smart auto-commit. Skips .env/secrets, surfaces feature-branch → main merge prompts, includes Co-Authored-By trailer.
argument-hint: [message]
---

You are performing a full commit + push. The user wants action, but they
ALSO trust you to not commit secrets and not skip the merge-to-main decision
when they're on a feature branch (production deploys from `main` only).

## Required steps (in order)

### 1. Survey state (parallel)
- `git status --short`
- `git diff --stat`
- `git branch --show-current`
- `git log -3 --oneline` (to match this repo's commit message style)

### 2. Identify sensitive / unrelated files — STAGE-EXCLUDE LIST
Never stage any of these even if modified or untracked:
- `.env`, `.env.local`, `.env.*` (secrets)
- Anything matching `*credentials*`, `*secret*`, `*.pem`, `*.key`
- `node_modules/`, `dist/`, `build/`, `.next/` (build artifacts — should be gitignored already, but double-check)

Also note unrelated stray untracked files (e.g. `docs/business/*.md` left from
some other task). Mention them so the user can decide, but **do not stage them**
unless the user's argument message explicitly references them.

### 3. Stage with explicit file paths (NEVER `git add -A` or `git add .`)
List every file to be staged by name. If the count exceeds ~30, batch them
across multiple `git add` calls.

### 4. Generate commit message (if no `$ARGUMENTS`)
- Title: imperative mood, under 72 chars, follows the repo's existing
  prefix convention (`feat(scope):`, `fix(scope):`, `refactor(scope):`,
  `chore(scope):` — check `git log` for the prevailing pattern).
- Body: short "Why:" paragraph, then bulleted "What changed:" list.
- Always append:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- Use a HEREDOC so newlines and quotes survive.

### 5. Commit on the current branch
- If the user gave a `$ARGUMENTS` message, use it verbatim (but still
  append the `Co-Authored-By` trailer).

### 6. Branch-routing decision — the part the old hook got wrong

After the commit succeeds:

- **If current branch is `main`:** push directly. `git push origin main`.

- **If current branch is anything else (a feature branch):** STOP and ASK
  the user via `AskUserQuestion`:

  > "You're on `<branch-name>`. Vercel only deploys from `main`. What do you want?"
  >
  > **Options:**
  >   - **Merge to main, push main**: merge `--no-ff` into main, push main, leave the feature branch behind (recommended for ship-ready work).
  >   - **Push feature branch only**: push `<branch-name>` to origin. Useful for sharing/CI review without deploying.
  >   - **Both**: push the feature branch AND merge to main + push main (preserves the branch for future ref).

  Then execute whichever the user picked:
  - Merge to main path: `git checkout main && git merge --no-ff <branch> -m "Merge <branch>: <one-line summary>" && git push origin main`. Use `--no-ff` so the merge commit is preserved in main's history.
  - Push feature only path: `git push -u origin <branch>` (use `-u` to set upstream on first push).

### 7. Final report
Print: current branch, commit hash(es), what was pushed to origin, and a
hint about Vercel deploying if main was pushed.

## Guardrails

- **NEVER use `--no-verify`** (pre-commit / pre-push hooks exist for a reason).
- **NEVER force-push** to main. If a force push to a feature branch is
  needed, ask the user first.
- **NEVER include `.env` or anything looking like credentials** in `git add`
  — even if the user's message argument seems to imply it.
- If pre-commit hooks reformat files during commit, those changes become
  part of the commit automatically. That's expected, not an error.
- If the push is rejected (non-fast-forward, hook failure, etc.), STOP and
  report the actual error. Do not retry blindly.

## User-provided commit message (optional)

$ARGUMENTS
