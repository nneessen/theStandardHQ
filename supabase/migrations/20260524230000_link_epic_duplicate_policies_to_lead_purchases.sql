BEGIN;

SET LOCAL search_path = public;

SELECT set_config('app.book_duplication_mode', 'on', true);

ALTER TABLE public.epic_book_dup_map
  DROP CONSTRAINT IF EXISTS epic_book_dup_map_entity_type_check;

ALTER TABLE public.epic_book_dup_map
  ADD CONSTRAINT epic_book_dup_map_entity_type_check CHECK (
    entity_type IN (
      'carrier',
      'product',
      'client',
      'policy',
      'commission',
      'bot_attribution',
      'lead_vendor',
      'expense',
      'lead_purchase'
    )
  );

CREATE TEMP TABLE tmp_book_dup_context (
  source_imo_id uuid NOT NULL,
  target_imo_id uuid NOT NULL,
  batch_label text NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_book_dup_context (source_imo_id, target_imo_id, batch_label)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  '89514211-f2bd-4440-9527-90a472c5e622'::uuid,
  'ffg_to_epic_2026_05_24_four_agents_lead_purchases'
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

CREATE TEMP TABLE tmp_source_policies_with_leads ON COMMIT DROP AS
SELECT
  p.id AS source_policy_id,
  p.user_id AS source_user_id,
  p.lead_purchase_id AS source_lead_purchase_id
FROM public.policies p
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = p.user_id
JOIN tmp_book_dup_context ctx
  ON ctx.source_imo_id = p.imo_id
WHERE p.lead_purchase_id IS NOT NULL;

CREATE TEMP TABLE tmp_source_lead_purchases ON COMMIT DROP AS
SELECT lp.*
FROM public.lead_purchases lp
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = lp.user_id
JOIN tmp_book_dup_context ctx
  ON ctx.source_imo_id = lp.imo_id;

CREATE TEMP TABLE tmp_source_lead_vendors ON COMMIT DROP AS
SELECT DISTINCT lv.*
FROM public.lead_vendors lv
JOIN tmp_source_lead_purchases slp
  ON slp.vendor_id = lv.id;

CREATE TEMP TABLE tmp_source_expenses ON COMMIT DROP AS
SELECT DISTINCT e.*
FROM public.expenses e
JOIN tmp_source_lead_purchases slp
  ON slp.expense_id = e.id;

CREATE TEMP TABLE tmp_vendor_owner_map ON COMMIT DROP AS
SELECT
  slv.id AS source_vendor_id,
  COALESCE(creator_um.target_user_id, fallback_owner.target_user_id) AS target_created_by
FROM tmp_source_lead_vendors slv
LEFT JOIN tmp_book_dup_user_map creator_um
  ON creator_um.source_user_id = slv.created_by
LEFT JOIN LATERAL (
  SELECT um.target_user_id
  FROM tmp_source_lead_purchases slp
  JOIN tmp_book_dup_user_map um
    ON um.source_user_id = slp.user_id
  WHERE slp.vendor_id = slv.id
  ORDER BY slp.purchase_date, slp.created_at, slp.id
  LIMIT 1
) fallback_owner
  ON true;

DO $$
DECLARE
  v_target_imo uuid := (SELECT target_imo_id FROM tmp_book_dup_context);
  v_missing_target_policy_links integer;
  v_vendor_collisions text;
  v_missing_vendor_owners integer;
  v_missing_purchase_owners integer;
  v_missing_expense_owners integer;
  v_missing_target_agencies integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tmp_source_policies_with_leads) THEN
    RAISE EXCEPTION 'No source policies with lead_purchase_id were found for the four-agent duplication batch';
  END IF;

  SELECT count(*)
  INTO v_missing_target_policy_links
  FROM tmp_source_policies_with_leads sp
  LEFT JOIN public.epic_book_dup_map policy_map
    ON policy_map.entity_type = 'policy'
   AND policy_map.source_id = sp.source_policy_id
   AND policy_map.target_imo_id = v_target_imo
  WHERE policy_map.new_id IS NULL;

  IF v_missing_target_policy_links > 0 THEN
    RAISE EXCEPTION
      'Cannot relink lead purchases: % duplicated Epic policies are missing from epic_book_dup_map',
      v_missing_target_policy_links;
  END IF;

  SELECT string_agg(name, ', ' ORDER BY name)
  INTO v_vendor_collisions
  FROM (
    SELECT DISTINCT src.name
    FROM tmp_source_lead_vendors src
    JOIN public.lead_vendors existing
      ON existing.imo_id = v_target_imo
     AND lower(existing.name) = lower(src.name)
    LEFT JOIN public.epic_book_dup_map existing_map
      ON existing_map.entity_type = 'lead_vendor'
     AND existing_map.source_id = src.id
     AND existing_map.target_imo_id = v_target_imo
    WHERE existing_map.source_id IS NULL
  ) collisions;

  IF v_vendor_collisions IS NOT NULL THEN
    RAISE EXCEPTION
      'Epic lead vendor name collisions detected; aborting lead purchase duplication: %',
      v_vendor_collisions;
  END IF;

  SELECT count(*)
  INTO v_missing_vendor_owners
  FROM tmp_vendor_owner_map
  WHERE target_created_by IS NULL;

  IF v_missing_vendor_owners > 0 THEN
    RAISE EXCEPTION
      'Cannot duplicate lead vendors: % source vendors have no mappable Epic owner',
      v_missing_vendor_owners;
  END IF;

  SELECT count(*)
  INTO v_missing_purchase_owners
  FROM tmp_source_lead_purchases slp
  LEFT JOIN tmp_book_dup_user_map um
    ON um.source_user_id = slp.user_id
  WHERE um.source_user_id IS NULL;

  IF v_missing_purchase_owners > 0 THEN
    RAISE EXCEPTION
      'Cannot duplicate lead purchases: % source lead purchases are owned by users outside the approved four-agent map',
      v_missing_purchase_owners;
  END IF;

  SELECT count(*)
  INTO v_missing_expense_owners
  FROM tmp_source_expenses se
  LEFT JOIN tmp_book_dup_user_map um
    ON um.source_user_id = se.user_id
  WHERE se.user_id IS NOT NULL
    AND um.source_user_id IS NULL;

  IF v_missing_expense_owners > 0 THEN
    RAISE EXCEPTION
      'Cannot duplicate lead purchase expenses: % source expenses are owned by users outside the approved four-agent map',
      v_missing_expense_owners;
  END IF;

  SELECT count(*)
  INTO v_missing_target_agencies
  FROM tmp_book_dup_user_map
  WHERE target_agency_id IS NULL;

  IF v_missing_target_agencies > 0 THEN
    RAISE EXCEPTION
      'Cannot duplicate lead purchases: % target Epic users are missing agency assignments',
      v_missing_target_agencies;
  END IF;
END $$;

CREATE TEMP TABLE tmp_new_lead_vendors ON COMMIT DROP AS
SELECT
  slv.id AS source_id,
  gen_random_uuid() AS new_id,
  vom.target_created_by
FROM tmp_source_lead_vendors slv
JOIN tmp_vendor_owner_map vom
  ON vom.source_vendor_id = slv.id
JOIN tmp_book_dup_context ctx
  ON true
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'lead_vendor'
 AND existing_map.source_id = slv.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

INSERT INTO public.lead_vendors (
  id,
  imo_id,
  created_by,
  name,
  contact_name,
  contact_email,
  contact_phone,
  website,
  notes,
  created_at,
  updated_at
)
SELECT
  nlv.new_id,
  ctx.target_imo_id,
  nlv.target_created_by,
  slv.name,
  slv.contact_name,
  slv.contact_email,
  slv.contact_phone,
  slv.website,
  slv.notes,
  slv.created_at,
  slv.updated_at
FROM tmp_new_lead_vendors nlv
JOIN tmp_source_lead_vendors slv
  ON slv.id = nlv.source_id
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
  'lead_vendor',
  nlv.source_id,
  nlv.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_lead_vendors nlv
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

CREATE TEMP TABLE tmp_new_expenses ON COMMIT DROP AS
SELECT
  se.id AS source_id,
  gen_random_uuid() AS new_id,
  um.target_user_id,
  um.target_agency_id
FROM tmp_source_expenses se
LEFT JOIN tmp_book_dup_user_map um
  ON um.source_user_id = se.user_id
JOIN tmp_book_dup_context ctx
  ON true
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'expense'
 AND existing_map.source_id = se.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

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
  se.recurring_group_id,
  se.recurring_end_date,
  ctx.target_imo_id,
  ne.target_agency_id,
  NULL
FROM tmp_new_expenses ne
JOIN tmp_source_expenses se
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

CREATE TEMP TABLE tmp_new_lead_purchases ON COMMIT DROP AS
SELECT
  slp.id AS source_id,
  gen_random_uuid() AS new_id,
  um.target_user_id,
  um.target_agency_id,
  vendor_map.new_id AS new_vendor_id,
  expense_map.new_id AS new_expense_id
FROM tmp_source_lead_purchases slp
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = slp.user_id
JOIN tmp_book_dup_context ctx
  ON true
JOIN public.epic_book_dup_map vendor_map
  ON vendor_map.entity_type = 'lead_vendor'
 AND vendor_map.source_id = slp.vendor_id
 AND vendor_map.target_imo_id = ctx.target_imo_id
LEFT JOIN public.epic_book_dup_map expense_map
  ON expense_map.entity_type = 'expense'
 AND expense_map.source_id = slp.expense_id
 AND expense_map.target_imo_id = ctx.target_imo_id
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'lead_purchase'
 AND existing_map.source_id = slp.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

INSERT INTO public.lead_purchases (
  id,
  user_id,
  imo_id,
  agency_id,
  expense_id,
  vendor_id,
  purchase_name,
  lead_freshness,
  lead_count,
  total_cost,
  purchase_date,
  policies_sold,
  commission_earned,
  notes,
  created_at,
  updated_at
)
SELECT
  nlp.new_id,
  nlp.target_user_id,
  ctx.target_imo_id,
  nlp.target_agency_id,
  nlp.new_expense_id,
  nlp.new_vendor_id,
  slp.purchase_name,
  slp.lead_freshness,
  slp.lead_count,
  slp.total_cost,
  slp.purchase_date,
  0,
  0,
  slp.notes,
  slp.created_at,
  slp.updated_at
FROM tmp_new_lead_purchases nlp
JOIN tmp_source_lead_purchases slp
  ON slp.id = nlp.source_id
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
  'lead_purchase',
  nlp.source_id,
  nlp.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_lead_purchases nlp
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

UPDATE public.expenses e
SET lead_purchase_id = lead_purchase_map.new_id
FROM tmp_source_lead_purchases slp
JOIN tmp_book_dup_context ctx
  ON true
JOIN public.epic_book_dup_map expense_map
  ON expense_map.entity_type = 'expense'
 AND expense_map.source_id = slp.expense_id
 AND expense_map.target_imo_id = ctx.target_imo_id
JOIN public.epic_book_dup_map lead_purchase_map
  ON lead_purchase_map.entity_type = 'lead_purchase'
 AND lead_purchase_map.source_id = slp.id
 AND lead_purchase_map.target_imo_id = ctx.target_imo_id
WHERE slp.expense_id IS NOT NULL
  AND e.id = expense_map.new_id
  AND e.lead_purchase_id IS DISTINCT FROM lead_purchase_map.new_id;

UPDATE public.policies p
SET
  lead_purchase_id = lead_purchase_map.new_id,
  lead_source_type = 'lead_purchase'::public.lead_source_type
FROM tmp_source_policies_with_leads sp
JOIN tmp_book_dup_context ctx
  ON true
JOIN public.epic_book_dup_map policy_map
  ON policy_map.entity_type = 'policy'
 AND policy_map.source_id = sp.source_policy_id
 AND policy_map.target_imo_id = ctx.target_imo_id
JOIN public.epic_book_dup_map lead_purchase_map
  ON lead_purchase_map.entity_type = 'lead_purchase'
 AND lead_purchase_map.source_id = sp.source_lead_purchase_id
 AND lead_purchase_map.target_imo_id = ctx.target_imo_id
WHERE p.id = policy_map.new_id
  AND (
    p.lead_purchase_id IS DISTINCT FROM lead_purchase_map.new_id
    OR p.lead_source_type IS DISTINCT FROM 'lead_purchase'::public.lead_source_type
  );

DO $$
DECLARE
  v_target_imo uuid := (SELECT target_imo_id FROM tmp_book_dup_context);
  v_lead_purchase_id uuid;
BEGIN
  FOR v_lead_purchase_id IN
    SELECT m.new_id
    FROM public.epic_book_dup_map m
    WHERE m.entity_type = 'lead_purchase'
      AND m.target_imo_id = v_target_imo
      AND m.source_id IN (SELECT id FROM tmp_source_lead_purchases)
  LOOP
    PERFORM public.recalculate_lead_purchase_roi(v_lead_purchase_id);
  END LOOP;
END $$;

DO $$
DECLARE
  v_target_imo uuid := (SELECT target_imo_id FROM tmp_book_dup_context);
  v_source_vendors integer := (SELECT count(*) FROM tmp_source_lead_vendors);
  v_source_expenses integer := (SELECT count(*) FROM tmp_source_expenses);
  v_source_lead_purchases integer := (SELECT count(*) FROM tmp_source_lead_purchases);
  v_source_policies integer := (SELECT count(*) FROM tmp_source_policies_with_leads);
  v_mapped_vendors integer;
  v_mapped_expenses integer;
  v_mapped_lead_purchases integer;
  v_linked_target_policies integer;
BEGIN
  SELECT count(*)
  INTO v_mapped_vendors
  FROM public.epic_book_dup_map
  WHERE entity_type = 'lead_vendor'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_lead_vendors);

  SELECT count(*)
  INTO v_mapped_expenses
  FROM public.epic_book_dup_map
  WHERE entity_type = 'expense'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_expenses);

  SELECT count(*)
  INTO v_mapped_lead_purchases
  FROM public.epic_book_dup_map
  WHERE entity_type = 'lead_purchase'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_lead_purchases);

  IF v_source_vendors <> v_mapped_vendors THEN
    RAISE EXCEPTION
      'Lead vendor duplication verification failed. source=% mapped=%',
      v_source_vendors,
      v_mapped_vendors;
  END IF;

  IF v_source_expenses <> v_mapped_expenses THEN
    RAISE EXCEPTION
      'Lead purchase expense duplication verification failed. source=% mapped=%',
      v_source_expenses,
      v_mapped_expenses;
  END IF;

  IF v_source_lead_purchases <> v_mapped_lead_purchases THEN
    RAISE EXCEPTION
      'Lead purchase duplication verification failed. source=% mapped=%',
      v_source_lead_purchases,
      v_mapped_lead_purchases;
  END IF;

  SELECT count(*)
  INTO v_linked_target_policies
  FROM public.policies p
  JOIN public.epic_book_dup_map policy_map
    ON policy_map.new_id = p.id
   AND policy_map.entity_type = 'policy'
   AND policy_map.target_imo_id = v_target_imo
  JOIN tmp_source_policies_with_leads sp
    ON sp.source_policy_id = policy_map.source_id
  JOIN public.epic_book_dup_map lead_purchase_map
    ON lead_purchase_map.source_id = sp.source_lead_purchase_id
   AND lead_purchase_map.entity_type = 'lead_purchase'
   AND lead_purchase_map.target_imo_id = v_target_imo
  WHERE p.lead_purchase_id = lead_purchase_map.new_id
    AND p.lead_source_type = 'lead_purchase'::public.lead_source_type;

  IF v_source_policies <> v_linked_target_policies THEN
    RAISE EXCEPTION
      'Lead purchase policy relink verification failed. source policies=% linked target policies=%',
      v_source_policies,
      v_linked_target_policies;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.policies p
    JOIN public.epic_book_dup_map policy_map
      ON policy_map.new_id = p.id
     AND policy_map.entity_type = 'policy'
     AND policy_map.target_imo_id = v_target_imo
    JOIN tmp_source_policies_with_leads sp
      ON sp.source_policy_id = policy_map.source_id
    JOIN public.lead_purchases lp
      ON lp.id = p.lead_purchase_id
    WHERE lp.imo_id <> v_target_imo
  ) THEN
    RAISE EXCEPTION 'Relinked Epic policies reference lead purchases outside Epic IMO';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lead_purchases lp
    JOIN public.epic_book_dup_map purchase_map
      ON purchase_map.new_id = lp.id
     AND purchase_map.entity_type = 'lead_purchase'
     AND purchase_map.target_imo_id = v_target_imo
    WHERE purchase_map.source_id IN (SELECT id FROM tmp_source_lead_purchases)
      AND lp.vendor_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Duplicated Epic lead purchases are missing vendor links';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.expenses e
    JOIN public.epic_book_dup_map expense_map
      ON expense_map.new_id = e.id
     AND expense_map.entity_type = 'expense'
     AND expense_map.target_imo_id = v_target_imo
    JOIN tmp_source_lead_purchases slp
      ON slp.expense_id = expense_map.source_id
    JOIN public.epic_book_dup_map lead_purchase_map
      ON lead_purchase_map.source_id = slp.id
     AND lead_purchase_map.entity_type = 'lead_purchase'
     AND lead_purchase_map.target_imo_id = v_target_imo
    WHERE e.lead_purchase_id IS DISTINCT FROM lead_purchase_map.new_id
  ) THEN
    RAISE EXCEPTION 'Duplicated Epic lead purchase expenses were not mirrored back to their duplicated lead purchases';
  END IF;

  RAISE NOTICE
    'FFG->Epic lead purchase relink verified for batch %: vendors %, expenses %, lead purchases %, linked policies %',
    (SELECT batch_label FROM tmp_book_dup_context),
    v_source_vendors,
    v_source_expenses,
    v_source_lead_purchases,
    v_source_policies;
END $$;

COMMIT;
