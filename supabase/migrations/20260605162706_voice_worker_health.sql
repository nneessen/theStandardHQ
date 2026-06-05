-- supabase/migrations/20260605162706_voice_worker_health.sql
-- Jarvis voice worker liveness — single-row operational health record.
--
-- The realtime voice worker (services/jarvis-voice-worker, on Fly.io) is an
-- always-resident process that connects OUT to LiveKit Cloud and serves no public
-- HTTP. If it dies, nobody is told. This table is the landing pad for an outbound
-- HEARTBEAT the worker POSTs every ~30s (via the voice-worker-heartbeat edge fn),
-- plus the MONITOR's own up/down bookkeeping (voice-worker-health-check edge fn,
-- triggered every 15m by .github/workflows/voice-worker-health.yml). The monitor
-- alerts the owner (SMS + email) on a healthy->down transition and clears on recovery.
--
-- This is a GLOBAL operational singleton (NOT per-user): exactly one row, id = true.
-- It holds no business/PII data — only liveness timestamps and the machine id.
--
-- Access: RLS is enabled with NO policies, so anon/authenticated get zero rows. Only
-- the Supabase service_role (which bypasses RLS, and is the only caller — both edge
-- functions use the admin client) can read/write it. monitor_status is enum-like TEXT
-- with no CHECK, per project convention (valid values enforced in the edge function).

CREATE TABLE IF NOT EXISTS voice_worker_health (
  -- Singleton guard: every write upserts id = true, so there is at most one row.
  id BOOLEAN PRIMARY KEY DEFAULT true,
  -- Heartbeat (written by voice-worker-heartbeat on each worker ping).
  last_seen_at TIMESTAMPTZ,
  machine_id TEXT,
  -- Diagnostic only: when the worker last received a LiveKit job (a real call).
  -- Stale during normal idle, so it is NEVER used as a down-signal — context only.
  last_job_at TIMESTAMPTZ,
  -- Monitor bookkeeping (written by voice-worker-health-check).
  monitor_status TEXT NOT NULL DEFAULT 'up', -- 'up' | 'down' (TS-enforced; no CHECK)
  down_since TIMESTAMPTZ,
  last_alert_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE voice_worker_health ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: deny-all to anon/authenticated. service_role bypasses RLS.

-- updated_at trigger (reuse the canonical update_updated_at_column()).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_voice_worker_health_updated_at') THEN
    CREATE TRIGGER update_voice_worker_health_updated_at
      BEFORE UPDATE ON voice_worker_health
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Seed the singleton so the monitor's first run has a row to read/update. last_seen_at
-- stays NULL until the first heartbeat; the monitor treats a NULL/old last_seen_at as
-- "no heartbeat yet" and relies on the Fly machine-state check on the very first runs.
INSERT INTO voice_worker_health (id, monitor_status)
VALUES (true, 'up')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE voice_worker_health IS 'Singleton liveness record for the Jarvis voice worker (Fly.io). Heartbeat landing pad + monitor up/down bookkeeping. RLS-locked to service_role.';
COMMENT ON COLUMN voice_worker_health.last_seen_at IS 'Last worker heartbeat (POSTed ~every 30s). Proves event-loop liveness + outbound reachability (NOT LiveKit registration — that is not exposed by @livekit/agents).';
COMMENT ON COLUMN voice_worker_health.last_job_at IS 'Diagnostic: last LiveKit job dispatch. Stale when idle — never a down-signal.';
COMMENT ON COLUMN voice_worker_health.monitor_status IS 'up|down — monitor de-dup state so it alerts once per transition, not every 15m.';
