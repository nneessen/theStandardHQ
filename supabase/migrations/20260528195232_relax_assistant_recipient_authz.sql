-- Relax M2 recipient authorization from an in-system allowlist to a format check.
--
-- WHY: the command center always sends behind a human review+approval step, and the
-- model can no longer set the recipient at all (draftEmailMessage / draftSmsMessage
-- now insert recipient = NULL). The recipient is therefore ALWAYS entered and
-- confirmed by a human in the approval modal before anything sends. With the human
-- as the addressing authority, the in-system allowlist (clients/recruiting_leads/
-- user_profiles) is no longer the gate — Nick wants to be able to send to anyone he
-- chooses. We keep a basic shape check so malformed/empty recipients still fail.
--
-- SECURITY NOTE — IF THE MODEL IS EVER ALLOWED TO SET THE RECIPIENT AGAIN (e.g. a
-- future "auto-fill recipient" feature), RESTORE the allowlist for model-chosen
-- recipients (or tag human-entered rows and bypass only those). The allowlist was
-- the anti-exfiltration guard against a prompt-injected model emailing a stranger;
-- removing it is only safe while every recipient is human-entered + human-approved.

CREATE OR REPLACE FUNCTION assistant_recipient_is_allowed(
  p_channel   TEXT,
  p_recipient TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email  TEXT;
  v_digits TEXT;
BEGIN
  IF p_recipient IS NULL OR length(trim(p_recipient)) = 0 THEN
    RETURN false;
  END IF;

  IF p_channel = 'email' THEN
    v_email := lower(trim(p_recipient));
    -- Basic, permissive email shape: local@domain.tld, no whitespace. Rejects
    -- garbage; allows any real address the human approves.
    RETURN v_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  ELSIF p_channel = 'sms' THEN
    -- At least 10 digits after stripping non-digits identifies a real number.
    v_digits := regexp_replace(p_recipient, '\D', '', 'g');
    RETURN length(v_digits) >= 10;
  END IF;

  RETURN false;  -- unknown channel
END;
$$;

REVOKE ALL ON FUNCTION assistant_recipient_is_allowed(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assistant_recipient_is_allowed(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION assistant_recipient_is_allowed(TEXT, TEXT) IS
  'M2 (relaxed): true if p_recipient is a well-formed email (or a phone with >=10 digits). No longer an in-system allowlist — the recipient is always human-entered and human-approved in the review modal, and the model can no longer set it. If model-set recipients are reintroduced, restore the allowlist for those.';
