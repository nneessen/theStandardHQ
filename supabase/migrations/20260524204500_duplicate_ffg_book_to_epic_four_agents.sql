BEGIN;

SET LOCAL search_path = public;

SELECT set_config('app.book_duplication_mode', 'on', true);

CREATE TABLE IF NOT EXISTS public.epic_book_dup_map (
  entity_type text NOT NULL,
  source_id uuid NOT NULL,
  new_id uuid NOT NULL,
  source_imo_id uuid NOT NULL,
  target_imo_id uuid NOT NULL,
  batch_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epic_book_dup_map_pkey PRIMARY KEY (entity_type, source_id, target_imo_id),
  CONSTRAINT epic_book_dup_map_new_id_key UNIQUE (new_id),
  CONSTRAINT epic_book_dup_map_source_imo_id_fkey
    FOREIGN KEY (source_imo_id) REFERENCES public.imos(id),
  CONSTRAINT epic_book_dup_map_target_imo_id_fkey
    FOREIGN KEY (target_imo_id) REFERENCES public.imos(id),
  CONSTRAINT epic_book_dup_map_entity_type_check CHECK (
    entity_type IN (
      'carrier',
      'product',
      'client',
      'policy',
      'commission',
      'bot_attribution'
    )
  )
);

ALTER TABLE public.epic_book_dup_map ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.epic_book_dup_map FROM anon;
REVOKE ALL ON TABLE public.epic_book_dup_map FROM authenticated;
GRANT ALL ON TABLE public.epic_book_dup_map TO service_role;

CREATE INDEX IF NOT EXISTS idx_epic_book_dup_map_batch
  ON public.epic_book_dup_map (batch_label, entity_type, target_imo_id);

CREATE TEMP TABLE tmp_book_dup_context (
  source_imo_id uuid NOT NULL,
  target_imo_id uuid NOT NULL,
  batch_label text NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_book_dup_context (source_imo_id, target_imo_id, batch_label)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  '89514211-f2bd-4440-9527-90a472c5e622'::uuid,
  'ffg_to_epic_2026_05_24_four_agents'
);

CREATE TEMP TABLE tmp_book_dup_user_map (
  source_user_id uuid PRIMARY KEY,
  target_user_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_book_dup_user_map (source_user_id, target_user_id)
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
  );

CREATE TEMP TABLE tmp_source_policies ON COMMIT DROP AS
SELECT p.*
FROM public.policies p
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = p.user_id
JOIN tmp_book_dup_context ctx
  ON ctx.source_imo_id = p.imo_id;

CREATE TEMP TABLE tmp_source_carriers ON COMMIT DROP AS
SELECT DISTINCT c.*
FROM public.carriers c
JOIN tmp_source_policies sp
  ON sp.carrier_id = c.id;

CREATE TEMP TABLE tmp_source_products ON COMMIT DROP AS
SELECT DISTINCT pr.*
FROM public.products pr
JOIN tmp_source_policies sp
  ON sp.product_id = pr.id;

CREATE TEMP TABLE tmp_source_clients ON COMMIT DROP AS
SELECT DISTINCT c.*
FROM public.clients c
JOIN tmp_source_policies sp
  ON sp.client_id = c.id;

CREATE TEMP TABLE tmp_source_commissions ON COMMIT DROP AS
SELECT c.*
FROM public.commissions c
JOIN tmp_source_policies sp
  ON sp.id = c.policy_id
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = c.user_id;

CREATE TEMP TABLE tmp_source_bot_attributions ON COMMIT DROP AS
SELECT b.*
FROM public.bot_policy_attributions b
JOIN tmp_source_policies sp
  ON sp.id = b.policy_id
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = b.user_id;

DO $$
DECLARE
  v_target_imo uuid := (SELECT target_imo_id FROM tmp_book_dup_context);
  v_source_policy_count integer := (SELECT count(*) FROM tmp_source_policies);
  v_conflicting_carriers text;
  v_conflicting_codes text;
  v_policy_collisions text;
BEGIN
  IF v_source_policy_count = 0 THEN
    RAISE EXCEPTION 'No FFG source policies found for the four-agent duplication batch';
  END IF;

  SELECT string_agg(name, ', ' ORDER BY name)
  INTO v_conflicting_carriers
  FROM (
    SELECT DISTINCT src.name
    FROM tmp_source_carriers src
    JOIN public.carriers existing
      ON existing.imo_id = v_target_imo
     AND lower(existing.name) = lower(src.name)
  ) collisions;

  IF v_conflicting_carriers IS NOT NULL THEN
    RAISE EXCEPTION
      'Epic carrier name collisions detected; aborting duplication: %',
      v_conflicting_carriers;
  END IF;

  SELECT string_agg(code, ', ' ORDER BY code)
  INTO v_conflicting_codes
  FROM (
    SELECT DISTINCT src.code
    FROM tmp_source_carriers src
    JOIN public.carriers existing
      ON existing.imo_id = v_target_imo
     AND src.code IS NOT NULL
     AND existing.code IS NOT NULL
     AND upper(existing.code) = upper(src.code)
  ) collisions;

  IF v_conflicting_codes IS NOT NULL THEN
    RAISE EXCEPTION
      'Epic carrier code collisions detected; aborting duplication: %',
      v_conflicting_codes;
  END IF;

  SELECT string_agg(policy_number, ', ' ORDER BY policy_number)
  INTO v_policy_collisions
  FROM (
    SELECT DISTINCT sp.policy_number
    FROM tmp_source_policies sp
    JOIN tmp_book_dup_user_map um
      ON um.source_user_id = sp.user_id
    JOIN public.policies existing
      ON existing.imo_id = v_target_imo
     AND existing.user_id = um.target_user_id
     AND existing.policy_number = sp.policy_number
    WHERE sp.policy_number IS NOT NULL
    LIMIT 10
  ) collisions;

  IF v_policy_collisions IS NOT NULL THEN
    RAISE EXCEPTION
      'Epic policy_number collisions detected for target users; aborting duplication: %',
      v_policy_collisions;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_source_products
    WHERE build_chart_id IS NOT NULL
  ) THEN
    RAISE NOTICE
      'Source products include build_chart_id references; Epic duplicates will set build_chart_id = NULL';
  END IF;
END $$;

CREATE TEMP TABLE tmp_new_carriers ON COMMIT DROP AS
SELECT
  sc.id AS source_id,
  gen_random_uuid() AS new_id
FROM tmp_source_carriers sc
JOIN tmp_book_dup_context ctx
  ON true
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'carrier'
 AND existing_map.source_id = sc.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

INSERT INTO public.carriers (
  id,
  advance_cap,
  code,
  commission_structure,
  contact_info,
  contracting_metadata,
  created_at,
  imo_id,
  is_active,
  name,
  updated_at
)
SELECT
  nc.new_id,
  sc.advance_cap,
  sc.code,
  sc.commission_structure,
  sc.contact_info,
  sc.contracting_metadata,
  sc.created_at,
  ctx.target_imo_id,
  sc.is_active,
  sc.name,
  sc.updated_at
FROM tmp_new_carriers nc
JOIN tmp_source_carriers sc
  ON sc.id = nc.source_id
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
  'carrier',
  nc.source_id,
  nc.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_carriers nc
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

CREATE TEMP TABLE tmp_new_products ON COMMIT DROP AS
SELECT
  sp.id AS source_id,
  gen_random_uuid() AS new_id,
  carrier_map.new_id AS new_carrier_id
FROM tmp_source_products sp
JOIN tmp_book_dup_context ctx
  ON true
JOIN public.epic_book_dup_map carrier_map
  ON carrier_map.entity_type = 'carrier'
 AND carrier_map.source_id = sp.carrier_id
 AND carrier_map.target_imo_id = ctx.target_imo_id
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'product'
 AND existing_map.source_id = sp.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

INSERT INTO public.products (
  id,
  build_chart_id,
  carrier_id,
  code,
  commission_percentage,
  created_at,
  description,
  imo_id,
  is_active,
  max_age,
  max_face_amount,
  max_premium,
  metadata,
  min_age,
  min_face_amount,
  min_premium,
  name,
  product_type,
  updated_at
)
SELECT
  np.new_id,
  NULL,
  np.new_carrier_id,
  sp.code,
  sp.commission_percentage,
  sp.created_at,
  sp.description,
  ctx.target_imo_id,
  sp.is_active,
  sp.max_age,
  sp.max_face_amount,
  sp.max_premium,
  sp.metadata,
  sp.min_age,
  sp.min_face_amount,
  sp.min_premium,
  sp.name,
  sp.product_type,
  sp.updated_at
FROM tmp_new_products np
JOIN tmp_source_products sp
  ON sp.id = np.source_id
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
  'product',
  np.source_id,
  np.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_products np
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

CREATE TEMP TABLE tmp_new_clients ON COMMIT DROP AS
SELECT
  sc.id AS source_id,
  gen_random_uuid() AS new_id,
  um.target_user_id
FROM tmp_source_clients sc
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = sc.user_id
JOIN tmp_book_dup_context ctx
  ON true
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'client'
 AND existing_map.source_id = sc.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

INSERT INTO public.clients (
  id,
  address,
  created_at,
  date_of_birth,
  email,
  name,
  notes,
  phone,
  state,
  status,
  updated_at,
  user_id
)
SELECT
  nc.new_id,
  sc.address,
  sc.created_at,
  sc.date_of_birth,
  sc.email,
  sc.name,
  sc.notes,
  sc.phone,
  sc.state,
  sc.status,
  sc.updated_at,
  nc.target_user_id
FROM tmp_new_clients nc
JOIN tmp_source_clients sc
  ON sc.id = nc.source_id;

INSERT INTO public.epic_book_dup_map (
  entity_type,
  source_id,
  new_id,
  source_imo_id,
  target_imo_id,
  batch_label
)
SELECT
  'client',
  nc.source_id,
  nc.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_clients nc
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

CREATE TEMP TABLE tmp_new_policies ON COMMIT DROP AS
SELECT
  sp.id AS source_id,
  gen_random_uuid() AS new_id,
  um.target_user_id,
  carrier_map.new_id AS new_carrier_id,
  product_map.new_id AS new_product_id,
  client_map.new_id AS new_client_id
FROM tmp_source_policies sp
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = sp.user_id
JOIN tmp_book_dup_context ctx
  ON true
JOIN public.epic_book_dup_map carrier_map
  ON carrier_map.entity_type = 'carrier'
 AND carrier_map.source_id = sp.carrier_id
 AND carrier_map.target_imo_id = ctx.target_imo_id
LEFT JOIN public.epic_book_dup_map product_map
  ON product_map.entity_type = 'product'
 AND product_map.source_id = sp.product_id
 AND product_map.target_imo_id = ctx.target_imo_id
LEFT JOIN public.epic_book_dup_map client_map
  ON client_map.entity_type = 'client'
 AND client_map.source_id = sp.client_id
 AND client_map.target_imo_id = ctx.target_imo_id
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'policy'
 AND existing_map.source_id = sp.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

INSERT INTO public.policies (
  id,
  agency_id,
  annual_premium,
  cancellation_date,
  cancellation_reason,
  carrier_id,
  client_id,
  commission_percentage,
  created_at,
  effective_date,
  expiration_date,
  imo_id,
  lead_purchase_id,
  lead_source_type,
  lifecycle_status,
  monthly_premium,
  notes,
  payment_frequency,
  policy_number,
  product,
  product_id,
  referral_source,
  status,
  submit_date,
  term_length,
  updated_at,
  user_id
)
SELECT
  np.new_id,
  NULL,
  sp.annual_premium,
  sp.cancellation_date,
  sp.cancellation_reason,
  np.new_carrier_id,
  np.new_client_id,
  sp.commission_percentage,
  sp.created_at,
  sp.effective_date,
  sp.expiration_date,
  ctx.target_imo_id,
  NULL,
  sp.lead_source_type,
  sp.lifecycle_status,
  sp.monthly_premium,
  sp.notes,
  sp.payment_frequency,
  sp.policy_number,
  sp.product,
  np.new_product_id,
  sp.referral_source,
  sp.status,
  sp.submit_date,
  sp.term_length,
  sp.updated_at,
  np.target_user_id
FROM tmp_new_policies np
JOIN tmp_source_policies sp
  ON sp.id = np.source_id
JOIN tmp_book_dup_context ctx
  ON true;

UPDATE public.policies p
SET
  agency_id = NULL,
  lead_purchase_id = NULL
FROM tmp_new_policies np
WHERE p.id = np.new_id
  AND (p.agency_id IS NOT NULL OR p.lead_purchase_id IS NOT NULL);

INSERT INTO public.epic_book_dup_map (
  entity_type,
  source_id,
  new_id,
  source_imo_id,
  target_imo_id,
  batch_label
)
SELECT
  'policy',
  np.source_id,
  np.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_policies np
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

CREATE TEMP TABLE tmp_new_commissions ON COMMIT DROP AS
SELECT
  sc.id AS source_id,
  gen_random_uuid() AS new_id,
  um.target_user_id,
  policy_map.new_id AS new_policy_id
FROM tmp_source_commissions sc
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = sc.user_id
JOIN tmp_book_dup_context ctx
  ON true
JOIN public.epic_book_dup_map policy_map
  ON policy_map.entity_type = 'policy'
 AND policy_map.source_id = sc.policy_id
 AND policy_map.target_imo_id = ctx.target_imo_id
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'commission'
 AND existing_map.source_id = sc.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

INSERT INTO public.commissions (
  id,
  advance_months,
  amount,
  chargeback_amount,
  chargeback_date,
  chargeback_reason,
  created_at,
  earned_amount,
  imo_id,
  last_payment_date,
  month_number,
  months_paid,
  notes,
  original_advance,
  overage_amount,
  overage_start_month,
  payment_date,
  policy_id,
  related_advance_id,
  status,
  type,
  unearned_amount,
  updated_at,
  user_id
)
SELECT
  nc.new_id,
  sc.advance_months,
  sc.amount,
  sc.chargeback_amount,
  sc.chargeback_date,
  sc.chargeback_reason,
  sc.created_at,
  sc.earned_amount,
  ctx.target_imo_id,
  sc.last_payment_date,
  sc.month_number,
  sc.months_paid,
  sc.notes,
  sc.original_advance,
  sc.overage_amount,
  sc.overage_start_month,
  sc.payment_date,
  nc.new_policy_id,
  NULL,
  sc.status,
  sc.type,
  sc.unearned_amount,
  sc.updated_at,
  nc.target_user_id
FROM tmp_new_commissions nc
JOIN tmp_source_commissions sc
  ON sc.id = nc.source_id
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
  'commission',
  nc.source_id,
  nc.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_commissions nc
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

UPDATE public.commissions target_commission
SET related_advance_id = related_map.new_id
FROM tmp_book_dup_context ctx
JOIN public.epic_book_dup_map commission_map
  ON commission_map.entity_type = 'commission'
 AND commission_map.target_imo_id = ctx.target_imo_id
JOIN tmp_source_commissions sc
  ON sc.id = commission_map.source_id
JOIN public.epic_book_dup_map related_map
  ON related_map.entity_type = 'commission'
 AND related_map.source_id = sc.related_advance_id
 AND related_map.target_imo_id = ctx.target_imo_id
WHERE target_commission.id = commission_map.new_id
  AND sc.related_advance_id IS NOT NULL;

CREATE TEMP TABLE tmp_new_bot_attributions ON COMMIT DROP AS
SELECT
  sb.id AS source_id,
  gen_random_uuid() AS new_id,
  um.target_user_id,
  policy_map.new_id AS new_policy_id
FROM tmp_source_bot_attributions sb
JOIN tmp_book_dup_user_map um
  ON um.source_user_id = sb.user_id
JOIN tmp_book_dup_context ctx
  ON true
JOIN public.epic_book_dup_map policy_map
  ON policy_map.entity_type = 'policy'
 AND policy_map.source_id = sb.policy_id
 AND policy_map.target_imo_id = ctx.target_imo_id
LEFT JOIN public.epic_book_dup_map existing_map
  ON existing_map.entity_type = 'bot_attribution'
 AND existing_map.source_id = sb.id
 AND existing_map.target_imo_id = ctx.target_imo_id
WHERE existing_map.source_id IS NULL;

INSERT INTO public.bot_policy_attributions (
  id,
  attribution_type,
  confidence_score,
  conversation_started_at,
  created_at,
  external_appointment_id,
  external_conversation_id,
  lead_name,
  match_method,
  policy_id,
  updated_at,
  user_id
)
SELECT
  nb.new_id,
  sb.attribution_type,
  sb.confidence_score,
  sb.conversation_started_at,
  sb.created_at,
  sb.external_appointment_id,
  sb.external_conversation_id,
  sb.lead_name,
  sb.match_method,
  nb.new_policy_id,
  sb.updated_at,
  nb.target_user_id
FROM tmp_new_bot_attributions nb
JOIN tmp_source_bot_attributions sb
  ON sb.id = nb.source_id;

INSERT INTO public.epic_book_dup_map (
  entity_type,
  source_id,
  new_id,
  source_imo_id,
  target_imo_id,
  batch_label
)
SELECT
  'bot_attribution',
  nb.source_id,
  nb.new_id,
  ctx.source_imo_id,
  ctx.target_imo_id,
  ctx.batch_label
FROM tmp_new_bot_attributions nb
JOIN tmp_book_dup_context ctx
  ON true
ON CONFLICT (entity_type, source_id, target_imo_id) DO NOTHING;

DO $$
DECLARE
  v_target_imo uuid := (SELECT target_imo_id FROM tmp_book_dup_context);
  v_batch_label text := (SELECT batch_label FROM tmp_book_dup_context);
  v_source_carriers integer := (SELECT count(*) FROM tmp_source_carriers);
  v_source_products integer := (SELECT count(*) FROM tmp_source_products);
  v_source_clients integer := (SELECT count(*) FROM tmp_source_clients);
  v_source_policies integer := (SELECT count(*) FROM tmp_source_policies);
  v_source_commissions integer := (SELECT count(*) FROM tmp_source_commissions);
  v_source_bot integer := (SELECT count(*) FROM tmp_source_bot_attributions);
  v_mapped_carriers integer;
  v_mapped_products integer;
  v_mapped_clients integer;
  v_mapped_policies integer;
  v_mapped_commissions integer;
  v_mapped_bot integer;
  v_target_carriers integer;
  v_target_products integer;
  v_target_clients integer;
  v_target_policies integer;
  v_target_commissions integer;
  v_target_bot integer;
BEGIN
  SELECT count(*)
  INTO v_mapped_carriers
  FROM public.epic_book_dup_map
  WHERE entity_type = 'carrier'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_carriers);

  SELECT count(*)
  INTO v_mapped_products
  FROM public.epic_book_dup_map
  WHERE entity_type = 'product'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_products);

  SELECT count(*)
  INTO v_mapped_clients
  FROM public.epic_book_dup_map
  WHERE entity_type = 'client'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_clients);

  SELECT count(*)
  INTO v_mapped_policies
  FROM public.epic_book_dup_map
  WHERE entity_type = 'policy'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_policies);

  SELECT count(*)
  INTO v_mapped_commissions
  FROM public.epic_book_dup_map
  WHERE entity_type = 'commission'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_commissions);

  SELECT count(*)
  INTO v_mapped_bot
  FROM public.epic_book_dup_map
  WHERE entity_type = 'bot_attribution'
    AND target_imo_id = v_target_imo
    AND source_id IN (SELECT id FROM tmp_source_bot_attributions);

  SELECT count(*)
  INTO v_target_carriers
  FROM public.carriers c
  JOIN public.epic_book_dup_map m
    ON m.new_id = c.id
  WHERE m.entity_type = 'carrier'
    AND m.target_imo_id = v_target_imo
    AND m.source_id IN (SELECT id FROM tmp_source_carriers);

  SELECT count(*)
  INTO v_target_products
  FROM public.products p
  JOIN public.epic_book_dup_map m
    ON m.new_id = p.id
  WHERE m.entity_type = 'product'
    AND m.target_imo_id = v_target_imo
    AND m.source_id IN (SELECT id FROM tmp_source_products);

  SELECT count(*)
  INTO v_target_clients
  FROM public.clients c
  JOIN public.epic_book_dup_map m
    ON m.new_id = c.id
  WHERE m.entity_type = 'client'
    AND m.target_imo_id = v_target_imo
    AND m.source_id IN (SELECT id FROM tmp_source_clients);

  SELECT count(*)
  INTO v_target_policies
  FROM public.policies p
  JOIN public.epic_book_dup_map m
    ON m.new_id = p.id
  WHERE m.entity_type = 'policy'
    AND m.target_imo_id = v_target_imo
    AND m.source_id IN (SELECT id FROM tmp_source_policies);

  SELECT count(*)
  INTO v_target_commissions
  FROM public.commissions c
  JOIN public.epic_book_dup_map m
    ON m.new_id = c.id
  WHERE m.entity_type = 'commission'
    AND m.target_imo_id = v_target_imo
    AND m.source_id IN (SELECT id FROM tmp_source_commissions);

  SELECT count(*)
  INTO v_target_bot
  FROM public.bot_policy_attributions b
  JOIN public.epic_book_dup_map m
    ON m.new_id = b.id
  WHERE m.entity_type = 'bot_attribution'
    AND m.target_imo_id = v_target_imo
    AND m.source_id IN (SELECT id FROM tmp_source_bot_attributions);

  IF v_source_carriers <> v_mapped_carriers OR v_source_carriers <> v_target_carriers THEN
    RAISE EXCEPTION
      'Carrier duplication verification failed. source=% mapped=% target=%',
      v_source_carriers,
      v_mapped_carriers,
      v_target_carriers;
  END IF;

  IF v_source_products <> v_mapped_products OR v_source_products <> v_target_products THEN
    RAISE EXCEPTION
      'Product duplication verification failed. source=% mapped=% target=%',
      v_source_products,
      v_mapped_products,
      v_target_products;
  END IF;

  IF v_source_clients <> v_mapped_clients OR v_source_clients <> v_target_clients THEN
    RAISE EXCEPTION
      'Client duplication verification failed. source=% mapped=% target=%',
      v_source_clients,
      v_mapped_clients,
      v_target_clients;
  END IF;

  IF v_source_policies <> v_mapped_policies OR v_source_policies <> v_target_policies THEN
    RAISE EXCEPTION
      'Policy duplication verification failed. source=% mapped=% target=%',
      v_source_policies,
      v_mapped_policies,
      v_target_policies;
  END IF;

  IF v_source_commissions <> v_mapped_commissions OR v_source_commissions <> v_target_commissions THEN
    RAISE EXCEPTION
      'Commission duplication verification failed. source=% mapped=% target=%',
      v_source_commissions,
      v_mapped_commissions,
      v_target_commissions;
  END IF;

  IF v_source_bot <> v_mapped_bot OR v_source_bot <> v_target_bot THEN
    RAISE EXCEPTION
      'Bot attribution duplication verification failed. source=% mapped=% target=%',
      v_source_bot,
      v_mapped_bot,
      v_target_bot;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.epic_book_dup_map m
      ON m.new_id = p.id
    WHERE m.entity_type = 'product'
      AND m.target_imo_id = v_target_imo
      AND m.source_id IN (SELECT id FROM tmp_source_products)
      AND p.build_chart_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Duplicated Epic products still reference build charts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.policies p
    JOIN public.epic_book_dup_map m
      ON m.new_id = p.id
    WHERE m.entity_type = 'policy'
      AND m.target_imo_id = v_target_imo
      AND m.source_id IN (SELECT id FROM tmp_source_policies)
      AND (p.agency_id IS NOT NULL OR p.lead_purchase_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Duplicated Epic policies retained agency_id or lead_purchase_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.override_commissions oc
    WHERE oc.policy_id IN (
      SELECT new_id
      FROM public.epic_book_dup_map
      WHERE entity_type = 'policy'
        AND target_imo_id = v_target_imo
        AND source_id IN (SELECT id FROM tmp_source_policies)
    )
  ) THEN
    RAISE EXCEPTION 'Override commissions were created for duplicated Epic policies';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.epic_book_dup_map m
    WHERE m.batch_label = v_batch_label
      AND m.entity_type = 'commission'
      AND m.target_imo_id = v_target_imo
      AND m.source_id IN (
        SELECT id
        FROM tmp_source_commissions
        WHERE related_advance_id IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.commissions c
        WHERE c.id = m.new_id
          AND c.related_advance_id IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Duplicated related_advance_id links were not fully remapped';
  END IF;

  RAISE NOTICE
    'FFG->Epic duplication verified for batch %: carriers %, products %, clients %, policies %, commissions %, bot attributions %',
    v_batch_label,
    v_source_carriers,
    v_source_products,
    v_source_clients,
    v_source_policies,
    v_source_commissions,
    v_source_bot;
END $$;

COMMIT;
