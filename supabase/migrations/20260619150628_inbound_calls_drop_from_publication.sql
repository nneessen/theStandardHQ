-- Cutover completion (scale fix #4): InboundCallContext now delivers the screen-pop via the PRIVATE
-- Broadcast channel (inbound_call_broadcast trigger), so inbound_calls no longer needs
-- postgres_changes. Drop it from supabase_realtime to eliminate the single-threaded WAL-reader +
-- per-subscriber RLS fan-out the scale review flagged as the #1 bottleneck. REPLICA IDENTITY was
-- already lowered to DEFAULT. LOCAL-only until go-live (bundle with the other inbound migrations).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='inbound_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.inbound_calls;
  END IF;
END$$;
