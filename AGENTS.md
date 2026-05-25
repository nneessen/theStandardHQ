# Repository Guidelines

## Project Structure & Module Organization

- `src/` holds application code, organized by feature modules in `src/features/` with shared UI in `src/components/`.
- Routing lives in `src/routes/`, data access in `src/services/`, hooks in `src/hooks/`, and utilities in `src/lib/`.
- Types are centralized in `src/types/` (especially `database.types.ts`).
- Tests live alongside code as `*.test.ts(x)` and in `tests/`.
- Static assets are in `public/`, build output is `build/`.
- Supabase SQL lives in `supabase/migrations/`; docs and plans are in `docs/` and `plans/`.

## Build, Test, and Development Commands

- `npm run dev` starts the Vite dev server on port 3000.
- `npm run dev:local` runs the local API (`server.js`) plus Vite.
- `npm run build` runs TypeScript build + Vite bundle; must pass for CI.
- `npm run test` (or `test:run`, `test:ui`) runs Vitest.
- `npm run lint` and `npm run typecheck` enforce ESLint + strict TS.
- `npm run generate:types` regenerates Supabase types when schema changes.
- `npm run email:dev` / `email:build` are for React Email templates in `supabase/email-src`.

## Coding Style & Naming Conventions

- TypeScript strict mode; React functional components with hooks.
- Naming: components in PascalCase, files in kebab-case, functions/vars in camelCase.
- No mock data in production; use TanStack Query for server state.
- Formatting via Prettier defaults; linting via ESLint (`eslint.config.js`).
- Use `@/` alias for `src/` imports.

## Testing Guidelines

- Frameworks: Vitest + Testing Library; setup in `src/setupTests.ts`.
- Test files are `*.test.ts` or `*.test.tsx`; keep tests close to features.
- Financial/commission logic requires thorough unit coverage; tests must pass before merge.

## Commit & Pull Request Guidelines

- Commits follow Conventional Commit style: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`.
- PRs should include a clear summary, tests run, and any DB impact.
- For UI changes, include screenshots; link related issues when available.
- If migrations change, update `src/types/database.types.ts` and note it in the PR.

## Security & Configuration Tips

- Copy `.env.example` to `.env` and set Supabase keys before running locally.
- Keep business data in Supabase; only store theme/sidebar/auth tokens in local storage.

## Project Knowledge Base (Obsidian wiki)

- A synthesized KB for this codebase lives in a sibling vault at `../Standard HQ/`. Read it before re-deriving context from scattered docs: start at `../Standard HQ/wiki/index.md`, then the relevant topic page.
- Direction is one-way: `docs/` here is the source of truth; the vault is strictly **downstream** (it summarizes `docs/`). Never edit `../Standard HQ/raw-sources/` or promote wiki pages back into this repo.
- After adding a durable doc to `docs/`, sync it into `../Standard HQ/raw-sources/` + the wiki, then run `../Standard HQ/scripts/wiki-lint.sh` (exit 0). Use `../Standard HQ/scripts/wiki-sync-check.sh` to see what's unsynced.
