-- Seed the canonical public app URL for absolute links in emails / notifications.
--
-- WHY: edge functions must NEVER hardcode the app domain. `remind-missing-profile-photos`
-- had a wrong hardcoded fallback ("https://app.thestandardhq.com", a 404) and app_config had
-- no `app_url` row, so the profile-photo reminder email shipped dead links. The real app is
-- served at https://www.thestandardhq.com (apex thestandardhq.com 307-redirects to it;
-- app.thestandardhq.com does not exist). This row is the single source of truth the functions
-- read.
INSERT INTO public.app_config (key, value, description)
VALUES (
  'app_url',
  'https://www.thestandardhq.com',
  'Canonical public app URL (no trailing slash) for absolute links in emails/notifications.'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
