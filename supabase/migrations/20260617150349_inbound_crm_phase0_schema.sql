-- Inbound-Call CRM Integration — Phase 0 (schema)
-- Plan: plans/active/MASTER-implementation-plan-20260617.md (Plan A, Phase 0)
--       ~/.claude/plans/we-already-have-a-serialized-lark.md §3
--
-- Our app is the CRM/system-of-record for an external inbound-call platform
-- (which works with NetTrio). This migration is purely ADDITIVE — it touches no
-- existing auth/commission/policy logic. It adds:
--   1) an IMMUTABLE phone normalizer that mirrors _shared/phone.ts EXACTLY,
--   2) an indexed generated `phone_e164` column on `clients` (call-speed lookup),
--   3) three new tables (credential store, pcId<->agent registry, call events),
--   4) RLS + realtime publication for the screen-pop feed.
--
-- Operationally single-tenant (Epic Life) but multi-tenant by `imo_id`
-- (NOT NULL everywhere on the new tables). `clients` itself has no imo_id — it
-- is scoped via clients.user_id -> user_profiles.imo_id.

BEGIN;

-- ============================================================================
-- 1) Phone normalizer — MUST mirror supabase/functions/_shared/phone.ts.
--    Parity is gated by scripts/test-phone-parity.mjs (SQL vs TS) and
--    src/lib/__tests__/phone.test.ts (TS twin vs fixed vectors). Any change
--    here must keep all three in lockstep or the GET-lookup SLA silently misses.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH c AS (
    -- JS: if (!phone) return null;  then  phone.replace(/[^\d+]/g, "")
    SELECT CASE
      WHEN phone IS NULL OR phone = '' THEN NULL
      ELSE regexp_replace(phone, '[^0-9+]', '', 'g')
    END AS cleaned
  )
  SELECT CASE
    WHEN c.cleaned IS NULL THEN NULL
    -- JS: if (cleaned.startsWith("+")) { return (11<=len<=15) ? cleaned : null; }
    WHEN left(c.cleaned, 1) = '+' THEN
      CASE WHEN length(c.cleaned) BETWEEN 11 AND 15 THEN c.cleaned ELSE NULL END
    -- JS: if (len === 10) return `+1${cleaned}`;
    WHEN length(c.cleaned) = 10 THEN '+1' || c.cleaned
    -- JS: if (len === 11 && cleaned.startsWith("1")) return `+${cleaned}`;
    WHEN length(c.cleaned) = 11 AND left(c.cleaned, 1) = '1' THEN '+' || c.cleaned
    -- JS: return null;
    ELSE NULL
  END
  FROM c;
$$;

COMMENT ON FUNCTION public.normalize_phone_e164(text) IS
  'US-centric E.164 phone normalizer. Mirrors _shared/phone.ts normalizePhoneNumber EXACTLY. IMMUTABLE so it can back the clients.phone_e164 generated column. Returns NULL when the input cannot be coerced to a plausible E.164 number.';

-- ============================================================================
-- 2) clients.phone_e164 — generated + indexed for exact-match lookup at call speed.
--    NON-unique index: households legitimately share a phone number.
-- ============================================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone_e164 text
  GENERATED ALWAYS AS (public.normalize_phone_e164(phone)) STORED;

CREATE INDEX IF NOT EXISTS idx_clients_phone_e164
  ON public.clients (phone_e164)
  WHERE phone_e164 IS NOT NULL;

-- ============================================================================
-- 3) Credential store — OAuth2 client-credentials. Secret stored ONE-WAY HASHED
--    (never reversibly encrypted); compared constant-time at the token endpoint.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.imo_call_platform_credentials (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id             uuid NOT NULL REFERENCES public.imos(id) ON DELETE CASCADE,
  client_id          text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  label              text,
  scopes             text[] NOT NULL DEFAULT ARRAY['crm:leads']::text[],
  is_active          boolean NOT NULL DEFAULT true,
  last_used_at       timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_platform_credentials_imo
  ON public.imo_call_platform_credentials (imo_id);

-- ============================================================================
-- 4) pcId <-> agent registry. UNIQUE(imo_id, pc_id) makes the resolve tenant-safe
--    by shape; UNIQUE(imo_id, user_id) keeps one pcId per agent per tenant.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.imo_agent_external_ids (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id     uuid NOT NULL REFERENCES public.imos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  pc_id      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (imo_id, pc_id),
  UNIQUE (imo_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_external_ids_user
  ON public.imo_agent_external_ids (user_id);

-- ============================================================================
-- 5) Inbound call events — idempotent on (imo_id, request_tag).
--    phone_e164 is NULLABLE on purpose: a POST/PATCH must NEVER 4xx on a
--    malformed ANI (degrade gracefully), so we cannot force a normalizable value.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inbound_calls (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id       uuid NOT NULL REFERENCES public.imos(id) ON DELETE CASCADE,
  request_tag  text NOT NULL,
  agent_id     uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  client_id    uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ani          text NOT NULL,
  phone_e164   text,
  state        text,
  record_type  text,
  pc_id        text,
  offer_id     text,
  call_program text,
  sub_id       text,
  call_start   timestamptz,
  duration     integer,
  billable     smallint,
  status       text NOT NULL DEFAULT 'ringing',
  fired_pop    boolean NOT NULL DEFAULT false,
  patch_only   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (imo_id, request_tag)
);

-- Open-calls / rehydration path (screen-pop reconnect): agent's non-ended calls.
CREATE INDEX IF NOT EXISTS idx_inbound_calls_agent_open
  ON public.inbound_calls (agent_id, created_at DESC)
  WHERE status <> 'ended';
CREATE INDEX IF NOT EXISTS idx_inbound_calls_client
  ON public.inbound_calls (client_id);

-- Realtime change feed drives the screen-pop (INSERT -> open, status='ended' UPDATE -> dismiss).
ALTER TABLE public.inbound_calls REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'inbound_calls'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.inbound_calls;
    END IF;
  END IF;
END$$;

-- ============================================================================
-- 6) RLS — M2M writes use service-role (bypass RLS). Authenticated users only READ.
-- ============================================================================
ALTER TABLE public.imo_call_platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imo_agent_external_ids        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_calls                 ENABLE ROW LEVEL SECURITY;

-- An agent reads ONLY their own calls, within their own tenant.
DROP POLICY IF EXISTS inbound_calls_select_own ON public.inbound_calls;
CREATE POLICY inbound_calls_select_own ON public.inbound_calls
  FOR SELECT TO authenticated
  USING (agent_id = (select auth.uid()) AND imo_id = get_my_imo_id());

-- Credentials + pcId registry: super-admin (in scope) read only. No client writes
-- (issue/rotate/revoke + pcId registration land in Phase 1 via SECURITY DEFINER RPCs).
DROP POLICY IF EXISTS call_platform_credentials_super_admin_read ON public.imo_call_platform_credentials;
CREATE POLICY call_platform_credentials_super_admin_read ON public.imo_call_platform_credentials
  FOR SELECT TO authenticated
  USING (super_admin_in_scope(imo_id));

DROP POLICY IF EXISTS agent_external_ids_super_admin_read ON public.imo_agent_external_ids;
CREATE POLICY agent_external_ids_super_admin_read ON public.imo_agent_external_ids
  FOR SELECT TO authenticated
  USING (super_admin_in_scope(imo_id));

COMMIT;
