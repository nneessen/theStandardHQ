-- Collapse billing to ONE $25/mo base plan + ONE $25/mo AI add-on.
--
-- WHY: The product is being simplified to a single tier. The owner wants one
-- $25/month plan that includes ALL non-AI features, with ALL AI (Jarvis/Command
-- Center, call analysis, AI sales scripts, predictive analytics) free for his
-- personal team (Epic Life IMO `free_all_features` + super-admins) and sold to
-- everyone else through ONE $25/month "AI Suite" add-on. The legacy AI SMS bot
-- (`ai_chat_bot`) and AI voice agent (`premium_voice`) become team-only + hidden
-- + unsold; Close KPIs and the Close AI Template Builder are retired.
--
-- CONTEXT (verified pre-flight): all 46 live user_subscriptions sit on `free`
-- (44 Epic Life → keep full access via free_all_features bypass; the rest are
-- FFG, already hard-blocked at login). ZERO paying Stripe subscribers, so this
-- is a data-only reconfiguration, not a re-pricing of live subscriptions. The
-- plan `features` / `analytics_sections` maps were entirely empty/false before
-- this migration (real access flowed through bypass paths), so the base plan is
-- populated here so a future PAYING outside user actually receives full non-AI
-- access.
--
-- DEFAULT-SUBSCRIPTION TRIGGER: intentionally UNCHANGED. `create_default_
-- subscription()` already assigns new users the `free` plan with no grandfather.
-- After this migration `free` is is_active=false with an empty feature map, so
-- new outside users land paywalled and must subscribe to the $25 base plan —
-- exactly the intended "no free tier for outside-team users" funnel. The row
-- still exists (lookup is by name, ignores is_active), preserving the
-- "subscription row exists" invariant many hooks rely on.
--
-- STRIPE: the base plan keeps `pro`'s existing live $25/mo price
-- (price_1T1tToRYi2kelWQkF48YJFma). The `ai_assistant` add-on uses the live $25/mo
-- price `price_1TimzCRYi2kelWQk3ogTJ1Hg` (product prod_UiDQX191R6bDhX), set
-- directly in subscription_addons.stripe_price_id_monthly below.
--
-- IDEMPOTENT: all statements are UPDATE / INSERT..ON CONFLICT on existing rows;
-- re-running converges to the same state. No schema/column change → no
-- database.types.ts regen.

BEGIN;

-- 1. Reconfigure `pro` into the single $25/mo base plan: ALL non-AI features.
--    Keep name='pro' (literal referenced by PLAN_TIER_ORDER / analytics tier
--    maps); only the display_name changes. AI-adjacent keys stay false:
--    close_kpi + close_ai_builder are retired; slack is dead (Slack removed).
UPDATE subscription_plans
SET
  display_name = 'Standard',
  description  = 'Everything you need to run your business — one simple plan.',
  features = jsonb_build_object(
    'sms', true, 'email', true, 'slack', false,
    'expenses', true, 'policies', true, 'settings', true,
    'training', true, 'analytics', true,
    'close_kpi', false,            -- retired (Close CRM abandoned)
    'dashboard', true, 'hierarchy', true, 'overrides', true,
    'comp_guide', true, 'recruiting', true, 'leaderboard', true,
    'reports_view', true, 'targets_full', true, 'targets_basic', true,
    'business_tools', true, 'connect_upline', true, 'reports_export', true,
    'team_analytics', true, 'custom_branding', true,
    'close_ai_builder', false,     -- retired (Close CRM abandoned)
    'downline_reports', true, 'recruiting_basic', true,
    'instagram_messaging', true, 'instagram_templates', true,
    'recruiting_custom_pipeline', true, 'instagram_scheduled_messages', true
  ),
  analytics_sections = ARRAY[
    'pace_metrics','carriers_products','product_matrix','policy_status_breakdown',
    'geographic','client_segmentation','game_plan','commission_pipeline'
    -- 'predictive_analytics' intentionally EXCLUDED → only unlockable via the AI add-on
  ]::text[],
  email_limit     = 500,           -- base now includes everything (old `team` value)
  sms_enabled     = true,
  team_size_limit = NULL,          -- unlimited
  is_active       = true,
  updated_at      = now()
WHERE name = 'pro';

-- 2. Deactivate the other plans. Keep the rows (don't delete): `free` remains the
--    paywalled default the signup trigger assigns; `team`/`starter` archived.
UPDATE subscription_plans
SET is_active = false, updated_at = now()
WHERE name IN ('free', 'team', 'starter');

-- 3. Deactivate the legacy add-ons.
--    - uw_wizard: non-AI → folded into the $25 base, no longer a separate buy.
--    - ai_chat_bot / premium_voice: team-only + hidden + never sold. Safe: their
--      runtime gates on the provisioned agent's provisioning_status, NOT on
--      addon.is_active, so the team's live bots/voice keep working; this only
--      blocks NEW purchases via manage-subscription-items.
UPDATE subscription_addons
SET is_active = false, updated_at = now()
WHERE name IN ('uw_wizard', 'ai_chat_bot', 'premium_voice');

-- 4. The single AI add-on ($25/mo). One entitlement that unlocks all AI for
--    outside-team buyers. stripe_price_id_monthly is the live $25/mo price (set
--    below). price_annual is a non-discounted placeholder (annual not offered
--    yet → no annual Stripe price → not self-serve purchasable).
INSERT INTO subscription_addons
  (name, display_name, description, price_monthly, price_annual, is_active, sort_order, stripe_price_id_monthly)
VALUES (
  'ai_assistant',
  'AI Suite',
  'All AI features: the Command Center assistant (Jarvis), AI call analysis, AI sales scripts, and predictive analytics.',
  2500, 30000, true, 10,
  'price_1TimzCRYi2kelWQk3ogTJ1Hg'  -- live $25/mo price (Stripe product prod_UiDQX191R6bDhX)
)
ON CONFLICT (name) DO UPDATE SET
  display_name            = EXCLUDED.display_name,
  description             = EXCLUDED.description,
  price_monthly           = EXCLUDED.price_monthly,
  price_annual            = EXCLUDED.price_annual,
  is_active               = true,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  updated_at              = now();

COMMIT;
