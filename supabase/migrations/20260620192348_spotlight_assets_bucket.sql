-- supabase/migrations/20260620192348_spotlight_assets_bucket.sql
-- Public storage bucket for Spotlight (Social Studio) agent photos.
-- Used by the owner-only Agent-of-the-Week card: the owner uploads a producer's
-- photo, which is rendered into the social graphic and (later) posted to Instagram.
--
-- WHY PUBLIC: Instagram's Graph API publish flow needs a publicly fetchable image
-- URL (mirrors the existing `instagram-media` / `recruiting-assets` buckets). Agent
-- faces are therefore world-readable by URL — acceptable here (the same as those
-- buckets) and the only thing posted is what the owner explicitly uploads.
--
-- WHY auth.uid() (NOT imo_id) PATH-SCOPING: Spotlight is super-admin-only, and a
-- super-admin's user_profiles.imo_id is unreliable/empty, so an imo-scoped write
-- policy (get_my_imo_id()) could deny the owner's own upload. Scoping writes to the
-- caller's own uid folder is the proven `recruiting-assets` pattern and robust here;
-- public read makes the imo distinction moot for reads.
-- Path structure: {user_id}/{filename}

-- ============================================================================
-- BUCKET: spotlight-assets
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'spotlight-assets',
  'spotlight-assets',
  true,        -- Public bucket (Instagram publish needs public image URLs)
  10485760,    -- 10MB per file (phone portraits routinely exceed 5MB)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE RLS POLICIES (idempotent)
-- ============================================================================
DROP POLICY IF EXISTS "spotlight_assets_public_read" ON storage.objects;        -- pre-hardening name
DROP POLICY IF EXISTS "spotlight_assets_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "spotlight_assets_user_upload" ON storage.objects;
DROP POLICY IF EXISTS "spotlight_assets_user_update" ON storage.objects;
DROP POLICY IF EXISTS "spotlight_assets_user_delete" ON storage.objects;

-- Read via the storage.objects table is limited to AUTHENTICATED users. This does
-- NOT gate image delivery: the bucket is public=true, so /object/public/<path> URLs
-- are served by Storage WITHOUT consulting RLS (Instagram fetch-by-URL keeps working).
-- Narrowing to `authenticated` only blocks ANON list()/enumeration of the bucket — so
-- a holder of just the anon key can't walk every {uid}/ folder and harvest agent faces.
CREATE POLICY "spotlight_assets_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'spotlight-assets');

-- Authenticated users may upload ONLY into their own {user_id}/ folder.
CREATE POLICY "spotlight_assets_user_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'spotlight-assets' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may overwrite (upsert) ONLY their own assets.
CREATE POLICY "spotlight_assets_user_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'spotlight-assets' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'spotlight-assets' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may delete ONLY their own assets.
CREATE POLICY "spotlight_assets_user_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'spotlight-assets' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- NOTE: no `COMMENT ON TABLE storage.buckets` — that table is owned by
-- supabase_storage_admin, so a COMMENT errors ("must be owner") under the
-- migration role. The bucket's purpose is documented in this file's header.
