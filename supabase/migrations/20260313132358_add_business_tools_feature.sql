-- Add business_tools feature to all subscription plans (default false)
UPDATE subscription_plans
SET features = features || '{"business_tools": false}'::jsonb
WHERE NOT (features ? 'business_tools');

-- Enable for Team tier by default
UPDATE subscription_plans
SET features = jsonb_set(features, '{business_tools}', 'true')
WHERE name = 'team';
