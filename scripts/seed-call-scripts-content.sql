-- seed-call-scripts-content.sql
-- LOCAL-ONLY seed for testing the Sales Scripts generator (generate-call-script).
-- The demo seeder's sold calls are hollow status-stubs (no transcript/analysis),
-- so the generator has nothing to synthesize. This inserts 4 content-rich SOLD
-- calls (diarized transcript + speaker_role_map + ai_summary + objection_events +
-- ai_key_moments) assigned to the demo IMO's "Cash Out" call type, clearing the
-- MIN_CALLS=3 floor. Idempotent: re-running replaces the seeded rows.
--
-- Run:  ./scripts/migrations/run-sql.sh -f scripts/seed-call-scripts-content.sql
-- Guarded to the LOCAL demo IMO (2fd256e9…) — a no-op on any other database.

DO $$
DECLARE
  v_imo   uuid := '2fd256e9-9abb-445e-b405-62436555648a';            -- demo Epic Life
  v_type  uuid := '91cae9ee-e7b5-495f-b7b3-79aae721b5e8';            -- "Cash Out"
  v_agent uuid;
  i int;
  v_segments jsonb;
BEGIN
  -- Bail unless this is the demo IMO with the Cash Out type present (prod-safe).
  IF NOT EXISTS (SELECT 1 FROM public.kpi_call_types WHERE id = v_type AND imo_id = v_imo) THEN
    RAISE NOTICE 'Cash Out call type not found in demo IMO — skipping seed.';
    RETURN;
  END IF;

  SELECT id INTO v_agent FROM auth.users WHERE email = 'agent1@epiclife-demo.test' LIMIT 1;
  IF v_agent IS NULL THEN
    RAISE NOTICE 'agent1@epiclife-demo.test not found — skipping seed.';
    RETURN;
  END IF;

  -- Clean prior seed rows (storage_path prefix is the marker).
  DELETE FROM public.kpi_call_recordings
   WHERE imo_id = v_imo AND storage_path LIKE 'seed-script-test/%';

  FOR i IN 1..4 LOOP
    -- A short but realistic "cash out" (whole-life cash-value) sold call: open →
    -- discovery → pitch → ONE objection handled → close. Vary slightly per call so
    -- the synthesis sees a recurring PATTERN, not one transcript echoed 4x.
    v_segments := jsonb_build_array(
      jsonb_build_object('id',0,'start',0,'end',6,'speaker',0,
        'text','Thanks for calling, this is Jordan on the recorded line — how can I help you today?'),
      jsonb_build_object('id',1,'start',6,'end',14,'speaker',1,
        'text','Hi, I got a letter saying I might be able to pull cash out of my life insurance policy.'),
      jsonb_build_object('id',2,'start',14,'end',22,'speaker',0,
        'text','Absolutely, happy to look at that with you. Before we do — who are you hoping to protect with this policy, just you or you and a spouse?'),
      jsonb_build_object('id',3,'start',22,'end',30,'speaker',1,
        'text','Me and my husband. We are both retired now and money is a little tight this year.'),
      jsonb_build_object('id',4,'start',30,'end',42,'speaker',0,
        'text','Got it. So what I can do is show you how to access the cash value you have built up while keeping a paid-up benefit in place for him. Does keeping some coverage for your husband matter to you?'),
      jsonb_build_object('id',5,'start',42,'end',48,'speaker',1,
        'text','Yeah, I do not want to leave him with nothing if something happens.'),
      jsonb_build_object('id',6,'start',48,'end',60,'speaker',0,
        'text','Perfect. Based on what you told me, here is what most folks in your spot do — take the cash you need now and roll the rest into a smaller paid-up policy. It keeps a benefit for [spouse name] with no new medical exam.'),
      jsonb_build_object('id',7,'start',60,'end',68,'speaker',1,
        'text','That sounds okay but I really need to talk to my husband before I sign anything.'),
      jsonb_build_object('id',8,'start',68,'end',82,'speaker',0,
        'text','Totally fair, most couples decide together. That is exactly why I asked about him first — so let us get the real numbers in front of both of you today, and nothing is final until you both feel good about it. Sound fair?'),
      jsonb_build_object('id',9,'start',82,'end',90,'speaker',1,
        'text','Okay, yes, let us do that.'),
      jsonb_build_object('id',10,'start',90,'end',100,'speaker',0,
        'text','Wonderful. I will lock in your access amount and email you both the paperwork right now — go ahead and grab your driver''s license for me.')
    );

    INSERT INTO public.kpi_call_recordings (
      imo_id, agent_id, uploader_id, storage_bucket, storage_path,
      original_filename, call_direction, call_at, duration_seconds, outcome,
      transcription_status, transcript_segments, speaker_role_map,
      analysis_status, ai_summary, objection_events, ai_key_moments,
      objection_count, smoke_screen_count, talk_time_seconds, client_talk_seconds,
      speaker_count, call_type_id
    ) VALUES (
      v_imo, v_agent, v_agent, 'call-recordings',
      'seed-script-test/cashout-' || i || '.mp3',
      'cashout-' || i || '.mp3', 'inbound',
      now() - (i || ' days')::interval, 100, 'sold',
      'completed', v_segments,
      jsonb_build_object('0','agent','1','client'),
      'completed',
      'Retired caller responding to a cash-out mailer; agent qualified the household, framed a partial cash-out keeping a paid-up benefit for the spouse, handled a "talk to my spouse first" stall, and closed by collecting ID.',
      jsonb_build_array(
        jsonb_build_object('start_seconds',60,'end_seconds',68,
          'quote','I really need to talk to my husband before I sign anything.',
          'type','spouse_consult','is_smoke_screen',false,'handled',true,
          'resolution','Agreed it is a joint decision, reframed as getting real numbers for both, kept momentum.')
      ),
      jsonb_build_array(
        jsonb_build_object('time_seconds',14,'label','Discovery: who to protect','kind','discovery'),
        jsonb_build_object('time_seconds',48,'label','Pitch: partial cash-out + paid-up','kind','pitch'),
        jsonb_build_object('time_seconds',90,'label','Close: collect ID','kind','close')
      ),
      1, 0, 70, 30, 2, v_type
    );
  END LOOP;

  RAISE NOTICE 'Seeded 4 content-rich Cash Out sold calls into demo IMO.';
END $$;
