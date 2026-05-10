-- Add foreign-key constraint from training_lesson_content.document_id to
-- training_documents(id). The column has always logically referenced
-- training_documents but no FK was declared, which caused two problems:
--   1. PostgREST refused to embed training_documents in selects ("Could
--      not find a relationship in the schema cache"), forcing client-side
--      stitching of the join.
--   2. Orphan document_id values could survive a training_documents
--      delete with no referential safeguard.
--
-- Verified zero orphans on remote (2026-05-09) before adding the
-- constraint. ON DELETE SET NULL preserves the lesson content row when a
-- document is deleted instead of cascading the deletion.

ALTER TABLE public.training_lesson_content
  ADD CONSTRAINT training_lesson_content_document_id_fkey
  FOREIGN KEY (document_id)
  REFERENCES public.training_documents(id)
  ON DELETE SET NULL;
