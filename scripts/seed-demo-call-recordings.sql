-- scripts/seed-demo-call-recordings.sql
-- Seeds throwaway inbound-call analytics data into the epiclife-demo IMO
-- (2fd256e9-…) so the /analytics "Inbound Calls" section renders with real
-- numbers during smoke verification. IDEMPOTENT: re-running first removes the
-- prior smoke seed (tagged notes='SMOKE_SEED' / source='smoke_seed').
--
-- Demo IMO only — never touches auth accounts or real data.
-- Run: ./scripts/migrations/run-sql.sh -f scripts/seed-demo-call-recordings.sql

DO $$
DECLARE
  v_imo   uuid := '2fd256e9-9abb-445e-b405-62436555648a';
  v_run   uuid := '00000000-0000-0000-0000-0000000000aa'; -- marker analysis_run_id
  v_agents uuid[];
  v_states text[] := ARRAY['TX','CA','FL','NC','GA','TN','OH','AZ','KY','MO','SC','IN'];
  v_ages   text[] := ARRAY['under_30','30_39','40_49','50_59','60_69','70_plus'];
  -- outcome weighting: ~43% sold, mix of the rest
  v_outcomes text[] := ARRAY['sold','sold','sold','not_sold','not_sold','callback','not_qualified'];
  v_wt uuid[];
  v_wt1 uuid; v_wt2 uuid; v_wt3 uuid; v_wt4 uuid;
BEGIN
  SELECT array_agg(id) INTO v_agents
  FROM (SELECT id FROM user_profiles WHERE imo_id = v_imo LIMIT 8) s;

  IF v_agents IS NULL THEN
    RAISE EXCEPTION 'No demo agents found in IMO %', v_imo;
  END IF;

  -- ── clean prior smoke seed (FK order) ──────────────────────────────────────
  DELETE FROM kpi_word_track_detections WHERE imo_id = v_imo AND analysis_run_id = v_run;
  DELETE FROM kpi_call_recordings       WHERE imo_id = v_imo AND notes = 'SMOKE_SEED';
  DELETE FROM kpi_word_tracks           WHERE imo_id = v_imo AND source = 'smoke_seed';

  -- ── word tracks (4) ────────────────────────────────────────────────────────
  INSERT INTO kpi_word_tracks (imo_id, owner_id, label, phrase, category, source, is_active)
    VALUES (v_imo, v_agents[1], 'SMOKE: Warm greeting', 'thanks for calling', 'greeting', 'smoke_seed', true)
    RETURNING id INTO v_wt1;
  INSERT INTO kpi_word_tracks (imo_id, owner_id, label, phrase, category, source, is_active)
    VALUES (v_imo, v_agents[1], 'SMOKE: Value pitch', 'protect your family', 'pitch', 'smoke_seed', true)
    RETURNING id INTO v_wt2;
  INSERT INTO kpi_word_tracks (imo_id, owner_id, label, phrase, category, source, is_active)
    VALUES (v_imo, v_agents[1], 'SMOKE: Objection handle', 'i understand your concern', 'objection_handling', 'smoke_seed', true)
    RETURNING id INTO v_wt3;
  INSERT INTO kpi_word_tracks (imo_id, owner_id, label, phrase, category, source, is_active)
    VALUES (v_imo, v_agents[1], 'SMOKE: Assumptive close', 'lets get you started', 'close', 'smoke_seed', true)
    RETURNING id INTO v_wt4;
  v_wt := ARRAY[v_wt1, v_wt2, v_wt3, v_wt4];

  -- ── recordings (90, spread over the last 60 days, all inbound/completed) ────
  INSERT INTO kpi_call_recordings (
    imo_id, agent_id, uploader_id, call_direction, analysis_status, transcription_status,
    storage_bucket, storage_path, call_at, outcome, caller_state, caller_age_band,
    caller_gender, duration_seconds, premium_amount, policies_count, analyzed_at, notes
  )
  SELECT
    v_imo,
    v_agents[1 + (g % array_length(v_agents, 1))],
    v_agents[1 + (g % array_length(v_agents, 1))],
    'inbound', 'completed', 'completed',
    'call-recordings', 'smoke/seed-' || g || '.mp3',
    now() - ((random() * 60)::int || ' days')::interval
          - ((8 + (random() * 9)::int) || ' hours')::interval, -- business-ish hours
    o.outcome,
    v_states[1 + (g % array_length(v_states, 1))],
    v_ages[1 + (g % array_length(v_ages, 1))],
    CASE WHEN g % 2 = 0 THEN 'male' ELSE 'female' END,
    120 + (random() * 1400)::int,
    CASE WHEN o.outcome = 'sold' THEN 800 + (random() * 2400)::int ELSE NULL END,
    CASE WHEN o.outcome = 'sold' THEN 1 + (random() * 1)::int ELSE 0 END,
    now(),
    'SMOKE_SEED'
  FROM generate_series(1, 90) g
  CROSS JOIN LATERAL (
    SELECT v_outcomes[1 + (g % array_length(v_outcomes, 1))] AS outcome
  ) o;

  -- ── detections (~70% of recordings get 1 word-track hit) ────────────────────
  INSERT INTO kpi_word_track_detections (
    imo_id, agent_id, recording_id, word_track_id, detected_phrase,
    position_pct, timing_bucket, match_confidence, led_to_sale, on_expected_timing,
    analysis_run_id
  )
  SELECT
    v_imo, r.agent_id, r.id,
    v_wt[1 + ((row_number() OVER (ORDER BY r.id))::int % 4)],
    'detected phrase',
    random(), 'opening', 0.85 + random() * 0.14,
    (r.outcome = 'sold'), true, v_run
  FROM kpi_call_recordings r
  WHERE r.imo_id = v_imo AND r.notes = 'SMOKE_SEED' AND random() < 0.7;

  RAISE NOTICE 'Seeded % recordings, % detections, 4 word tracks into IMO %',
    (SELECT count(*) FROM kpi_call_recordings WHERE imo_id = v_imo AND notes = 'SMOKE_SEED'),
    (SELECT count(*) FROM kpi_word_track_detections WHERE imo_id = v_imo AND analysis_run_id = v_run),
    v_imo;
END $$;
