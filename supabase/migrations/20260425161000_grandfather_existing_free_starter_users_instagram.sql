-- 20260425161000_grandfather_existing_free_starter_users_instagram.sql
--
-- WHY:
-- The temporary free-access window (supabase/functions/_shared/temporaryAccess.ts)
-- expired 2026-02-01. After expiry, instagram-oauth-init falls through to
-- user_has_instagram_access(), which returns FALSE for any user whose plan
-- doesn't carry features->>'instagram_messaging' = 'true' AND has no
-- grandfathered_until in the future. As of 2026-04-25, only the `pro` and
-- `team` plans carry that feature flag, so 97 of 105 active users (including
-- the platform owner) are locked out of connecting Instagram.
--
-- DECISION:
-- Keep Instagram as a paid feature going forward, but grandfather every
-- currently-active free/starter user so they retain access until 2027-12-31.
-- New signups after this migration land without grandfathered_until set, so
-- the paid gate kicks in for them as intended.
--
-- The RPC user_has_instagram_access already short-circuits to TRUE when
-- grandfathered_until > now(), so no edge function or RPC change is needed.

BEGIN;

DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE user_subscriptions us
       SET grandfathered_until = '2027-12-31 23:59:59+00'::timestamptz
      FROM subscription_plans sp
     WHERE us.plan_id = sp.id
       AND sp.name IN ('free', 'starter')
       AND us.status = 'active'
       AND us.grandfathered_until IS NULL
    RETURNING us.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RAISE NOTICE 'Grandfathered % free/starter user_subscriptions until 2027-12-31', v_updated_count;
END $$;

COMMIT;
