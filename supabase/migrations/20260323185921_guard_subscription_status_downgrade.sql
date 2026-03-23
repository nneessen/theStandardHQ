-- Migration: Guard against out-of-order subscription.created events downgrading active status
--
-- Root cause: When a user subscribes, Stripe fires subscription.created (status=incomplete)
-- and subscription.updated (status=active) nearly simultaneously. If the created event is
-- processed AFTER the updated event, it overwrites the active status with incomplete
-- (mapped to past_due). The invoice.paid safety net couldn't recover because
-- invoice.subscription is null in API version 2026-01-28.clover.
--
-- Fix: When processing subscription.created events, do NOT allow downgrading from active
-- to a non-active status. The subscription.updated event already set the correct status.

CREATE OR REPLACE FUNCTION process_stripe_subscription_event(
  p_event_type TEXT,
  p_event_name TEXT,
  p_stripe_event_id TEXT,
  p_stripe_subscription_id TEXT,
  p_stripe_customer_id TEXT,
  p_stripe_checkout_session_id TEXT,
  p_stripe_price_id TEXT,
  p_user_id UUID,
  p_status TEXT,
  p_billing_interval TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_trial_ends_at TIMESTAMPTZ,
  p_cancelled_at TIMESTAMPTZ,
  p_event_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_plan subscription_plans;
  v_event_id UUID;
  v_current_sub RECORD;
  v_has_deleted_event BOOLEAN := FALSE;
  v_current_status TEXT;
BEGIN
  -- Check idempotency - return existing event if already processed
  SELECT id INTO v_event_id
  FROM subscription_events
  WHERE stripe_event_id = p_stripe_event_id;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  -- Guard: skip UPSERT if this specific subscription was already deleted (out-of-order event protection)
  -- Only applies to created/updated/resumed events, not deleted events (which are handled separately)
  IF p_event_name IN ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.resumed') THEN
    SELECT stripe_subscription_id, cancelled_at
    INTO v_current_sub
    FROM user_subscriptions
    WHERE user_id = p_user_id;

    IF v_current_sub IS NOT NULL
       AND v_current_sub.stripe_subscription_id IS NULL
       AND v_current_sub.cancelled_at IS NOT NULL THEN
      -- Check if a deleted event exists for THIS SPECIFIC subscription ID
      -- (not just any deleted event for this user — that would block re-subscribes)
      SELECT EXISTS(
        SELECT 1 FROM subscription_events
        WHERE user_id = p_user_id
          AND event_name = 'customer.subscription.deleted'
          AND event_data->'data'->'object'->>'id' = p_stripe_subscription_id
      ) INTO v_has_deleted_event;

      IF v_has_deleted_event THEN
        -- Log the event as skipped but do NOT perform the UPSERT
        INSERT INTO subscription_events (
          user_id, event_type, event_name, stripe_event_id, event_data, processed_at, error_message
        ) VALUES (
          p_user_id, p_event_type, p_event_name, p_stripe_event_id, p_event_data, now(),
          'Skipped: subscription ' || p_stripe_subscription_id || ' was already deleted (out-of-order event protection)'
        )
        RETURNING id INTO v_event_id;

        RETURN v_event_id;
      END IF;
    END IF;
  END IF;

  -- Guard: subscription.created with non-active status should not overwrite an already-active subscription.
  -- During checkout, Stripe fires subscription.created (incomplete) and subscription.updated (active)
  -- nearly simultaneously. If created arrives after updated, it would downgrade active → incomplete/past_due.
  IF p_event_name = 'customer.subscription.created' AND p_status NOT IN ('active', 'trialing') THEN
    SELECT status INTO v_current_status
    FROM user_subscriptions
    WHERE user_id = p_user_id
      AND stripe_subscription_id = p_stripe_subscription_id;

    IF v_current_status = 'active' THEN
      -- Log the event as skipped — the subscription.updated event already set the correct status
      INSERT INTO subscription_events (
        user_id, event_type, event_name, stripe_event_id, event_data, processed_at, error_message
      ) VALUES (
        p_user_id, p_event_type, p_event_name, p_stripe_event_id, p_event_data, now(),
        'Skipped: subscription.created would downgrade active status to ' || p_status || ' (out-of-order event protection)'
      )
      RETURNING id INTO v_event_id;

      RETURN v_event_id;
    END IF;
  END IF;

  -- Get the plan from price ID
  IF p_stripe_price_id IS NOT NULL THEN
    v_plan := get_plan_by_stripe_price(p_stripe_price_id);
  END IF;

  IF v_plan IS NULL AND p_stripe_price_id IS NOT NULL THEN
    -- Log event with error
    INSERT INTO subscription_events (
      user_id, event_type, event_name, stripe_event_id, event_data, error_message
    ) VALUES (
      p_user_id, p_event_type, p_event_name, p_stripe_event_id, p_event_data,
      'Plan not found for Stripe price: ' || p_stripe_price_id
    )
    RETURNING id INTO v_event_id;
    RETURN v_event_id;
  END IF;

  -- Upsert subscription
  INSERT INTO user_subscriptions (
    user_id,
    plan_id,
    status,
    billing_interval,
    stripe_subscription_id,
    stripe_customer_id,
    stripe_checkout_session_id,
    current_period_start,
    current_period_end,
    trial_ends_at,
    cancelled_at,
    cancel_at_period_end
  ) VALUES (
    p_user_id,
    COALESCE(v_plan.id, (SELECT plan_id FROM user_subscriptions WHERE user_id = p_user_id)),
    p_status,
    p_billing_interval,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_stripe_checkout_session_id,
    p_current_period_start,
    p_current_period_end,
    p_trial_ends_at,
    p_cancelled_at,
    CASE WHEN p_cancelled_at IS NOT NULL THEN true ELSE false END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = COALESCE(EXCLUDED.plan_id, user_subscriptions.plan_id),
    status = EXCLUDED.status,
    billing_interval = EXCLUDED.billing_interval,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_checkout_session_id = COALESCE(EXCLUDED.stripe_checkout_session_id, user_subscriptions.stripe_checkout_session_id),
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    trial_ends_at = EXCLUDED.trial_ends_at,
    cancelled_at = EXCLUDED.cancelled_at,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    -- Clear grandfathered status when real subscription starts
    grandfathered_until = CASE
      WHEN EXCLUDED.status = 'active' AND EXCLUDED.stripe_subscription_id IS NOT NULL
      THEN NULL
      ELSE user_subscriptions.grandfathered_until
    END,
    updated_at = now()
  RETURNING id INTO v_subscription_id;

  -- Log the event
  INSERT INTO subscription_events (
    user_id, subscription_id, event_type, event_name, stripe_event_id, event_data, processed_at
  ) VALUES (
    p_user_id, v_subscription_id, p_event_type, p_event_name, p_stripe_event_id, p_event_data, now()
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Ensure execution is locked to service_role only
REVOKE ALL ON FUNCTION process_stripe_subscription_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_stripe_subscription_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM anon;
REVOKE ALL ON FUNCTION process_stripe_subscription_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION process_stripe_subscription_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) TO service_role;
