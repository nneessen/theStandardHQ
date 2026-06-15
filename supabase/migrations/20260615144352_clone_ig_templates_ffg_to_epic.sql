-- Clone Instagram message templates from the sunset FFG IMO into Epic Life.
--
-- WHY: FFG is dead; users now act under Epic Life. The FFG->Epic migration
-- cloned quoting rates and roadmaps but never the Instagram message templates,
-- so Epic Life had ZERO templates while 749 active ones sat stranded under FFG
-- (hidden by per-IMO RLS). This backfills them.
--
-- SCOPE (prod data; local has no FFG source rows so this is a no-op there):
--   * 560 global templates (user_id IS NULL) -> cloned as global under Epic Life
--     (visible to ALL Epic Life users).
--   * 189 personal templates owned by nick's FFG account
--     (nickneessen@thestandardhq.com, d0d3edea-...) -> remapped to nick's Epic
--     Life account (epiclife.neessen@gmail.com, 69559ef2-...).
--
-- IDEMPOTENT: guarded by NOT EXISTS on (imo_id, user_id scope, name, content),
-- so re-running inserts nothing new.
--
-- ROLLBACK: Epic Life had 0 IG templates before this migration, so every Epic
-- template is a clone from here:
--   DELETE FROM instagram_message_templates
--   WHERE imo_id = '89514211-f2bd-4440-9527-90a472c5e622';

-- ── Global FFG templates -> Epic Life (kept global) ────────────────────────────
INSERT INTO instagram_message_templates
  (id, imo_id, user_id, name, content, category, use_count, last_used_at,
   is_active, message_stage, platform, created_by, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '89514211-f2bd-4440-9527-90a472c5e622'::uuid,           -- Epic Life
  NULL,
  t.name, t.content, t.category, t.use_count, t.last_used_at,
  t.is_active, t.message_stage, t.platform, t.created_by, now(), now()
FROM instagram_message_templates t
WHERE t.imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid -- FFG
  AND t.user_id IS NULL
  AND t.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM instagram_message_templates e
    WHERE e.imo_id = '89514211-f2bd-4440-9527-90a472c5e622'::uuid
      AND e.user_id IS NULL
      AND e.name = t.name
      AND e.content = t.content
  );

-- ── Personal FFG templates (nick) -> Epic Life (remapped to nick's Epic acct) ──
INSERT INTO instagram_message_templates
  (id, imo_id, user_id, name, content, category, use_count, last_used_at,
   is_active, message_stage, platform, created_by, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '89514211-f2bd-4440-9527-90a472c5e622'::uuid,           -- Epic Life
  '69559ef2-9350-44d3-81a1-5f59a2e6b42d'::uuid,           -- nick @ Epic Life
  t.name, t.content, t.category, t.use_count, t.last_used_at,
  t.is_active, t.message_stage, t.platform,
  '69559ef2-9350-44d3-81a1-5f59a2e6b42d'::uuid,           -- created_by = nick @ Epic
  now(), now()
FROM instagram_message_templates t
WHERE t.imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid -- FFG
  AND t.user_id = 'd0d3edea-af6d-4990-80b8-1765ba829896'::uuid -- nick @ FFG
  AND t.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM instagram_message_templates e
    WHERE e.imo_id = '89514211-f2bd-4440-9527-90a472c5e622'::uuid
      AND e.user_id = '69559ef2-9350-44d3-81a1-5f59a2e6b42d'::uuid
      AND e.name = t.name
      AND e.content = t.content
  );
