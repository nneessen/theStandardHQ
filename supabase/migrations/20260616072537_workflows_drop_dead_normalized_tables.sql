-- Workflows cleanup — drop the unused normalized tables workflow_actions and
-- workflow_triggers. The engine stores actions in the workflows.actions JSONB
-- column and the trigger in workflows.config->'trigger'; these two tables were
-- never read or written by any app/edge code (referenced only in a TS constants
-- map) and contain 0 rows. RLS was enabled on them, so this is cleanup, not a
-- security fix. They can be reconstructed from the archived create migration if
-- a normalized model is ever wanted.

DROP TABLE IF EXISTS public.workflow_actions;
DROP TABLE IF EXISTS public.workflow_triggers;
