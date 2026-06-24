-- WI-6 multi-account: allow ONE user/agency to connect MULTIPLE Instagram accounts.
--
-- The original table enforced one row per (user_id, imo_id) via
-- instagram_integrations_user_imo_unique. That cap is what limited an agency to a single
-- connected Instagram account: the OAuth callback would UPDATE (overwrite) the existing
-- row on every connect instead of adding a second account.
--
-- Dropping it is safe: the constraint currently PREVENTS duplicates, so none exist to
-- conflict, and removing a UNIQUE constraint only loosens — it cannot corrupt data.
--
-- KEPT (do NOT drop): instagram_integrations_ig_user_unique UNIQUE(instagram_user_id).
-- instagram_user_id (the IGSID) is globally unique and routes inbound DM webhooks, so one
-- real Instagram account must still map to exactly one row platform-wide. The OAuth
-- callback keys on it (same account UPDATEs its row; a new account INSERTs a new row).

ALTER TABLE public.instagram_integrations
  DROP CONSTRAINT instagram_integrations_user_imo_unique;
