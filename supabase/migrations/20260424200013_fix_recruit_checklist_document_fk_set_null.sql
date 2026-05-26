-- Fix recruit_checklist_progress.document_id FK to ON DELETE SET NULL.
--
-- Problem: admin_deleteuser RPC deletes user_documents before recruit_checklist_progress.
-- The existing FK has no ON DELETE action (defaults to NO ACTION), so any checklist_progress
-- row referencing a deleted user_document blocks the delete with SQLSTATE 23503.
--
-- Fix: align with agency_id/imo_id on the same table — set document_id to NULL when the
-- referenced user_document is deleted. The checklist row itself is still valid (the
-- checklist item exists); only the proof-of-completion document reference is lost.

ALTER TABLE recruit_checklist_progress
  DROP CONSTRAINT IF EXISTS recruit_checklist_progress_document_id_fkey;

ALTER TABLE recruit_checklist_progress
  ADD CONSTRAINT recruit_checklist_progress_document_id_fkey
  FOREIGN KEY (document_id)
  REFERENCES user_documents(id)
  ON DELETE SET NULL;
