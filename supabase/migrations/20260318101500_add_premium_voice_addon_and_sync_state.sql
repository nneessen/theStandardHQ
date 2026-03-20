-- Add premium voice addon SKU and sync telemetry for standard-chat-bot entitlement state.

BEGIN;

ALTER TABLE user_subscription_addons
  ADD COLUMN IF NOT EXISTS voice_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (voice_sync_status IN ('pending', 'synced', 'degraded')),
  ADD COLUMN IF NOT EXISTS voice_last_sync_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_last_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS voice_last_sync_http_status INTEGER,
  ADD COLUMN IF NOT EXISTS voice_last_sync_event_id TEXT,
  ADD COLUMN IF NOT EXISTS voice_entitlement_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_user_subscription_addons_voice_sync_status
  ON user_subscription_addons (voice_sync_status);

CREATE INDEX IF NOT EXISTS idx_user_subscription_addons_voice_last_sync_attempt_at
  ON user_subscription_addons (voice_last_sync_attempt_at DESC)
  WHERE voice_last_sync_attempt_at IS NOT NULL;

INSERT INTO subscription_addons (
  name,
  display_name,
  description,
  price_monthly,
  price_annual,
  sort_order,
  tier_config
)
VALUES (
  'premium_voice',
  'Premium Voice',
  'Voice calling add-on for missed appointments, reschedules, and after-hours inbound coverage in standard-chat-bot.',
  9900,
  99000,
  3,
  jsonb_build_object(
    'tiers',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'voice_pro',
        'name', 'Voice Pro',
        'runs_per_month', 500,
        'included_minutes', 500,
        'hard_limit_minutes', 500,
        'plan_code', 'voice_pro_v1',
        'allow_overage', false,
        'overage_rate_cents', NULL,
        'features', jsonb_build_object(
          'missedAppointment', true,
          'reschedule', true,
          'quotedFollowup', false,
          'afterHoursInbound', true
        ),
        'price_monthly', 9900,
        'price_annual', 99000,
        'stripe_price_id_monthly', NULL,
        'stripe_price_id_annual', NULL
      )
    )
  )
)
ON CONFLICT (name) DO NOTHING;

COMMIT;
