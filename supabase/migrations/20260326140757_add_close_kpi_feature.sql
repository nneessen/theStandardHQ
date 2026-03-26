-- Add close_kpi feature to subscription plans
-- Pro and Team: enabled, Free and all others: disabled

UPDATE subscription_plans
SET features = features || '{"close_kpi": true}'::jsonb
WHERE name IN ('pro', 'team');

UPDATE subscription_plans
SET features = features || '{"close_kpi": false}'::jsonb
WHERE NOT (features ? 'close_kpi');
