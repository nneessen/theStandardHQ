# Continuation: Presentations Feature — Deep Code Review

## Context

The Presentations feature allows agents to submit weekly video presentations (recorded via webcam or uploaded) for manager/staff review. A first-pass code review was completed and several fixes were applied, but a deeper production-grade review is needed.

## What Was Already Fixed (This Session)

1. **Agent UPDATE RLS** — Migration `20260211121625_fix_presentation_agent_update_rls.sql` added imo_id/agency_id immutability enforcement to prevent cross-tenant data leakage via direct API PATCH.
2. **Server-side review metadata** — DB trigger `set_presentation_review_metadata()` enforces `reviewed_at = NOW()` and `reviewed_by = auth.uid()` instead of trusting client values.
3. **Duplicate submission error** — Service `submit()` now catches Postgres error `23505` and shows "You already submitted a presentation for this week."
4. **`useUpdatePresentation` hook** — New mutation hook wrapping `service.update()` for agent title/description editing.
5. **Compliance query fix** — Changed `.eq("status", "approved")` → `.eq("approval_status", "approved")` (column didn't exist, was causing 400).
6. **Delete query cleanup** — Fixed signed URL 400 error after deletion by canceling in-flight queries and removing stale URL cache entries instead of blanket `invalidateQueries`.
7. **Camera error messages** — Added specific error messages for `NotAllowedError`, `NotFoundError`, `NotReadableError`, and non-HTTPS contexts.

## Files Touched This Session

- `supabase/migrations/20260211121625_fix_presentation_agent_update_rls.sql` (new)
- `src/features/training-modules/services/presentationSubmissionService.ts`
- `src/features/training-modules/hooks/usePresentationSubmissions.ts`
- `src/features/training-modules/components/presentations/PresentationReviewPanel.tsx`
- `src/features/training-modules/components/presentations/PresentationRecorder.tsx`
- `src/types/database.types.ts` (regenerated)

## What Still Needs Deep Review

Use the production-grade security-first code review guide (see CLAUDE.md or user's review prompt) against these 14 files:

### Migrations
- `supabase/migrations/20260210170611_presentation_submissions.sql`
- `supabase/migrations/20260210175530_fix_presentation_rls_security.sql`
- `supabase/migrations/20260211121625_fix_presentation_agent_update_rls.sql`

### Service Layer
- `src/features/training-modules/services/presentationSubmissionService.ts`

### Hooks
- `src/features/training-modules/hooks/usePresentationSubmissions.ts`

### Components
- `src/features/training-modules/components/presentations/PresentationRecordPage.tsx`
- `src/features/training-modules/components/presentations/PresentationDetailPage.tsx`
- `src/features/training-modules/components/presentations/PresentationReviewPanel.tsx`
- `src/features/training-modules/components/presentations/PresentationSubmissionList.tsx`
- `src/features/training-modules/components/presentations/PresentationComplianceTable.tsx`
- `src/features/training-modules/components/presentations/PresentationVideoPlayer.tsx`
- `src/features/training-modules/components/presentations/PresentationRecorder.tsx`
- `src/features/training-modules/components/presentations/PresentationUploader.tsx`
- `src/features/training-modules/components/presentations/PresentationWeekPicker.tsx`
- `src/features/training-modules/components/presentations/PresentationStatusBadge.tsx`

### Integration Points
- `src/features/training-modules/components/learner/MyTrainingPage.tsx` (presentations tab)
- `src/features/training-modules/hooks/useCanManageTraining.ts`
- `src/router.tsx` (presentation routes)

## Known Open Issues From First Review (Not Yet Fixed)

### Issue 1.2 — Agent UPDATE allows column tampering beyond title/description
The agent UPDATE RLS now validates imo_id/agency_id immutability, but agents can still UPDATE columns like `storage_path`, `file_name`, `file_size`, `mime_type`, `week_start`, `reviewed_by`, `reviewer_notes` via direct REST API. The trigger handles `reviewed_at`/`reviewed_by` but other columns are unprotected. Consider an RPC that whitelists only `title` and `description`.

### Issue 2.4 — Compliance query does not validate agencyId belongs to user's IMO
`getWeeklyCompliance()` takes `agencyId` from the client. A malicious client could pass a different agency's ID. The `user_profiles` RLS may or may not filter this — needs verification.

### Issue 2.5 — No pagination on submission list
`list()` returns ALL matching rows with no limit/offset. Will degrade as data grows.

### Issue 2.6 — Week picker allows navigating to future weeks
UX issue — empty compliance table for future weeks with no explanation.

### Issue 3.1 — `PresentationDetailPage.tsx:44` uses `window.confirm()`
Should use the app's confirmation dialog component for consistency.

### Issue 3.2 — Type casting bypasses safety
`as unknown as PresentationSubmission[]` double-cast in service methods.

### Issue 3.3 — `supported` recalculated every render
`getSupportedMimeType()` called on every render in PresentationRecorder.

### Issue 3.5 — `audio/webm` in allowed types
Audio-only uploads would show a black video player.

## Storage/Cost Concern
- Webcam recordings: ~1.5 Mbps → ~225 MB for 20-min max recording
- Upload limit: 500 MB per file
- At 100 agents × 52 weeks = ~1.1 TB/year minimum
- Supabase storage costs should be evaluated

## Instructions

1. Read all files listed above
2. Apply the production-grade security-first code review guide
3. Focus on: RLS exploit paths, data integrity, React Query correctness, UI/data alignment
4. Produce structured output per the review guide format
5. After review, implement fixes for any BLOCKING issues found
6. Run migration via `./scripts/migrations/run-migration.sh` if DB changes needed
7. Regenerate types if schema changes: `npx supabase gen types typescript --project-id pcyaqwodnyrpkaiojnpz > src/types/database.types.ts`
8. `npm run build` must pass with zero errors
