-- Remove the DocuSeal e-signature feature (tables) — 2026-05-31.
--
-- The user does not use DocuSeal; the entire e-signature feature was removed from the
-- application code (src/services/signatures, src/hooks/signatures, recruiting checklist
-- "signature_required" item type, docuseal/docuseal-webhook edge functions). This drops
-- the 3 backing tables. Verified safe before applying:
--   * No NON-signature table has a foreign key referencing these (only inter-signature FKs).
--   * No DB function or view references signature_(submissions|submitters|templates).
--   * Prod data backed up to /tmp/secaudit/backup_signature_*.json (2 rows each, test data).
--
-- Drop order respects inter-table FKs (submitters -> submissions -> templates); CASCADE also
-- removes the tables' own RLS policies/triggers/constraints.

BEGIN;

DROP TABLE IF EXISTS public.signature_submitters CASCADE;
DROP TABLE IF EXISTS public.signature_submissions CASCADE;
DROP TABLE IF EXISTS public.signature_templates CASCADE;

COMMIT;
