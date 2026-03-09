BEGIN;

ALTER TABLE public.underwriting_sessions
ADD COLUMN IF NOT EXISTS run_key TEXT,
ADD COLUMN IF NOT EXISTS selected_term_years INTEGER,
ADD COLUMN IF NOT EXISTS result_source TEXT NOT NULL DEFAULT 'legacy_client',
ADD COLUMN IF NOT EXISTS evaluation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.underwriting_sessions
DROP CONSTRAINT IF EXISTS underwriting_sessions_result_source_check;

ALTER TABLE public.underwriting_sessions
ADD CONSTRAINT underwriting_sessions_result_source_check
CHECK (
  result_source IN (
    'legacy_client',
    'raw_input_only',
    'backend_authoritative'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_underwriting_sessions_created_by_run_key
  ON public.underwriting_sessions(created_by, run_key)
  WHERE run_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_underwriting_session_recommendations_session_rank
  ON public.underwriting_session_recommendations(session_id, recommendation_rank);

CREATE INDEX IF NOT EXISTS idx_underwriting_rule_eval_log_session_time
  ON public.underwriting_rule_evaluation_log(session_id, evaluated_at DESC);

COMMENT ON COLUMN public.underwriting_sessions.run_key IS
'Idempotency key for an authoritative UW Wizard run.';

COMMENT ON COLUMN public.underwriting_sessions.selected_term_years IS
'Selected term length used for authoritative backend underwriting results. NULL means longest available term or permanent product.';

COMMENT ON COLUMN public.underwriting_sessions.result_source IS
'Origin of the stored underwriting result. legacy_client = pre-hardening data, raw_input_only = PR1 temporary boundary, backend_authoritative = PR2 backend-computed result.';

COMMENT ON COLUMN public.underwriting_sessions.evaluation_metadata IS
'Backend evaluation metadata for auditability, including engine version, request id, and fallback details.';

CREATE OR REPLACE FUNCTION public.persist_underwriting_run_v1(
  p_input JSONB,
  p_result JSONB,
  p_audit_rows JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_imo_id UUID;
  v_agency_id UUID;
  v_input JSONB := COALESCE(p_input, '{}'::jsonb);
  v_result JSONB := COALESCE(p_result, '{}'::jsonb);
  v_audit_rows JSONB := COALESCE(p_audit_rows, '[]'::jsonb);
  v_run_key TEXT := NULLIF(v_input->>'runKey', '');
  v_requested_face_amounts JSONB := COALESCE(v_input->'requestedFaceAmounts', '[]'::jsonb);
  v_requested_face_amount NUMERIC(15,2);
  v_conditions_reported TEXT[];
  v_requested_product_types TEXT[];
  v_client_height_inches INTEGER;
  v_client_weight_lbs INTEGER;
  v_client_bmi NUMERIC(5,2);
  v_selected_term_years INTEGER;
  v_existing_session public.underwriting_sessions%ROWTYPE;
  v_session public.underwriting_sessions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'unauthorized',
      'error', 'Unauthorized'
    );
  END IF;

  SELECT imo_id, agency_id
  INTO v_imo_id, v_agency_id
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR v_imo_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'profile_not_configured',
      'error', 'User profile is not configured for UW Wizard'
    );
  END IF;

  IF jsonb_typeof(v_input) <> 'object'
     OR jsonb_typeof(v_result) <> 'object'
     OR jsonb_typeof(v_requested_face_amounts) <> 'array'
     OR jsonb_typeof(COALESCE(v_result->'sessionRecommendations', '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(v_result->'rateTableRecommendations', '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(v_result->'eligibilitySummary', '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(v_result->'evaluationMetadata', '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(v_audit_rows) <> 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_payload',
      'error', 'Invalid authoritative underwriting payload'
    );
  END IF;

  IF jsonb_array_length(v_requested_face_amounts) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_payload',
      'error', 'At least one face amount is required'
    );
  END IF;

  IF v_run_key IS NOT NULL THEN
    SELECT *
    INTO v_existing_session
    FROM public.underwriting_sessions
    WHERE created_by = v_user_id
      AND run_key = v_run_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'alreadyPersisted', true,
        'session', to_jsonb(v_existing_session)
      );
    END IF;
  END IF;

  v_client_height_inches := NULLIF(v_input->>'clientHeightInches', '')::INTEGER;
  v_client_weight_lbs := NULLIF(v_input->>'clientWeightLbs', '')::INTEGER;
  IF COALESCE(v_client_height_inches, 0) <= 0
     OR COALESCE(v_client_weight_lbs, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_payload',
      'error', 'Client height and weight must be positive values'
    );
  END IF;

  SELECT COALESCE(array_agg(value), '{}'::TEXT[])
  INTO v_conditions_reported
  FROM jsonb_array_elements_text(COALESCE(v_input->'conditionsReported', '[]'::jsonb)) AS value;

  SELECT COALESCE(array_agg(value), '{}'::TEXT[])
  INTO v_requested_product_types
  FROM jsonb_array_elements_text(COALESCE(v_input->'requestedProductTypes', '[]'::jsonb)) AS value;

  v_requested_face_amount := NULLIF(v_requested_face_amounts->>0, '')::NUMERIC;
  v_selected_term_years := NULLIF(v_input->>'selectedTermYears', '')::INTEGER;
  v_client_bmi := ROUND(
    ((v_client_weight_lbs::NUMERIC * 703) / POWER(v_client_height_inches::NUMERIC, 2))::NUMERIC,
    2
  );

  INSERT INTO public.underwriting_sessions (
    imo_id,
    agency_id,
    created_by,
    client_name,
    client_dob,
    client_age,
    client_gender,
    client_state,
    client_height_inches,
    client_weight_lbs,
    client_bmi,
    health_responses,
    conditions_reported,
    tobacco_use,
    tobacco_details,
    requested_face_amount,
    requested_face_amounts,
    requested_product_types,
    recommendations,
    eligibility_summary,
    decision_tree_id,
    session_duration_seconds,
    notes,
    status,
    run_key,
    selected_term_years,
    result_source,
    evaluation_metadata
  )
  VALUES (
    v_imo_id,
    v_agency_id,
    v_user_id,
    NULLIF(v_input->>'clientName', ''),
    NULLIF(v_input->>'clientDob', '')::DATE,
    NULLIF(v_input->>'clientAge', '')::INTEGER,
    NULLIF(v_input->>'clientGender', ''),
    NULLIF(v_input->>'clientState', ''),
    v_client_height_inches,
    v_client_weight_lbs,
    v_client_bmi,
    v_input->'healthResponses',
    v_conditions_reported,
    COALESCE((v_input->>'tobaccoUse')::BOOLEAN, false),
    v_input->'tobaccoDetails',
    v_requested_face_amount,
    v_requested_face_amounts,
    v_requested_product_types,
    COALESCE(v_result->'rateTableRecommendations', '[]'::jsonb),
    COALESCE(v_result->'eligibilitySummary', '{}'::jsonb),
    NULLIF(v_input->>'decisionTreeId', '')::UUID,
    NULLIF(v_input->>'sessionDurationSeconds', '')::INTEGER,
    NULLIF(v_input->>'notes', ''),
    'saved',
    v_run_key,
    v_selected_term_years,
    'backend_authoritative',
    COALESCE(v_result->'evaluationMetadata', '{}'::jsonb)
  )
  RETURNING *
  INTO v_session;

  INSERT INTO public.underwriting_session_recommendations (
    session_id,
    product_id,
    carrier_id,
    imo_id,
    eligibility_status,
    eligibility_reasons,
    missing_fields,
    confidence,
    approval_likelihood,
    health_class_result,
    condition_decisions,
    monthly_premium,
    annual_premium,
    cost_per_thousand,
    score,
    score_components,
    recommendation_reason,
    recommendation_rank,
    draft_rules_fyi
  )
  SELECT
    v_session.id,
    NULLIF(rec->>'productId', '')::UUID,
    NULLIF(rec->>'carrierId', '')::UUID,
    v_imo_id,
    rec->>'eligibilityStatus',
    COALESCE((
      SELECT array_agg(value)
      FROM jsonb_array_elements_text(COALESCE(rec->'eligibilityReasons', '[]'::jsonb)) AS value
    ), '{}'::TEXT[]),
    COALESCE(rec->'missingFields', '[]'::jsonb),
    NULLIF(rec->>'confidence', '')::NUMERIC,
    NULLIF(rec->>'approvalLikelihood', '')::NUMERIC,
    NULLIF(rec->>'healthClassResult', ''),
    COALESCE(rec->'conditionDecisions', '[]'::jsonb),
    NULLIF(rec->>'monthlyPremium', '')::NUMERIC,
    NULLIF(rec->>'annualPremium', '')::NUMERIC,
    NULLIF(rec->>'costPerThousand', '')::NUMERIC,
    NULLIF(rec->>'score', '')::NUMERIC,
    COALESCE(rec->'scoreComponents', '{}'::jsonb),
    NULLIF(rec->>'recommendationReason', ''),
    NULLIF(rec->>'recommendationRank', '')::INTEGER,
    COALESCE(rec->'draftRulesFyi', '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(v_result->'sessionRecommendations', '[]'::jsonb)) AS rec;

  INSERT INTO public.underwriting_rule_evaluation_log (
    session_id,
    imo_id,
    rule_set_id,
    rule_id,
    condition_code,
    predicate_result,
    matched_conditions,
    failed_conditions,
    missing_fields,
    outcome_applied,
    input_hash
  )
  SELECT
    v_session.id,
    v_imo_id,
    NULLIF(log_row->>'ruleSetId', '')::UUID,
    NULLIF(log_row->>'ruleId', '')::UUID,
    NULLIF(log_row->>'conditionCode', ''),
    NULLIF(log_row->>'predicateResult', ''),
    log_row->'matchedConditions',
    log_row->'failedConditions',
    log_row->'missingFields',
    log_row->'outcomeApplied',
    NULLIF(log_row->>'inputHash', '')
  FROM jsonb_array_elements(v_audit_rows) AS log_row;

  RETURN jsonb_build_object(
    'success', true,
    'alreadyPersisted', false,
    'session', to_jsonb(v_session)
  );
EXCEPTION
  WHEN unique_violation THEN
    IF v_run_key IS NOT NULL THEN
      SELECT *
      INTO v_existing_session
      FROM public.underwriting_sessions
      WHERE created_by = v_user_id
        AND run_key = v_run_key
      LIMIT 1;

      IF FOUND THEN
        RETURN jsonb_build_object(
          'success', true,
          'alreadyPersisted', true,
          'session', to_jsonb(v_existing_session)
        );
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'code', 'persist_failed',
      'error', 'Failed to persist underwriting session'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'persist_failed',
      'error', 'Failed to persist underwriting session'
    );
END;
$$;

COMMENT ON FUNCTION public.persist_underwriting_run_v1(JSONB, JSONB, JSONB) IS
'Persists a backend-authoritative UW Wizard run transactionally, binding the actor with auth.uid() and inserting session, normalized recommendations, and evaluation audit rows together.';

REVOKE ALL ON FUNCTION public.persist_underwriting_run_v1(JSONB, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_underwriting_run_v1(JSONB, JSONB, JSONB) TO authenticated;

COMMIT;
