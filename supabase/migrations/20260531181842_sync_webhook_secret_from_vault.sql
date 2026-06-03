-- H4 remediation prep: read the policy/client sync webhook secret from Vault, not hardcoded.
--
-- The secret '1ceabec3…455f2' was hardcoded in THREE places (committed to source + git history)
-- and `get_sync_webhook_secret()` was anon-EXECUTE-able (any holder of the public anon key could
-- read it). This migration points all three at Vault key `sync_webhook_secret` (already populated
-- with the CURRENT value on local + remote, so this is a no-op functionally — NOT a value rotation)
-- and revokes anon from the getter.
--
-- TO ACTUALLY ROTATE THE VALUE (separate, coordinated step — do NOT do it in code):
--   1. SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name='sync_webhook_secret'),
--        '<new-secret>');   -- on THIS project (local + remote)
--   2. Update the CONSUMER project `lopznswmsgkccydrsomy` (newAgentPortal) sync-policy / sync-client
--        functions to expect '<new-secret>' in the x-webhook-secret header.
--   Both sides must change together or the policy/client sync breaks.
--
-- Bodies below reproduce the LIVE prod definitions verbatim except: (a) the secret is read from
-- Vault instead of a literal, and (b) a NULL-secret guard skips the webhook instead of sending
-- with no/invalid auth. (vault.decrypted_secrets is schema-qualified because search_path='public'.)

BEGIN;

-- ---- get_sync_webhook_secret(): Vault-only, no hardcoded fallback, service_role only (H4) ----
CREATE OR REPLACE FUNCTION public.get_sync_webhook_secret()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'sync_webhook_secret'
  LIMIT 1;
  -- No hardcoded fallback. Returns NULL when unset so callers fail loudly, not on a leaked constant.
  RETURN v_secret;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_sync_webhook_secret() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_sync_webhook_secret() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_sync_webhook_secret() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sync_webhook_secret() TO service_role;

-- ---- notify_policy_webhook(): read secret from Vault ----
CREATE OR REPLACE FUNCTION public.notify_policy_webhook()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url text := 'https://lopznswmsgkccydrsomy.supabase.co/functions/v1/sync-policy';
  webhook_secret text;
  payload jsonb;
  request_id bigint;
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping policy sync webhook for policy % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO webhook_secret
  FROM vault.decrypted_secrets WHERE name = 'sync_webhook_secret' LIMIT 1;
  IF webhook_secret IS NULL THEN
    RAISE WARNING 'sync_webhook_secret not configured in Vault; skipping policy sync for %', NEW.id;
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'policies',
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE
      WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)
      ELSE NULL
    END
  );

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := payload
  ) INTO request_id;

  RAISE NOTICE 'Policy sync webhook sent: request_id=%, policy_id=%', request_id, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Policy sync webhook failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$function$;

-- ---- notify_client_webhook(): read secret from Vault ----
CREATE OR REPLACE FUNCTION public.notify_client_webhook()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url text := 'https://lopznswmsgkccydrsomy.supabase.co/functions/v1/sync-client';
  webhook_secret text;
  payload jsonb;
  request_id bigint;
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping client sync webhook for client % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO webhook_secret
  FROM vault.decrypted_secrets WHERE name = 'sync_webhook_secret' LIMIT 1;
  IF webhook_secret IS NULL THEN
    RAISE WARNING 'sync_webhook_secret not configured in Vault; skipping client sync for %', NEW.id;
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'clients',
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE
      WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)
      ELSE NULL
    END
  );

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := payload
  ) INTO request_id;

  RAISE NOTICE 'Client sync webhook sent: request_id=%, client_id=%', request_id, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Client sync webhook failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$function$;

COMMIT;
