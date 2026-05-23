-- Backfill: 5 prod recruits stranded with ownership but no pipeline enrollment.
-- All 5 are in Founders Financial Group (imo_id ffffffff-ffff-ffff-ffff-ffffffffffff)
-- and predate the enrollment fix in commit 88389eb9 + migration 20260520094801.
-- initialize_recruit_progress is idempotent; safe to re-run.

BEGIN;

UPDATE user_profiles
   SET pipeline_template_id = 'c24402ae-18a2-41fd-b2d3-06414e4d9f20',
       updated_at = NOW()
 WHERE id IN (
         'd0c7fce6-a474-4d93-b2b7-000e4f71a119', -- michael.wilson6921@gmail.com
         '688d0f83-9bc0-4c97-9047-caf442333c92', -- zachthesolatguy@gmail.com
         'bbf95aae-6eca-4551-ac44-742acbf241d9', -- kferg88@gmail.com
         '482f4ebd-3795-4453-80b5-2a757b03a73e', -- rmartens42@gmail.com
         '93b12221-46c2-4928-872d-c8c0be8075e6'  -- mitchmiesner@gmail.com
       )
   AND pipeline_template_id IS NULL;

SELECT up.email,
       initialize_recruit_progress(up.id, 'c24402ae-18a2-41fd-b2d3-06414e4d9f20') AS result
  FROM user_profiles up
 WHERE up.id IN (
         'd0c7fce6-a474-4d93-b2b7-000e4f71a119',
         '688d0f83-9bc0-4c97-9047-caf442333c92',
         'bbf95aae-6eca-4551-ac44-742acbf241d9',
         '482f4ebd-3795-4453-80b5-2a757b03a73e',
         '93b12221-46c2-4928-872d-c8c0be8075e6'
       )
 ORDER BY up.email;

COMMIT;

-- Post-condition verification
SELECT up.email,
       up.pipeline_template_id IS NOT NULL AS has_template,
       (SELECT COUNT(*) FROM recruit_phase_progress rpp WHERE rpp.user_id = up.id) AS phase_rows
  FROM user_profiles up
 WHERE up.id IN (
         'd0c7fce6-a474-4d93-b2b7-000e4f71a119',
         '688d0f83-9bc0-4c97-9047-caf442333c92',
         'bbf95aae-6eca-4551-ac44-742acbf241d9',
         '482f4ebd-3795-4453-80b5-2a757b03a73e',
         '93b12221-46c2-4928-872d-c8c0be8075e6'
       )
 ORDER BY up.email;
