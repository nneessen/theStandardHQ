BEGIN;

SET LOCAL search_path = public;

SELECT set_config('app.book_duplication_mode', 'on', true);

CREATE TEMP TABLE tmp_book_dup_context (
  source_imo_id uuid NOT NULL,
  target_imo_id uuid NOT NULL,
  batch_label text NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_book_dup_context (source_imo_id, target_imo_id, batch_label)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  '89514211-f2bd-4440-9527-90a472c5e622'::uuid,
  'ffg_to_epic_2026_05_24_four_agents_general_expenses'
);

CREATE TEMP TABLE tmp_book_dup_user_map (
  source_user_id uuid PRIMARY KEY,
  target_user_id uuid NOT NULL,
  target_agency_id uuid
) ON COMMIT DROP;

INSERT INTO tmp_book_dup_user_map (source_user_id, target_user_id, target_agency_id)
SELECT
  seed.source_user_id,
  seed.target_user_id,
  up.agency_id
FROM (
  VALUES
    (
      '88791683-be7d-4ea7-8b62-b0d9cf905a85'::uuid,
      '453c718c-186f-49ee-af57-53dc6ef90409'::uuid
    ),
    (
      '1ad4d5a8-369c-4bb8-871b-966683db350a'::uuid,
      'bd6a0cd1-18b9-4b26-a61a-498c44e75dac'::uuid
    ),
    (
      'd0d3edea-af6d-4990-80b8-1765ba829896'::uuid,
      '69559ef2-9350-44d3-81a1-5f59a2e6b42d'::uuid
    ),
    (
      '4936e301-33e7-4816-95c4-6d8838bad5b4'::uuid,
      '97d0dd80-314b-416f-9db2-9de57ac96b7f'::uuid
    )
) AS seed(source_user_id, target_user_id)
JOIN public.user_profiles up
  ON up.id = seed.target_user_id;

CREATE TEMP TABLE tmp_source_expenses_all ON COMMIT DROP AS
SELECT e.*
FROM public.expenses e
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = e.user_id
JOIN tmp_book_dup_context ctx
  ON ctx.source_imo_id = e.imo_id;

CREATE TEMP TABLE tmp_source_expenses_to_copy ON COMMIT DROP AS
SELECT se.*
FROM tmp_source_expenses_all se
JOIN tmp_book_dup_context ctx
  ON true
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'expense'
 AND existing_map.source_id = se.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

CREATE TEMP TABLE tmp_recurring_group_map ON COMMIT DROP AS
SELECT
  recurring_group_id AS source_recurring_group_id,
  gen_random_uuid() AS new_recurring_group_id
FROM (
  SELECT DISTINCT recurring_group_id
  FROM tmp_source_expenses_to_copy
  WHERE recurring_group_id IS NOT NULL
) groups_to_copy;

DO $$
DECLARE
  v_total_source_expenses integer := (SELECT count(*) FROM tmp_source_expenses_all);
  v_expenses_to_copy integer := (SELECT count(*) FROM tmp_source_expenses_to_copy);
  v_missing_target_agencies integer;
  v_non_mapped_lead_purchases integer;
BEGIN
  IF v_total_source_expenses = 0 THEN
    RAISE EXCEPTION 'No source FFG expenses found for the four-agent expense duplication batch';
  END IF;

  IF v_expenses_to_copy = 0 THEN
    RAISE EXCEPTION 'No unmapped source FFG expenses remain to copy for the four-agent Epic expense batch';
  END IF;

  SELECT count(*)
  INTO v_missing_target_agencies
  FROM tmp_book_dup_user_map
  WHERE target_agency_id IS NULL;

  IF v_missing_target_agencies > 0 THEN
    RAISE EXCEPTION
      'Cannot duplicate expenses: % target Epic users are missing agency assignments',
      v_missing_target_agencies;
  END IF;

  SELECT count(*)
  INTO v_non_mapped_lead_purchases
  FROM tmp_source_expenses_to_copy se
  LEFT JOIN public.epic_book_dup_map lp_map
    ON lp_map.entity_type = 'lead_purchase'
   AND lp_map.source_id = se.lead_purchase_id
   AND lp_map.target_imo_id = (SELECT target_imo_id FROM tmp_book_dup_context)
  WHERE se.lead_purchase_id IS NOT NULL
    AND lp_map.new_id IS NULL;

  IF v_non_mapped_lead_purchases > 0 THEN
    RAISE EXCEPTION
      'Cannot duplicate expenses: % expense rows reference lead purchases that have not been duplicated into Epic',
      v_non_mapped_lead_purchases;
  END IF;
END $$;

CREATE TEMP TABLE tmp_new_expenses ON COMMIT DROP AS
SELECT
  se.id AS source_id,
  gen_random_uuid() AS new_id,
  um.target_user_id,
  um.target_agency_id,
  rgm.new_recurring_group_id,
  lp_map.new_id AS new_lead_purchase_id
FROM tmp_source_expenses_to_copy se
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = se.user_id
LEFT JOIN tmp_recurring_group_map rgm
  ON rgm.source_recurring_group_id = se.recurring_group_id
LEFT JOIN public.epic_book_dup_map lp_map
  ON lp_map.entity_type = 'lead_purchase'
 AND lp_map.source_id = se.lead_purchase_id
 AND lp_map.target_imo_id = (SELECT target_imo_id FROM tmp_book_dup_context);

INSERT INTO public.expenses (
  id,
  user_id,
  description,
  amount,
  category,
  date,
  is_recurring,
  recurring_frequency,
  receipt_url,
  notes,
  created_at,
  updated_at,
  expense_type,
  name,
  is_tax_deductible,
  recurring_group_id,
  recurring_end_date,
  imo_id,
  agency_id,
  lead_purchase_id
)
SELECT
  ne.new_id,
  ne.target_user_id,
  se.description,
  se.amount,
  se.category,
  se.date,
  se.is_recurring,
  se.recurring_frequency,
  se.receipt_url,
  se.notes,
  se.created_at,
  se.updated_at,
  se.expense_type,
  se.name,
  se.is_tax_deductible,
  ne.new_recurring_group_id,
  se.recurring_end_date,
  ctx.target_imo_id,
  ne.target_agency_id,
  ne.new_lead_purchase_id
FROM tmp_new_expenses ne
JOIN tmp_source_expenses_to_copy se
  ON se.id = ne.source_id
JOIN tmp_book_dup_context ctx
  ON true;

INSERT INTO public.epic_book_dup_map (
  entity_type,
  source_id,
  new_id,
  source_imo_id,
  target_imo_id,
  batch_label
)
SELECT
  'expense',
  ne.source_id,
  ne.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_expenses ne
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

DO $$
DECLARE
  v_target_imo uuid := (SELECT target_imo_id FROM tmp_book_dup_context);
  v_total_source_expenses integer := (SELECT count(*) FROM tmp_source_expenses_all);
  v_new_source_expenses integer := (SELECT count(*) FROM tmp_source_expenses_to_copy);
  v_total_mapped_expenses integer;
  v_total_target_expenses integer;
  v_new_target_expenses integer;
BEGIN
  SELECT count(*)
  INTO v_total_mapped_expenses
  FROM public.epic_book_dup_map
  WHERE entity_type = 'expense'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_expenses_all);

  IF v_total_mapped_expenses <> v_total_source_expenses THEN
    RAISE EXCEPTION
      'Expense duplication verification failed. expected total mapped=% actual=%',
      v_total_source_expenses,
      v_total_mapped_expenses;
  END IF;

  SELECT count(*)
  INTO v_total_target_expenses
  FROM public.expenses e
  JOIN public.epic_book_dup_map m
    ON m.new_id = e.id
  WHERE m.entity_type = 'expense'
    AND m.target_imo_id = v_target_imo
    AND m.source_id IN (SELECT id FROM tmp_source_expenses_all);

  IF v_total_target_expenses <> v_total_source_expenses THEN
    RAISE EXCEPTION
      'Expense target-row verification failed. expected total target=% actual=%',
      v_total_source_expenses,
      v_total_target_expenses;
  END IF;

  SELECT count(*)
  INTO v_new_target_expenses
  FROM public.expenses e
  JOIN public.epic_book_dup_map m
    ON m.new_id = e.id
  WHERE m.entity_type = 'expense'
    AND m.target_imo_id = v_target_imo
    AND m.batch_label = (SELECT batch_label FROM tmp_book_dup_context)
    AND m.source_id IN (SELECT id FROM tmp_source_expenses_to_copy);

  IF v_new_target_expenses <> v_new_source_expenses THEN
    RAISE EXCEPTION
      'Expense batch-row verification failed. expected new=% actual=%',
      v_new_source_expenses,
      v_new_target_expenses;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.expenses e
    JOIN public.epic_book_dup_map m
      ON m.new_id = e.id
    WHERE m.entity_type = 'expense'
      AND m.target_imo_id = v_target_imo
      AND m.source_id IN (SELECT id FROM tmp_source_expenses_all)
      AND e.imo_id <> v_target_imo
  ) THEN
    RAISE EXCEPTION 'Duplicated Epic expenses reference the wrong IMO';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.expenses e
    JOIN public.epic_book_dup_map m
      ON m.new_id = e.id
    JOIN tmp_source_expenses_to_copy se
      ON se.id = m.source_id
    WHERE m.entity_type = 'expense'
      AND m.target_imo_id = v_target_imo
      AND m.batch_label = (SELECT batch_label FROM tmp_book_dup_context)
      AND se.lead_purchase_id IS NULL
      AND e.lead_purchase_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Non-lead-purchase Epic expenses were linked to lead purchases unexpectedly';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.expenses e
    JOIN public.epic_book_dup_map m
      ON m.new_id = e.id
    JOIN tmp_source_expenses_to_copy se
      ON se.id = m.source_id
    LEFT JOIN tmp_recurring_group_map rgm
      ON rgm.source_recurring_group_id = se.recurring_group_id
    WHERE m.entity_type = 'expense'
      AND m.target_imo_id = v_target_imo
      AND m.batch_label = (SELECT batch_label FROM tmp_book_dup_context)
      AND (
        (se.recurring_group_id IS NULL AND e.recurring_group_id IS NOT NULL)
        OR (se.recurring_group_id IS NOT NULL AND e.recurring_group_id IS DISTINCT FROM rgm.new_recurring_group_id)
      )
  ) THEN
    RAISE EXCEPTION 'Recurring group remap verification failed for duplicated Epic expenses';
  END IF;

  RAISE NOTICE
    'FFG->Epic general expense duplication verified for batch %: total mapped %, newly inserted %, recurring groups remapped %',
    (SELECT batch_label FROM tmp_book_dup_context),
    v_total_source_expenses,
    v_new_source_expenses,
    (SELECT count(*) FROM tmp_recurring_group_map);
END $$;

COMMIT;
