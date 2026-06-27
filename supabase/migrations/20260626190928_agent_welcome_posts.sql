-- Agent "welcome post" approval queue (Social Studio / Spotlight).
-- When an approved agent uploads their FIRST profile photo, a trigger queues a draft welcome
-- post. The agency owner (super-admin) reviews the queue in Social Studio and approves (the
-- browser renders the NewAgentCard -> PNG -> existing schedule/publish path) or denies it. The
-- image is rendered client-side at approval, so the draft holds DATA only (no image_url), which
-- is why this is a separate table rather than a row in instagram_scheduled_posts.
--
-- SCOPE = "just my team": the trigger only fires for IMOs with a CONNECTED Instagram integration.
-- AUTHORITY: read + approve/deny are gated to the agency super-admin, NOT any IMO member, so a
-- downline agent can never self-publish to the company Instagram.

-- 1. Status.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'welcome_post_status') THEN
    CREATE TYPE public.welcome_post_status AS ENUM ('pending', 'approved', 'denied');
  END IF;
END$$;

-- 2. Drafts table — at most one queued welcome per agent (UNIQUE agent_id).
CREATE TABLE IF NOT EXISTS public.agent_welcome_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id      uuid NOT NULL REFERENCES public.imos(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name  text NOT NULL,
  photo_url   text NOT NULL,
  status      public.welcome_post_status NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz,
  decided_by  uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS agent_welcome_posts_imo_status_idx
  ON public.agent_welcome_posts (imo_id, status);

ALTER TABLE public.agent_welcome_posts ENABLE ROW LEVEL SECURITY;

-- Reads: the agency super-admin sees ONLY their agency's drafts. Writes go through the RPCs +
-- trigger (SECURITY DEFINER) only — no direct INSERT/UPDATE/DELETE grant to authenticated.
REVOKE ALL ON public.agent_welcome_posts FROM anon, authenticated;
GRANT SELECT ON public.agent_welcome_posts TO authenticated;

DROP POLICY IF EXISTS agent_welcome_posts_select ON public.agent_welcome_posts;
CREATE POLICY agent_welcome_posts_select ON public.agent_welcome_posts
  FOR SELECT TO authenticated
  USING (public.is_super_admin() AND imo_id = public.get_effective_imo_id());

-- 3. Trigger — queue a draft on the FIRST photo upload for an approved agent in an IG-connected
--    IMO. EXCEPTION-SAFE: a failure here must NEVER abort the agent's photo save.
CREATE OR REPLACE FUNCTION public.queue_agent_welcome_post()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    IF NEW.profile_photo_url IS NOT NULL
       AND OLD.profile_photo_url IS NULL
       AND NEW.approval_status = 'approved'
       AND NEW.archived_at IS NULL
       AND EXISTS (
         SELECT 1 FROM public.instagram_integrations ii
         WHERE ii.imo_id = NEW.imo_id
           AND ii.connection_status = 'connected'
           AND ii.is_active
       )
    THEN
      INSERT INTO public.agent_welcome_posts (imo_id, agent_id, agent_name, photo_url)
      VALUES (
        NEW.imo_id,
        NEW.id,
        NULLIF(TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), ''),
        NEW.profile_photo_url
      )
      ON CONFLICT (agent_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'queue_agent_welcome_post failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_agent_welcome_post ON public.user_profiles;
CREATE TRIGGER trg_queue_agent_welcome_post
  AFTER UPDATE OF profile_photo_url ON public.user_profiles
  FOR EACH ROW
  WHEN (NEW.profile_photo_url IS DISTINCT FROM OLD.profile_photo_url)
  EXECUTE FUNCTION public.queue_agent_welcome_post();

-- 4. Approve / deny — super-admin only, scoped to their agency. Approve marks the draft consumed
--    AFTER the browser has rendered + scheduled/published via the existing IG path; deny drops it.
CREATE OR REPLACE FUNCTION public.approve_agent_welcome_post(p_id uuid)
RETURNS public.agent_welcome_posts
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE v_row public.agent_welcome_posts;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.agent_welcome_posts
  SET status = 'approved', decided_at = now(), decided_by = auth.uid()
  WHERE id = p_id
    AND imo_id = public.get_effective_imo_id()
    AND status = 'pending'
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'welcome post not found or not pending';
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.deny_agent_welcome_post(p_id uuid)
RETURNS public.agent_welcome_posts
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE v_row public.agent_welcome_posts;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.agent_welcome_posts
  SET status = 'denied', decided_at = now(), decided_by = auth.uid()
  WHERE id = p_id
    AND imo_id = public.get_effective_imo_id()
    AND status = 'pending'
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'welcome post not found or not pending';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_agent_welcome_post(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deny_agent_welcome_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_agent_welcome_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deny_agent_welcome_post(uuid) TO authenticated;
