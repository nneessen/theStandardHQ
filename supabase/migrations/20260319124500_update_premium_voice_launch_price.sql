BEGIN;

UPDATE subscription_addons
SET
  price_monthly = 14900,
  price_annual = 149000,
  tier_config = jsonb_set(
    jsonb_set(
      COALESCE(tier_config, '{}'::jsonb),
      '{tiers,0,price_monthly}',
      to_jsonb(14900),
      true
    ),
    '{tiers,0,price_annual}',
    to_jsonb(149000),
    true
  )
WHERE name = 'premium_voice';

COMMIT;
