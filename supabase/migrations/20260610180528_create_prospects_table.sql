-- Prospects: lightweight, agent-owned follow-up contacts.
--
-- Distinct from the user_profiles "prospect" onboarding_status (which provisions a
-- real auth account + sends a "Welcome - Set Your Password" email via create-auth-user).
-- A prospect here is just someone an agent talked to and wants to keep in touch with —
-- NO auth account, NO email. Owner-private: each agent sees only their own prospects.
-- RLS mirrors public.recruiting_leads (owner-scoped + super-admin + revocation_deny).

CREATE TABLE IF NOT EXISTS public.prospects (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id               uuid NOT NULL REFERENCES public.imos(id),
  agency_id            uuid REFERENCES public.agencies(id),
  owner_id             uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  first_name           text NOT NULL,
  last_name            text,
  email                text,
  phone                text,
  state                text,
  source               text,
  status               text NOT NULL DEFAULT 'new',
  notes                text,
  last_contacted_at    timestamptz,
  next_follow_up_at    timestamptz,
  converted_recruit_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  converted_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_owner ON public.prospects (owner_id);
CREATE INDEX IF NOT EXISTS idx_prospects_owner_status ON public.prospects (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_prospects_imo ON public.prospects (imo_id);
CREATE INDEX IF NOT EXISTS idx_prospects_next_follow_up ON public.prospects (next_follow_up_at);

-- updated_at maintenance (generic project trigger fn)
DROP TRIGGER IF EXISTS trigger_update_prospects_updated_at ON public.prospects;
CREATE TRIGGER trigger_update_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- SELECT: owner sees own (within effective IMO); super admins see all in scope
CREATE POLICY "Owners can view own prospects" ON public.prospects
  FOR SELECT USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can view all prospects" ON public.prospects
  FOR SELECT USING (super_admin_in_scope(imo_id));

-- INSERT: auth user creates own row within their effective IMO
CREATE POLICY "Owners can insert own prospects" ON public.prospects
  FOR INSERT WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

-- UPDATE: owner updates own; super admins update all in scope
CREATE POLICY "Owners can update own prospects" ON public.prospects
  FOR UPDATE USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  ) WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can update all prospects" ON public.prospects
  FOR UPDATE USING (super_admin_in_scope(imo_id));

-- DELETE: owner deletes own; super admins delete all in scope
CREATE POLICY "Owners can delete own prospects" ON public.prospects
  FOR DELETE USING (
    owner_id = (SELECT auth.uid())
    AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))
  );

CREATE POLICY "Super admins can delete all prospects" ON public.prospects
  FOR DELETE USING (super_admin_in_scope(imo_id));

-- Blanket revocation deny (RESTRICTIVE, all commands) — mirrors sibling tables
CREATE POLICY "revocation_deny" ON public.prospects
  AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT is_access_revoked(auth.uid())));

COMMENT ON TABLE public.prospects IS
  'Lightweight agent-owned follow-up contacts (no auth account, no email). Convert promotes to a real recruit via create-auth-user.';
