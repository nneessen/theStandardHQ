-- supabase/migrations/20260429193231_seed_captive_agent_templates.sql
-- Seed 70 Instagram message templates for the new "captive_agent" prospect type.
-- Captive agents: locked to a single carrier (State Farm, Geico, Allstate, Progressive, Farmers, Liberty Mutual, etc.).
-- Counts mirror existing categories:
--   10 openers + 10 follow_ups + 20 engagement (10+10 styles) + 20 discovery (10+10 styles) + 10 closers = 70
-- Style: lowercase, casual, conversational, 20s demographic, jab-jab-punch warm approach.

DO $$
DECLARE
  v_imo_id UUID;
BEGIN
  SELECT id INTO v_imo_id FROM imos LIMIT 1;

  IF v_imo_id IS NULL THEN
    RAISE NOTICE 'No IMO found, skipping captive_agent template seeding';
    RETURN;
  END IF;

  -- ============================================================================
  -- CAPTIVE AGENT OPENERS (10) — first contact, casual, non-salesy
  -- ============================================================================
  INSERT INTO instagram_message_templates (imo_id, user_id, name, content, category, message_stage, is_active)
  VALUES
    (v_imo_id, NULL, 'Captive - Opener 1', 'hey! saw you''re with state farm. how long you been there?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 2', 'yo what''s good! noticed you''re a geico agent. how''s that life?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 3', 'sup! fellow insurance person here. you with allstate right?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 4', 'hey there! saw you rep one carrier. how''d you end up captive vs going independent?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 5', 'what''s up! noticed you''re at progressive. you enjoying it so far?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 6', 'hey! always cool to connect with other agents. you mostly auto and home over there?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 7', 'yo! saw the captive thing. were you always with that carrier or did you switch in?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 8', 'hey what''s good! noticed you''re a captive agent. salary + bonus or straight commission?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 9', 'sup! saw you''re with farmers. how''s the agency owner path treating you?', 'captive_agent', 'opener', true),
    (v_imo_id, NULL, 'Captive - Opener 10', 'hey! liberty mutual agent right? what got you into the captive route?', 'captive_agent', 'opener', true);

  -- ============================================================================
  -- CAPTIVE AGENT FOLLOW-UPS (10) — checking back, still casual
  -- ============================================================================
  INSERT INTO instagram_message_templates (imo_id, user_id, name, content, category, message_stage, is_active)
  VALUES
    (v_imo_id, NULL, 'Captive - Follow 1', 'hey just circling back! know the captive grind keeps you slammed', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 2', 'yo! never heard back. quotas keeping you busy?', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 3', 'hey! just checking in. office hours can be brutal', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 4', 'sup! hope i didn''t catch you mid-renewal cycle. just wanted to connect', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 5', 'hey there! figured i''d bump this. how''s the book treating you?', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 6', 'yo! my message probably got buried under corporate emails lol. you still in the game?', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 7', 'hey! just wanted to follow up. how''s production going for the month?', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 8', 'what''s good! didn''t want that message to get lost. hope things are well at the agency', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 9', 'sup! just floating this back up. captive life is nonstop right', 'captive_agent', 'follow_up', true),
    (v_imo_id, NULL, 'Captive - Follow 10', 'hey! hope i''m not bugging you. just genuinely wanted to connect with other agents', 'captive_agent', 'follow_up', true);

  -- ============================================================================
  -- CAPTIVE AGENT ENGAGEMENT — Set 1 (10) — formal, structured questions
  -- ============================================================================
  INSERT INTO instagram_message_templates (imo_id, user_id, name, content, category, message_stage, is_active)
  VALUES
    (v_imo_id, NULL, 'Captive - Carrier Choice', 'Quick question - did you actively choose your carrier or did the opportunity just kind of present itself? Curious how most captives ended up where they are.', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Product Lineup', 'How locked in are you on the product side? Like can you write life and health, or are you mostly P&C only?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Comp Structure', 'Are you on a salary plus commission setup or pure commission? I''ve seen captives done both ways.', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Quota Pressure', 'How are the production goals over there? Reasonable or feels like they keep raising the bar every quarter?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Book Ownership', 'Quick one - if you ever left, would you keep your clients? Or does the carrier basically own that book?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Office Hours', 'Are you in an office every day or do you have any flexibility with your schedule? That part varies a lot.', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Lead Source', 'Where do most of your leads come from? Walk-ins, company-supplied, your own marketing? Curious how that works in your shop.', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Path Forward', 'What does the growth path look like for you over there? Agency owner track or staying as a producer?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Cross-Selling', 'How much do you cross-sell vs just writing what walks in? The really good captives I know are bundling everything.', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Side Income', 'Random question - does your contract let you write any side business at all, like life or final expense outside the carrier? Most don''t but some do.', 'captive_agent', 'engagement', true);

  -- ============================================================================
  -- CAPTIVE AGENT ENGAGEMENT — Set 2 (10) — short, reactive, conversational
  -- ============================================================================
  INSERT INTO instagram_message_templates (imo_id, user_id, name, content, category, message_stage, is_active)
  VALUES
    (v_imo_id, NULL, 'Captive - Engage 11', 'that''s dope. so are you mostly writing auto and home or doing some commercial too?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 12', 'nice! how''d you end up captive vs going independent? everyone has a story', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 13', 'for real. what''s been your biggest win at the agency lately?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 14', 'gotcha. are you running your own marketing or does the carrier just send you leads?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 15', 'that makes sense. what made you pick that carrier specifically?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 16', 'interesting. do you have a salary base or is it mostly commission for you?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 17', 'respect. what''s your favorite part about being captive vs going independent?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 18', 'true. you ever thought about going independent or pretty locked in?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 19', 'nice. how''s production been? quotas brutal or fair?', 'captive_agent', 'engagement', true),
    (v_imo_id, NULL, 'Captive - Engage 20', 'that''s real. what would need to change for you to be where you want to be?', 'captive_agent', 'engagement', true);

  -- ============================================================================
  -- CAPTIVE AGENT DISCOVERY — Set 1 (10) — pain-point named ("Pain: X")
  -- ============================================================================
  INSERT INTO instagram_message_templates (imo_id, user_id, name, content, category, message_stage, is_active)
  VALUES
    (v_imo_id, NULL, 'Captive - Pain: One Carrier', 'How often do you lose deals because you can only quote one carrier? Has to sting when the rate just isn''t competitive that day.', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: Book Ownership', 'If you walked away tomorrow, would those clients come with you? Or does the agency just hand them to the next agent?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: Comp Ceiling', 'What''s the realistic income ceiling at your level? I talk to captives who hit a wall fast and the carrier never moves it.', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: Product Limits', 'Do you ever have clients ask for life or health and you can''t help them? That referral money just walks out the door.', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: Quota Squeeze', 'How often does corporate raise the production targets? Feels like a moving goalpost for a lot of captives I talk to.', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: Office Bound', 'Are you stuck in an office most of the day? Some captives have zero schedule control and it wears on people.', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: Non-Compete', 'Did they make you sign a non-compete? Those things can really box you in if you ever want to leave.', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: Corporate Layers', 'How much of your week goes to corporate meetings, training modules, and reports vs actually selling?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: Layoff Risk', 'You ever worry about the carrier restructuring or closing your office? That''s out of your hands and it''s scary.', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Pain: No Equity', 'You''re building someone else''s book of business. Are you building anything you could actually sell or pass down someday?', 'captive_agent', 'discovery', true);

  -- ============================================================================
  -- CAPTIVE AGENT DISCOVERY — Set 2 (10) — short empathetic follow-ups
  -- ============================================================================
  INSERT INTO instagram_message_templates (imo_id, user_id, name, content, category, message_stage, is_active)
  VALUES
    (v_imo_id, NULL, 'Captive - Discovery 11', 'i feel that. what would change about your situation if you could write any carrier you wanted?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 12', 'yeah that''s rough. do you actually have a real path to grow there or capped at agent level?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 13', 'gotcha. if you could keep your book and 10x your commission would you even consider it?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 14', 'that sucks. do you feel like the carrier actually has your back or are you just a number?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 15', 'true. how much money do you think you leave on the table when you can''t shop a rate?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 16', 'makes sense. if money wasn''t the issue would you still be captive or would you move?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 17', 'dang. how much of your income is salary vs commission? that mix really matters', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 18', 'that''s wild. do you feel stuck or like you have actual options?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 19', 'respect for being honest. what would need to happen for you to make a move?', 'captive_agent', 'discovery', true),
    (v_imo_id, NULL, 'Captive - Discovery 20', 'i hear you. on a scale of 1-10 how locked in do you actually feel right now?', 'captive_agent', 'discovery', true);

  -- ============================================================================
  -- CAPTIVE AGENT CLOSERS (10) — transition to call/meeting
  -- ============================================================================
  INSERT INTO instagram_message_templates (imo_id, user_id, name, content, category, message_stage, is_active)
  VALUES
    (v_imo_id, NULL, 'Captive - Close 1', 'honestly sounds like you''re hitting a ceiling that captive setups create. would you be down for a quick call so i can show you what writing across multiple carriers actually looks like?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 2', 'look i''m not saying captive is bad but based on what you said it might be worth 15 min to see what independent looks like. you free this week?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 3', 'i think you''d actually love the freedom of going independent. no pressure but want to do a quick zoom so i can show you?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 4', 'real talk i''ve helped a lot of captive agents make the switch and they never look back. can we set up a call so i can explain what it looks like?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 5', 'you seem like someone who''s outgrowing the captive structure. want to jump on a call and i can walk you through what we do?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 6', 'not trying to pitch you hard but what i''m doing solves basically every issue you mentioned. 20 minutes to chat?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 7', 'hey based on everything you shared i think it makes sense to talk more. can we schedule a quick intro call?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 8', 'i''d rather show you the comp structure and carrier list on a call than try to type it all here. you down to connect this week?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 9', 'look worst case you stay captive with a clearer picture of what else is out there. can we set up a zoom?', 'captive_agent', 'closer', true),
    (v_imo_id, NULL, 'Captive - Close 10', 'i think there''s something here worth exploring. want to hop on a quick call and see if going independent makes sense for you?', 'captive_agent', 'closer', true);

  RAISE NOTICE 'Successfully seeded 70 captive_agent templates (10 opener + 10 follow_up + 20 engagement + 20 discovery + 10 closer)';

END $$;
