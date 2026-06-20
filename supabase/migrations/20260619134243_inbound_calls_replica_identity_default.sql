-- Inbound-CRM scale fix #2 — drop the gratuitous REPLICA IDENTITY FULL on inbound_calls.
--
-- The realtime screen-pop consumer (src/contexts/InboundCallContext.tsx) reads ONLY payload.new
-- (id / status / agent_id) and filters on agent_id (present in the new image). REPLICA IDENTITY FULL
-- writes the ENTIRE before-image of the row — including the up-to-4000-char `notes` and every
-- free-text platform field — into WAL on every UPDATE, for ZERO consumer benefit. That inflates the
-- exact resource the single-threaded Supabase Realtime reader is bottlenecked on during a
-- ~1000-call burst (~3000 UPDATEs, each carrying a full old+new image).
--
-- DEFAULT (primary-key before-image) is sufficient for this table. Metadata-only change — no table
-- rewrite, no client code change. Safe to apply independently of the Broadcast migration.
--
-- LOCAL-only until go-live (bundle with the other inbound-crm LOCAL-only migrations).
BEGIN;

ALTER TABLE public.inbound_calls REPLICA IDENTITY DEFAULT;

COMMIT;
