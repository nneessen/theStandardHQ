-- ============================================================================
-- Account Lifecycle Audit Tables
-- ============================================================================
-- Two append-only logs that record data exports and account deletions for the
-- platform-sunset flow. CRITICAL: these rows must SURVIVE the user's deletion,
-- so user_id / imo_id are stored as PLAIN columns with NO foreign keys — the
-- referenced user_profiles / auth.users rows will be gone, and the identifying
-- snapshot columns (email, full_name) preserve who the row was about.
--
-- RLS is enabled with NO authenticated policies => denied to all normal users.
-- The export/wipe edge functions write/read via the service-role client, which
-- bypasses RLS. A super-admin read path can be added later via a SECURITY
-- DEFINER RPC if needed.
--
-- DORMANT: tables are inert until the sunset edge functions populate them.
-- ============================================================================

-- Records every export bundle generated (pre-scan at activation + self-service).
CREATE TABLE IF NOT EXISTS public.data_export_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,                 -- NO FK (must survive wipe)
  email               text,                          -- identity snapshot
  full_name           text,                          -- identity snapshot
  imo_id              uuid,                           -- NO FK (filter post-wipe)
  status              text NOT NULL DEFAULT 'pending',-- pending|generating|ready|failed
  format              text,                           -- xlsx|csv|json (bundle is multi-format)
  bundle_storage_path text,                           -- account-recovery-archives/snapshots/{user}/...
  bundle_bytes        bigint,
  trigger             text,                           -- activation_prescan|self_service
  error               text,
  generated_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_export_log_user ON public.data_export_log (user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_log_imo  ON public.data_export_log (imo_id);
CREATE INDEX IF NOT EXISTS idx_data_export_log_status ON public.data_export_log (status);

COMMENT ON TABLE public.data_export_log IS
  'Append-only audit of sunset-flow export bundles. user_id/imo_id are FK-less so rows survive account deletion.';

-- Records every account deletion (self-confirmed + 7-day auto-purge).
CREATE TABLE IF NOT EXISTS public.account_deletion_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,               -- NO FK (user is gone)
  email                 text,                         -- identity snapshot
  full_name             text,                         -- identity snapshot
  imo_id                uuid,                          -- NO FK
  deletion_reason       text NOT NULL,                -- self_confirmed|auto_purge_7d
  stripe_subscription_id text,
  stripe_canceled       boolean DEFAULT false,
  auth_user_deleted     boolean DEFAULT false,
  recovery_archive_path text,                          -- account-recovery-archives/recovery/{user}/...
  recovery_expires_at   timestamptz,                   -- archive destroyed after this (30d)
  manifest              jsonb,                          -- per-table row counts wiped
  deleted_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_log_user ON public.account_deletion_log (user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_log_imo  ON public.account_deletion_log (imo_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_log_recovery
  ON public.account_deletion_log (recovery_expires_at)
  WHERE recovery_archive_path IS NOT NULL;

COMMENT ON TABLE public.account_deletion_log IS
  'Append-only audit of sunset-flow account deletions. FK-less identity columns survive the deletion they record.';

-- Service-role-only access: RLS on, no authenticated policies.
ALTER TABLE public.data_export_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_log ENABLE ROW LEVEL SECURITY;
