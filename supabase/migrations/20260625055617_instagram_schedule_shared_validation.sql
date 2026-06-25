-- Social Studio scheduling: collapse the duplicated guard block in schedule_instagram_post
-- and schedule_instagram_carousel into a single shared validator (review #8).
--
-- Both RPCs independently re-implemented the SAME guards (auth, agency lookup, future-time,
-- caption cap, integration-ownership) — so a future policy change (e.g. a per-agency daily
-- quota) applied to one would silently leave the other a bypass. This extracts those guards
-- into _validate_instagram_schedule_context(...), the single choke-point both RPCs now call.
-- Behavior is byte-for-byte identical to the prior bodies: same checks, same error strings,
-- same order; only the image-shape validation (single https URL vs 2-10 URL array) stays
-- per-RPC because it genuinely differs. The single-image live path is unchanged.
--
-- Depends on 20260624184311 (image_urls column + carousel RPC) having been applied first.

-- Shared guard: auth + agency + future-time + caption cap + integration ownership.
-- Returns the caller's agency id (v_imo). Internal helper — only the SECURITY DEFINER schedule
-- RPCs call it (as the function owner), so no client grant is needed. auth.uid() is request-
-- scoped and resolves correctly inside a nested SECURITY DEFINER call.
CREATE OR REPLACE FUNCTION _validate_instagram_schedule_context(
  p_integration_id UUID,
  p_scheduled_for TIMESTAMPTZ,
  p_caption TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_imo UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT imo_id INTO v_imo FROM user_profiles WHERE id = v_uid;
  IF v_imo IS NULL THEN
    RAISE EXCEPTION 'No agency found for this account';
  END IF;

  IF p_scheduled_for IS NULL OR p_scheduled_for <= now() THEN
    RAISE EXCEPTION 'Scheduled time must be in the future';
  END IF;

  IF p_caption IS NOT NULL AND char_length(p_caption) > 2200 THEN
    RAISE EXCEPTION 'Caption exceeds the 2200-character limit';
  END IF;

  -- The integration (if supplied) must belong to the caller's agency.
  IF p_integration_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM instagram_integrations
       WHERE id = p_integration_id AND imo_id = v_imo
     ) THEN
    RAISE EXCEPTION 'Instagram account not found for this agency';
  END IF;

  RETURN v_imo;
END;
$$;

REVOKE ALL ON FUNCTION _validate_instagram_schedule_context(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;

-- Single-image schedule — identical behavior, now via the shared validator.
CREATE OR REPLACE FUNCTION schedule_instagram_post(
  p_id UUID,
  p_integration_id UUID,
  p_image_url TEXT,
  p_caption TEXT,
  p_view TEXT,
  p_card_theme TEXT,
  p_scheduled_for TIMESTAMPTZ
)
RETURNS instagram_scheduled_posts
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_imo UUID;
  v_row instagram_scheduled_posts;
BEGIN
  v_imo := _validate_instagram_schedule_context(p_integration_id, p_scheduled_for, p_caption);

  IF p_image_url IS NULL OR p_image_url !~ '^https://' THEN
    RAISE EXCEPTION 'A public https image URL is required';
  END IF;

  INSERT INTO instagram_scheduled_posts (
    id, integration_id, imo_id, image_url, caption, view, card_theme,
    scheduled_for, scheduled_by, status, retry_count
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_integration_id, v_imo, p_image_url,
    p_caption, p_view, p_card_theme, p_scheduled_for, v_uid, 'pending', 0
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Carousel schedule — identical behavior, now via the shared validator.
CREATE OR REPLACE FUNCTION schedule_instagram_carousel(
  p_id UUID,
  p_integration_id UUID,
  p_image_urls TEXT[],
  p_caption TEXT,
  p_view TEXT,
  p_card_theme TEXT,
  p_scheduled_for TIMESTAMPTZ
)
RETURNS instagram_scheduled_posts
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_imo UUID;
  v_row instagram_scheduled_posts;
  v_url TEXT;
BEGIN
  v_imo := _validate_instagram_schedule_context(p_integration_id, p_scheduled_for, p_caption);

  IF p_image_urls IS NULL OR array_length(p_image_urls, 1) IS NULL
     OR array_length(p_image_urls, 1) < 2 THEN
    RAISE EXCEPTION 'A carousel needs at least 2 image URLs';
  END IF;

  IF array_length(p_image_urls, 1) > 10 THEN
    RAISE EXCEPTION 'A carousel is limited to 10 images';
  END IF;

  FOREACH v_url IN ARRAY p_image_urls LOOP
    IF v_url IS NULL OR v_url !~ '^https://' THEN
      RAISE EXCEPTION 'Every carousel image must be a public https URL';
    END IF;
  END LOOP;

  INSERT INTO instagram_scheduled_posts (
    id, integration_id, imo_id, image_url, image_urls, caption, view, card_theme,
    scheduled_for, scheduled_by, status, retry_count
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()), p_integration_id, v_imo,
    p_image_urls[1], p_image_urls, p_caption, p_view, p_card_theme,
    p_scheduled_for, v_uid, 'pending', 0
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Re-assert grants (CREATE OR REPLACE preserves them, but be explicit).
REVOKE ALL ON FUNCTION schedule_instagram_post(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION schedule_instagram_post(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
REVOKE ALL ON FUNCTION schedule_instagram_carousel(UUID, UUID, TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION schedule_instagram_carousel(UUID, UUID, TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
