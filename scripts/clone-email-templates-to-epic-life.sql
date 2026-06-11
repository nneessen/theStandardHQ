-- Clone selected "The Standard HQ" / FFG email templates into Epic Life as
-- Epic-OWNED, EDITABLE copies (so Epic Life admins can rebrand them).
--
-- WHY copies and not a move: `email_templates.name` has a UNIQUE constraint and
-- the global SELECT RLS has no IMO filter, so the originals are already visible
-- everywhere — they just aren't Epic-editable (UPDATE/DELETE is gated by
-- creator.imo_id = effective imo). New Epic-owned rows under new names fix that.
--
-- DELIBERATELY EXCLUDED:
--   * Billing/system templates (payment_failed, subscription_welcome,
--     grandfather_expiring, subscription_*, AI SMS Bot) — looked up BY NAME in
--     supabase/functions/stripe-webhook; duplicating/renaming would break them.
--   * "Sales Tracking … No More Manual Slack Posts" — references the removed
--     Slack feature (dead).
--
-- Idempotent: ON CONFLICT (name) DO NOTHING — safe to re-run.

DO $$
DECLARE
  -- epiclife.neessen@gmail.com, imo_id = Epic Life (89514211-…)
  v_epic_owner uuid := '69559ef2-9350-44d3-81a1-5f59a2e6b42d';
  v_inserted   int;
BEGIN
  WITH rename_map(old_name, new_name) AS (
    VALUES
      ('Recruit - Welcome to The Standard HQ',
       'Recruit - Welcome to Epic Life'),
      ('Recruit - Congratulations, You Graduated!',
       'Recruit - Congratulations, You Graduated! · Epic Life'),
      ('New Lead Pack Purchased',
       'New Lead Pack Purchased · Epic Life')
  )
  INSERT INTO public.email_templates (
    id, name, subject, body_html, body_text, category, blocks, variables,
    is_active, is_global, is_block_template, created_by, usage_count
  )
  SELECT
    gen_random_uuid(),
    rm.new_name,
    et.subject, et.body_html, et.body_text, et.category, et.blocks, et.variables,
    true,             -- is_active
    true,             -- is_global (org-wide; Epic admins can edit via creator.imo gate)
    et.is_block_template,
    v_epic_owner,     -- created_by → Epic Life admin (makes the copy Epic-editable)
    0                 -- usage_count
  FROM public.email_templates et
  JOIN rename_map rm ON rm.old_name = et.name
  ON CONFLICT (name) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'Epic Life email-template copies inserted: %', v_inserted;
END $$;
