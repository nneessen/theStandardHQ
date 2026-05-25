### CONTINUATION PROMPT

#### Role & Operating Mode

You are a professional coding agent working in **Builder Mode** on the Commission Tracker application. You operate security-first, correctness-first, with no frontend-only auth, no schema guessing, and no mock data. You follow strict TypeScript, use TanStack Query for all data operations, and follow the project's feature-based architecture. You use Serena for code analysis and symbolic operations. You MUST use the migration runner script (`./scripts/migrations/run-migration.sh`) for all DB migrations — NEVER direct psql.

#### Project Context

**Domain**: Insurance Sales KPI, Recruiting, and Agency Management System
**Stack**: React 19.1, TypeScript (strict), TanStack Query + Router, Supabase/PostgreSQL, Tailwind CSS, shadcn/ui, Vitest
**Architecture**: Feature-based modules under `src/features/`, services under `src/services/`, hooks under `src/hooks/`, types under `src/types/`. Database types generated from `npx supabase gen types typescript`. Vercel deployment with strict build checks.

**Branch**: `main` (single-branch workflow)

---

#### Current Objective

Two concurrent workstreams are active:

**1. Training Modules Feature (PRIMARY — in progress)**

Building a full Training Modules system with module builder (admin), learner UI, gamification, analytics, and route integration.

**2. Subscription Feature Flags (SECONDARY — recently modified)**

Three new subscription feature flags were added to support tiered recruiting page access: `recruiting_basic`, `recruiting_custom_pipeline`, `custom_branding`.

**3. BasicRecruitingView Resend Invite (UNCOMMITTED)**

A "Resend password setup email" button was added to `BasicRecruitingView.tsx` using `useResendInvite` from `../hooks/useAuthUser`. This change is uncommitted and working.

---

#### Established Design Decisions

1. **Training Modules Architecture**: Feature self-contained under `src/features/training-modules/` with subdirectories: `components/`, `hooks/`, `services/`, `types/`.
2. **Subscription Features**: `SubscriptionFeatures` interface in `src/services/subscription/SubscriptionRepository.ts` defines all feature flags as boolean keys. Display names mapped in `src/hooks/subscription/useFeatureAccess.ts` via `FEATURE_DISPLAY_NAMES`.
3. **Plan Tiers**: 3-tier system: `free`, `pro`, `team`. Starter tier was removed.
4. **Subscription Bypass**: `SUBSCRIPTION_BYPASS_ROLES` is currently empty (`[] as const`).
5. **No useMemo/useCallback**: React 19 project — avoid useMemo and useCallback per project conventions.
6. **UI Style**: Compact, professional, data-dense. Small text (10-11px), muted palette, minimal padding, tables over cards, desktop-first.
7. **Supabase client import**: `import { supabase } from "@/services/base/supabase"` — exported from `src/services/base/index.ts`.
8. **Auth context pattern**: `user` is `Partial<UserProfile> | null`, so hooks must use `user!.id!` (double non-null assertion) for query functions guarded by `enabled: !!user?.id`.

---

#### Data Model / Schema State

**Existing Training Schema (deployed)**:
- `training_documents` table — shared document library for trainers (migration `20260127102829_training_documents.sql`)
- `is_training_hub_staff()` helper function for RLS

**Training Modules Schema — MIGRATIONS DO NOT EXIST YET**:
The TypeScript types, services, hooks, and UI components are all written but the **database tables have not been created**. The following tables must be created via migrations based on the TypeScript type definitions in `src/features/training-modules/types/training-module.types.ts`:

Core tables:
- `training_modules` — id, imo_id, agency_id?, title, description?, category, thumbnail_url?, difficulty_level, estimated_duration_minutes?, xp_reward, is_published, is_active, version, created_by, updated_by?, published_at?, tags[], metadata JSONB
- `training_lessons` — id, module_id FK, imo_id, title, description?, sort_order, lesson_type (content/quiz/practice), xp_reward, is_required, estimated_duration_minutes?
- `training_lesson_content` — id, lesson_id FK, imo_id, content_type (rich_text/pdf/video/external_link/script_prompt), sort_order, title?, rich_text_content?, video_url?, video_platform?, document_id?, external_url?, external_url_label?, script_prompt_text?, script_prompt_instructions?, metadata JSONB

Quiz tables:
- `training_quizzes` — id, lesson_id FK, imo_id, pass_threshold, max_attempts, shuffle_questions, shuffle_options, show_correct_answers, time_limit_minutes?, xp_bonus_perfect
- `training_quiz_questions` — id, quiz_id FK, imo_id, question_text, question_type (multiple_choice/true_false), explanation?, sort_order, points
- `training_quiz_options` — id, question_id FK, option_text, is_correct, sort_order

Progress/Assignment tables:
- `training_assignments` — id, module_id FK, imo_id, agency_id, assigned_to?, assignment_type (individual/agency), assigned_by, due_date?, priority, is_mandatory, module_version, status (active/completed/revoked), completed_at?
- `training_progress` — id, user_id, lesson_id FK, module_id FK, imo_id, agency_id, status (not_started/in_progress/completed), started_at?, completed_at?, time_spent_seconds, last_accessed_at? — UNIQUE on (user_id, lesson_id)
- `training_quiz_attempts` — id, user_id, quiz_id FK, lesson_id FK, module_id FK, imo_id, agency_id, score_percentage, score_points, max_points, passed, answers JSONB, time_taken_seconds?, attempt_number, completed_at

Gamification tables:
- `training_xp_entries` — id, user_id, imo_id, agency_id, xp_amount, source_type, source_id?, description?
- `training_user_stats` — user_id PK, imo_id, agency_id, total_xp, modules_completed, lessons_completed, quizzes_passed, avg_quiz_score, current_streak_days, longest_streak_days, last_activity_date?, total_time_spent_seconds
- `training_badges` — id, imo_id, name, description?, icon, color, badge_type, criteria JSONB, xp_reward, is_active, sort_order
- `training_user_badges` — id, user_id, badge_id FK, imo_id, agency_id, earned_at
- `training_certifications` — id, imo_id, name, description?, required_module_ids[], validity_months?, badge_id?, xp_reward, is_active
- `training_user_certifications` — id, user_id, certification_id FK, imo_id, agency_id, earned_at, expires_at?, status (active/expired/revoked)
- `training_challenges` — id, imo_id, agency_id?, title, description?, challenge_type, target_value, start_date, end_date, xp_reward, badge_id?, created_by, is_active
- `training_challenge_participants` — id, challenge_id FK, user_id, imo_id, agency_id, current_value, completed, completed_at?

Required RPCs (called by services):
- `complete_training_lesson(p_lesson_id, p_time_spent_seconds)` → returns `{xp_earned, module_completed, lesson_id}`
- `submit_training_quiz_attempt(p_quiz_id, p_answers JSONB, p_time_taken_seconds)` → returns `{score_percentage, score_points, max_points, passed, attempt_number, xp_earned, answers}`
- `get_training_leaderboard(p_agency_id, p_period)` → returns `{user_id, full_name, total_xp, modules_completed, current_streak_days, rank}`
- `get_skill_radar_data(p_user_id?)` → returns `{category, completed_modules, total_modules, proficiency_pct}`
- `get_module_progress_summary(p_module_id, p_user_id?)` → returns `{lesson_id, lesson_title, lesson_type, sort_order, is_required, status, completed_at, time_spent_seconds}`

**Subscription Schema (deployed)**:
- `subscription_plans` table with `features` JSONB column
- `user_subscriptions`, `usage_tracking`, `subscription_payments`, `subscription_events` tables

**New Subscription Feature Flags (TypeScript updated, DB rows may need update)**:
```typescript
recruiting_basic: boolean;
recruiting_custom_pipeline: boolean;
custom_branding: boolean;
```

---

#### Security & RLS Model

- All tables use RLS with `imo_id`-based tenant isolation
- `is_training_hub_staff(user_id)` checks for trainer/contracting_manager/admin roles
- Training content should be scoped to the user's IMO
- Assignments and progress are per-user with RLS
- Public endpoints must not expose user_id or imo_id
- Super admins bypass with `is_super_admin = true`
- All database functions must use `SECURITY DEFINER` with `SET search_path = public`

---

#### Work Completed So Far

**TypeScript Types (COMPLETE)**:
- `src/features/training-modules/types/training-module.types.ts` — 545 lines, full type definitions for all entities, constants, form inputs, and RPC result types

**Services (COMPLETE — 6 files)**:
- `src/features/training-modules/services/trainingModuleService.ts` — CRUD, publish, list with filters
- `src/features/training-modules/services/trainingLessonService.ts` — CRUD, reorder, content block CRUD, getWithContent
- `src/features/training-modules/services/trainingQuizService.ts` — getByLessonId, getAttempts, submitAttempt (via RPC)
- `src/features/training-modules/services/trainingProgressService.ts` — getByModule, getModuleProgressSummary (RPC), startLesson, completeLesson (RPC)
- `src/features/training-modules/services/trainingAssignmentService.ts` — listByModule, listMyAssignments, create, revoke
- `src/features/training-modules/services/trainingGamificationService.ts` — getUserStats, getXpHistory, listBadges, getUserBadges, getLeaderboard (RPC), getSkillRadarData (RPC), listCertifications, getUserCertifications, listChallenges, joinChallenge

All services import from `@/services/base/supabase`.

**Hooks (COMPLETE — 7 files)**:
- `src/features/training-modules/hooks/useTrainingModules.ts`
- `src/features/training-modules/hooks/useTrainingLessons.ts`
- `src/features/training-modules/hooks/useTrainingProgress.ts`
- `src/features/training-modules/hooks/useQuizAttempts.ts`
- `src/features/training-modules/hooks/useTrainingAssignments.ts`
- `src/features/training-modules/hooks/useTrainingGamification.ts`
- `src/features/training-modules/hooks/useTrainingAnalytics.ts` (placeholder — just exports query keys)

**Shared Components (COMPLETE — 4 files)**:
- `ModuleStatusBadge.tsx`, `ProgressBar.tsx`, `CategoryBadge.tsx`, `DifficultyBadge.tsx`

**Learner Components (COMPLETE — 7 files)**:
- `MyTrainingPage.tsx`, `ModuleCard.tsx`, `ModulePlayer.tsx`, `LessonViewer.tsx`
- `ContentBlockRenderer.tsx`, `QuizPlayer.tsx`, `QuizResults.tsx`

**Gamification Components (COMPLETE — 9 files)**:
- `XpDisplay.tsx`, `StreakIndicator.tsx`, `BadgeCard.tsx`, `BadgeGrid.tsx`
- `LeaderboardTable.tsx`, `ChallengeCard.tsx`, `ChallengeList.tsx`
- `CertificationCard.tsx`, `CertificationList.tsx`

**Feature Index**:
- `src/features/training-modules/index.ts` — exports types only

**Subscription Feature Flags (TypeScript updated)**:
- `recruiting_basic`, `recruiting_custom_pipeline`, `custom_branding` added to SubscriptionFeatures and FEATURE_DISPLAY_NAMES

**BasicRecruitingView (uncommitted)**:
- "Resend password setup email" button with `useResendInvite` — 42 lines added

---

#### Known TypeScript Errors

1. **Import path `@/services/base/supabase`**: All 6 services import supabase client from this path. Verify it resolves correctly (the module exists at `src/services/base/index.ts` which should re-export it).
2. **Route types**: `ModuleCard.tsx` and `ModulePlayer.tsx` use routes `/my-training/$moduleId` and `/my-training` which are not yet registered in TanStack Router — routes need to be created (Task #9).
3. **`useTrainingAnalytics.ts`**: References `trainingGamificationService.getTeamAnalytics` which doesn't exist in the gamification service. The analytics hook is a placeholder — needs real implementation with Admin dashboard.
4. **`user!.id!` pattern**: Some hooks may still use `user!.id` instead of the project's `user!.id!` pattern (double non-null assertion needed because `user` is `Partial<UserProfile>`).

---

#### Work Remaining

**Priority 1: Database Migrations (BLOCKING — app won't function without these)**

Create migration files for all training module tables listed above in "Data Model / Schema State". The migrations must:
- Use `imo_id` on every table for tenant isolation
- Include RLS policies (staff can manage, users can read published, users can track own progress)
- Include the 5 RPCs (complete_training_lesson, submit_training_quiz_attempt, get_training_leaderboard, get_skill_radar_data, get_module_progress_summary)
- Use SECURITY DEFINER for all functions
- Apply via: `./scripts/migrations/run-migration.sh supabase/migrations/FILE.sql`
- After migrations: regenerate `database.types.ts`

**Priority 2: Module Builder UI (NOT YET CREATED)**

Build admin components for creating/editing training modules:
- `ModuleBuilderPage` — main 3-panel builder
- `LessonEditor` — edit lesson content
- `ContentBlockEditor` — edit content blocks within lessons
- `ContentBlockList` — sortable list of content blocks
- `QuizBuilder` — build quiz questions and options
- `ModuleSettingsPanel` — module metadata settings
- `LessonList` — sortable list of lessons

**Priority 3: Fix TypeScript Errors**

- Fix supabase import path if needed
- Create training module routes in TanStack Router (`/my-training`, `/my-training/$moduleId`)
- Fix `useTrainingAnalytics.ts` (remove reference to non-existent `getTeamAnalytics`)
- Fix `user!.id` → `user!.id!` across hooks if needed

**Priority 4: Analytics Dashboard & Admin**

- `TrainingAnalyticsDashboard`, `TeamProgressTable`, charts
- `BadgeManager`, `CertificationManager`, `ChallengeManager`, `AssignModuleDialog`

**Priority 5: Route Integration**

- Add routes to `router.tsx` for `/my-training` and `/my-training/$moduleId`
- Update `Sidebar.tsx` with nav items
- Add Modules tab to existing `TrainingHubPage`

**Priority 6: Build & Deploy**

- Run `npm run build` — must pass with zero errors
- Verify runtime (no loading errors)
- Commit all training modules changes
- Commit BasicRecruitingView resend invite changes separately

---

#### Constraints & Non-Negotiables

1. **Migration runner ONLY**: `./scripts/migrations/run-migration.sh` — NEVER direct psql
2. **Regenerate types after migration**: `npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts`
3. **Zero TypeScript errors**: `npm run build` must pass
4. **No mock data in production code**
5. **No schema guessing**: If unsure about existing tables/columns, query the database first
6. **Feature-based architecture**: All training module code under `src/features/training-modules/`
7. **RLS required**: All new tables must have RLS policies with IMO-scoped tenancy
8. **SECURITY DEFINER** required for all database functions with `SET search_path = public`
9. **No useMemo/useCallback** in React components (React 19 project)
10. **Test after changes**: Run scripts to verify app compiles with no loading errors
11. **Active plans go in `plans/active/`**, not root directory
12. **Import pattern**: Services use `import { supabase } from "@/services/base/supabase"`
13. **Auth pattern**: `user` is `Partial<UserProfile> | null` — use `user!.id!` in guarded query functions

---

#### Required Next Output

Start with **Priority 1**: Create the database migration files for the training modules schema. The TypeScript types at `src/features/training-modules/types/training-module.types.ts` define the exact schema needed — use it as the source of truth for column names, types, and relationships.

After migrations are created and applied:
1. Regenerate `database.types.ts`
2. Verify supabase import path resolves
3. Build Module Builder UI components
4. Fix all remaining TypeScript errors
5. Create routes and sidebar integration
6. Run `npm run build` and verify zero errors
