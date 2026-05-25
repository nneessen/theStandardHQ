# UW Wizard Tiered Pricing Implementation Plan

## Overview

Add usage-based tiered pricing to the UW Wizard addon to prevent abuse and monetize based on consumption.

## Tier Structure

| Tier | Monthly Runs | Price | Target User |
|------|--------------|-------|-------------|
| **Starter** | 150 | $9.99/mo | Light users, occasional quotes |
| **Professional** | 400 | $24.99/mo | Active agents |
| **Agency** | 1,000 | $49.99/mo | Small teams/agencies |
| **Enterprise** | Custom | Contact | Large agencies |

---

## Phase 1: Database Schema

### 1.1 Add tier configuration to subscription_addons

```sql
-- Add tier-related columns to subscription_addons
ALTER TABLE subscription_addons
ADD COLUMN IF NOT EXISTS tier_config JSONB DEFAULT NULL;

-- tier_config structure:
-- {
--   "tiers": [
--     { "id": "starter", "name": "Starter", "runs_per_month": 150, "price_monthly": 999, "price_annual": 9590 },
--     { "id": "professional", "name": "Professional", "runs_per_month": 400, "price_monthly": 2499, "price_annual": 23990 },
--     { "id": "agency", "name": "Agency", "runs_per_month": 1000, "price_monthly": 4999, "price_annual": 47990 }
--   ],
--   "overage_allowed": false,
--   "overage_price_per_run": 0
-- }
```

### 1.2 Add tier selection to user_subscription_addons

```sql
-- Add selected tier to user addon subscription
ALTER TABLE user_subscription_addons
ADD COLUMN IF NOT EXISTS tier_id TEXT DEFAULT NULL;
```

### 1.3 Create usage tracking table

```sql
-- New table: uw_wizard_usage
CREATE TABLE uw_wizard_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  imo_id UUID NOT NULL REFERENCES imos(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  runs_used INTEGER NOT NULL DEFAULT 0,
  runs_limit INTEGER NOT NULL,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, billing_period_start)
);

-- Index for fast lookups
CREATE INDEX idx_uw_wizard_usage_user_period
  ON uw_wizard_usage(user_id, billing_period_start DESC);
CREATE INDEX idx_uw_wizard_usage_imo
  ON uw_wizard_usage(imo_id);
```

### 1.4 Create usage logging table (audit trail)

```sql
-- New table: uw_wizard_usage_log (individual runs)
CREATE TABLE uw_wizard_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  imo_id UUID NOT NULL REFERENCES imos(id) ON DELETE CASCADE,
  session_id UUID,  -- Links to underwriting_wizard_sessions if saved
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_cents INTEGER,  -- For internal tracking
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for analytics
CREATE INDEX idx_uw_wizard_usage_log_user
  ON uw_wizard_usage_log(user_id, created_at DESC);
CREATE INDEX idx_uw_wizard_usage_log_imo
  ON uw_wizard_usage_log(imo_id, created_at DESC);
```

---

## Phase 2: Database Functions

### 2.1 Get current usage

```sql
CREATE OR REPLACE FUNCTION get_uw_wizard_usage(p_user_id UUID)
RETURNS TABLE (
  runs_used INTEGER,
  runs_limit INTEGER,
  runs_remaining INTEGER,
  usage_percent NUMERIC,
  billing_period_start DATE,
  billing_period_end DATE,
  tier_id TEXT,
  tier_name TEXT
) AS $$
DECLARE
  v_tier_id TEXT;
  v_tier_config JSONB;
  v_tier JSONB;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Get user's current tier
  SELECT usa.tier_id INTO v_tier_id
  FROM user_subscription_addons usa
  JOIN subscription_addons sa ON sa.id = usa.addon_id
  WHERE usa.user_id = p_user_id
    AND sa.name = 'uw_wizard'
    AND usa.status IN ('active', 'manual_grant')
    AND (usa.current_period_end IS NULL OR usa.current_period_end > now())
  LIMIT 1;

  -- Default to starter if no tier specified
  IF v_tier_id IS NULL THEN
    v_tier_id := 'starter';
  END IF;

  -- Get tier config
  SELECT tier_config INTO v_tier_config
  FROM subscription_addons
  WHERE name = 'uw_wizard';

  -- Find the tier details
  SELECT t INTO v_tier
  FROM jsonb_array_elements(v_tier_config->'tiers') t
  WHERE t->>'id' = v_tier_id;

  -- Calculate billing period (current month)
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;

  RETURN QUERY
  SELECT
    COALESCE(u.runs_used, 0) as runs_used,
    COALESCE((v_tier->>'runs_per_month')::INTEGER, 150) as runs_limit,
    GREATEST(0, COALESCE((v_tier->>'runs_per_month')::INTEGER, 150) - COALESCE(u.runs_used, 0)) as runs_remaining,
    CASE
      WHEN (v_tier->>'runs_per_month')::INTEGER > 0
      THEN ROUND((COALESCE(u.runs_used, 0)::NUMERIC / (v_tier->>'runs_per_month')::INTEGER) * 100, 1)
      ELSE 0
    END as usage_percent,
    v_period_start as billing_period_start,
    v_period_end as billing_period_end,
    v_tier_id as tier_id,
    COALESCE(v_tier->>'name', 'Starter') as tier_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.2 Check if user can run wizard

```sql
CREATE OR REPLACE FUNCTION can_run_uw_wizard(p_user_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  runs_remaining INTEGER,
  tier_id TEXT
) AS $$
DECLARE
  v_usage RECORD;
  v_has_access BOOLEAN;
BEGIN
  -- First check if user has UW Wizard access at all
  SELECT user_has_uw_wizard_access(p_user_id) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN QUERY SELECT
      false::BOOLEAN as allowed,
      'no_subscription'::TEXT as reason,
      0::INTEGER as runs_remaining,
      NULL::TEXT as tier_id;
    RETURN;
  END IF;

  -- Get usage
  SELECT * INTO v_usage FROM get_uw_wizard_usage(p_user_id);

  IF v_usage.runs_remaining <= 0 THEN
    RETURN QUERY SELECT
      false::BOOLEAN as allowed,
      'limit_exceeded'::TEXT as reason,
      0::INTEGER as runs_remaining,
      v_usage.tier_id::TEXT as tier_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true::BOOLEAN as allowed,
    'ok'::TEXT as reason,
    v_usage.runs_remaining::INTEGER as runs_remaining,
    v_usage.tier_id::TEXT as tier_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.3 Increment usage (called after successful AI run)

```sql
CREATE OR REPLACE FUNCTION increment_uw_wizard_usage(
  p_user_id UUID,
  p_imo_id UUID,
  p_session_id UUID DEFAULT NULL,
  p_input_tokens INTEGER DEFAULT NULL,
  p_output_tokens INTEGER DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_runs_used INTEGER,
  runs_remaining INTEGER
) AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_tier_id TEXT;
  v_runs_limit INTEGER;
  v_new_runs INTEGER;
BEGIN
  -- Calculate billing period
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;

  -- Get user's tier and limit
  SELECT
    usa.tier_id,
    COALESCE((t->>'runs_per_month')::INTEGER, 150)
  INTO v_tier_id, v_runs_limit
  FROM user_subscription_addons usa
  JOIN subscription_addons sa ON sa.id = usa.addon_id
  LEFT JOIN LATERAL (
    SELECT t FROM jsonb_array_elements(sa.tier_config->'tiers') t
    WHERE t->>'id' = COALESCE(usa.tier_id, 'starter')
  ) tier ON true
  WHERE usa.user_id = p_user_id
    AND sa.name = 'uw_wizard'
    AND usa.status IN ('active', 'manual_grant')
  LIMIT 1;

  -- Default values if no subscription found (shouldn't happen)
  IF v_runs_limit IS NULL THEN
    v_runs_limit := 150;
    v_tier_id := 'starter';
  END IF;

  -- Upsert usage record
  INSERT INTO uw_wizard_usage (
    user_id, imo_id, billing_period_start, billing_period_end,
    runs_used, runs_limit, last_run_at
  )
  VALUES (
    p_user_id, p_imo_id, v_period_start, v_period_end,
    1, v_runs_limit, now()
  )
  ON CONFLICT (user_id, billing_period_start)
  DO UPDATE SET
    runs_used = uw_wizard_usage.runs_used + 1,
    last_run_at = now(),
    updated_at = now()
  RETURNING runs_used INTO v_new_runs;

  -- Log the individual run
  INSERT INTO uw_wizard_usage_log (
    user_id, imo_id, session_id, input_tokens, output_tokens,
    estimated_cost_cents
  )
  VALUES (
    p_user_id, p_imo_id, p_session_id, p_input_tokens, p_output_tokens,
    -- Estimate: $3/1M input + $15/1M output
    CASE WHEN p_input_tokens IS NOT NULL AND p_output_tokens IS NOT NULL
      THEN ROUND((p_input_tokens * 0.003 + p_output_tokens * 0.015) / 10)::INTEGER
      ELSE NULL
    END
  );

  RETURN QUERY SELECT
    true as success,
    v_new_runs as new_runs_used,
    GREATEST(0, v_runs_limit - v_new_runs) as runs_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Phase 3: Edge Function Updates

### 3.1 Update underwriting-ai-analyze

Add quota check at the start:

```typescript
// At the start of the handler, after auth validation:

// Check usage quota
const { data: quotaCheck, error: quotaError } = await supabase
  .rpc('can_run_uw_wizard', { p_user_id: user.id });

if (quotaError || !quotaCheck?.[0]?.allowed) {
  const reason = quotaCheck?.[0]?.reason || 'unknown';
  const errorMessages: Record<string, string> = {
    'no_subscription': 'UW Wizard subscription required',
    'limit_exceeded': 'Monthly usage limit reached. Upgrade your plan for more runs.',
    'unknown': 'Unable to verify usage quota'
  };

  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessages[reason] || errorMessages.unknown,
      code: reason,
      runs_remaining: quotaCheck?.[0]?.runs_remaining || 0,
      tier_id: quotaCheck?.[0]?.tier_id
    }),
    {
      status: reason === 'no_subscription' ? 403 : 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ... rest of the function ...

// After successful AI call, increment usage:
const tokenUsage = {
  input: response.usage?.input_tokens || null,
  output: response.usage?.output_tokens || null
};

await supabase.rpc('increment_uw_wizard_usage', {
  p_user_id: user.id,
  p_imo_id: authenticatedImoId,
  p_session_id: null, // Could pass session ID if saving
  p_input_tokens: tokenUsage.input,
  p_output_tokens: tokenUsage.output
});
```

---

## Phase 4: Frontend Components

### 4.1 Usage Dashboard Widget

Location: `src/features/underwriting/components/UWUsageWidget.tsx`

Shows:
- Current usage (runs used / limit)
- Progress bar with color coding (green < 75%, yellow 75-90%, red > 90%)
- Days remaining in billing period
- Upgrade prompt when approaching limit

### 4.2 Update PremiumAddonsSection

Location: `src/features/settings/billing/components/PremiumAddonsSection.tsx`

Changes:
- Show tier options instead of single price
- Display current tier if subscribed
- Show usage stats for current tier
- Upgrade/downgrade options

### 4.3 Limit Reached Dialog

Location: `src/features/underwriting/components/UWLimitReachedDialog.tsx`

Shows when user hits their limit:
- "You've used all X runs this month"
- Current tier info
- Upgrade options with pricing
- Days until reset

### 4.4 Warning Notifications

Add toasts/banners at:
- 75% usage: "You've used 75% of your monthly UW Wizard runs"
- 90% usage: "Only X runs remaining this month"
- 100% usage: Redirect to upgrade page

---

## Phase 5: Lemon Squeezy Integration

### 5.1 Create Products in Lemon Squeezy

Create 3 products:
1. UW Wizard Starter - $9.99/mo
2. UW Wizard Professional - $24.99/mo
3. UW Wizard Agency - $49.99/mo

Each with monthly and annual variants.

### 5.2 Update Webhook Handler

Modify webhook to handle:
- Tier selection from checkout metadata
- Tier upgrades/downgrades
- Usage reset on renewal

---

## Phase 6: Admin Features

### 6.1 Usage Analytics Dashboard

Super admin view showing:
- Total runs across all users
- Top users by usage
- Revenue vs AI costs
- Tier distribution

### 6.2 Manual Tier Override

Allow super admins to:
- Set custom limits for specific users
- Grant enterprise/unlimited access
- View individual user usage history

---

## Implementation Order

1. **Database Schema** (Phase 1) - Migration file
2. **Database Functions** (Phase 2) - Same migration
3. **Edge Function Updates** (Phase 3) - Modify existing
4. **Basic Frontend** (Phase 4.1, 4.3) - Usage widget + limit dialog
5. **Tier Selection UI** (Phase 4.2) - Update addon purchase flow
6. **Lemon Squeezy** (Phase 5) - Create products, update webhooks
7. **Admin Tools** (Phase 6) - Analytics and overrides

---

## Migration Strategy

1. Existing "manual_grant" users get **Professional** tier (400 runs) - grandfathered
2. New purchases start with tier selection
3. Monitor usage for 30 days before enforcing limits (soft launch)
4. Email users approaching limits with upgrade options

---

## Files to Create/Modify

### New Files
- `supabase/migrations/YYYYMMDDHHMMSS_uw_wizard_tiered_usage.sql`
- `src/features/underwriting/components/UWUsageWidget.tsx`
- `src/features/underwriting/components/UWLimitReachedDialog.tsx`
- `src/features/underwriting/hooks/useUWWizardUsage.ts`
- `src/services/underwriting/usageService.ts`

### Modified Files
- `supabase/functions/underwriting-ai-analyze/index.ts`
- `src/features/settings/billing/components/PremiumAddonsSection.tsx`
- `src/features/underwriting/components/UnderwritingWizard.tsx`
- `src/types/database.types.ts` (regenerate)

---

## Testing Checklist

- [ ] User with no subscription cannot run wizard
- [ ] User at limit gets blocked with upgrade prompt
- [ ] Usage increments correctly after each run
- [ ] Usage resets at start of new billing period
- [ ] Tier upgrade increases limit immediately
- [ ] Super admin can override limits
- [ ] Usage displays correctly in UI
- [ ] Warning notifications appear at thresholds
