-- Social Studio #8 Phase 3B: schedule a multi-slide carousel.
--
-- PURELY ADDITIVE. The live single-image path is untouched: image_url stays NOT NULL,
-- schedule_instagram_post / cancel_instagram_scheduled_post / the cron worker / the panel
-- all keep working, and old pending rows keep firing. A carousel row sets BOTH:
--   - image_urls   = the full ordered slide array (2-10), and
--   - image_url    = image_urls[1]
-- so the NOT NULL constraint, the panel thumbnail, and any legacy reader still work. The
-- worker discriminates on image_urls length (see instagram-process-scheduled-posts).
-- Cancel needs no change — it deletes any pending row by id regardless of shape.

ALTER TABLE instagram_scheduled_posts
  ADD COLUMN IF NOT EXISTS image_urls TEXT[];

COMMENT ON COLUMN instagram_scheduled_posts.image_urls IS
  'Ordered carousel slide URLs (2-10). NULL/empty = single image (use image_url). image_url mirrors image_urls[1] for back-compat.';

-- Schedule a carousel. Mirrors schedule_instagram_post's guards (future-only, integration
-- ownership, caption cap, imo_id/scheduled_by derived from auth.uid()) but takes an ordered
-- TEXT[] of 2-10 https URLs and stores both image_urls and image_url = image_urls[1].
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

REVOKE ALL ON FUNCTION schedule_instagram_carousel(UUID, UUID, TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION schedule_instagram_carousel(UUID, UUID, TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
