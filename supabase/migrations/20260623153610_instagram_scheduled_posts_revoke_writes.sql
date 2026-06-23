-- supabase/migrations/20260623153610_instagram_scheduled_posts_revoke_writes.sql
-- Grant-hardening for instagram_scheduled_posts.
--
-- WHY: prod carries over-broad ALTER DEFAULT PRIVILEGES that grant `authenticated` ALL on
-- new public tables, so the SELECT-only intent of 20260623142441 didn't actually hold on
-- prod (authenticated ended up with INSERT/UPDATE/DELETE too). RLS already blocks direct
-- writes (the table has only a SELECT policy → default-deny on write — verified on prod),
-- so this is defense-in-depth + intent-alignment, NOT a live-hole fix.
--
-- SAFE: the write path is the SECURITY DEFINER RPCs (schedule_instagram_post /
-- cancel_instagram_scheduled_post), which run as the function owner and are unaffected by
-- authenticated's table grants; the cron worker uses the service role. The frontend only
-- does direct SELECTs (the RLS-scoped list) + RPC writes. So SELECT is the only privilege
-- authenticated needs.

REVOKE ALL ON public.instagram_scheduled_posts FROM authenticated, anon;
GRANT SELECT ON public.instagram_scheduled_posts TO authenticated;
