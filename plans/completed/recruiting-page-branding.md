# Recruiting Page Branding & Customization System

## Status: IMPLEMENTATION COMPLETE - AWAITING DEPLOYMENT

### Completed ✅
- [x] Database migrations created (`20260114_001_recruiting_page_settings.sql`, `20260114_002_recruiting_assets_bucket.sql`)
- [x] Edge function updated (`resolve-custom-domain/index.ts`)
- [x] Frontend types (`recruiting-theme.types.ts`)
- [x] Theme utilities (`lib/recruiting-theme.ts`)
- [x] CSS variables added to `index.css`
- [x] CustomDomainContext updated with theme support
- [x] Branding service (`brandingSettingsService.ts`)
- [x] TanStack Query hooks (`useBrandingSettings.ts`)
- [x] Settings UI component (`BrandingSettings.tsx`)
- [x] PublicJoinPage refactored to use theme
- [x] LeadInterestForm accepts theme props
- [x] Settings page integration (BrandingSettings in UserProfile)
- [x] Typecheck passing

### Remaining 🔲
- [ ] Deploy migrations to Supabase
- [ ] Deploy updated edge function
- [ ] Regenerate `database.types.ts` after migration
- [ ] End-to-end testing

---

## Overview

Implement per-recruiter branding for public recruiting pages, allowing users to customize their landing page appearance while falling back to IMO defaults and platform defaults.

## Current State Analysis

### What Exists
- `PublicJoinPage.tsx` - 100% hardcoded to "The Standard Financial Group"
- `PublicRecruiterInfo` type has IMO-level fields (`imo_logo_url`, `imo_primary_color`, etc.) but **completely unused**
- `resolve-custom-domain` edge function returns only `{ recruiter_slug }`
- `imos` table has `logo_url`, `primary_color`, `secondary_color`, `settings` JSONB
- `custom_permissions` JSONB on `user_profiles` stores `calendly_url`

### What's Missing
- Per-user branding settings table
- Public API returning branding config
- CSS variable-based theming system
- Public storage bucket for recruiter assets
- Settings UI for editing branding

---

## Implementation Plan

### Phase 1: Database Schema

#### 1.1 Create `recruiting_page_settings` Table

**File:** `supabase/migrations/YYYYMMDD_NNN_recruiting_page_settings.sql`

```sql
-- Table: recruiting_page_settings
-- Stores per-user branding settings for public recruiting pages
-- Precedence: User settings → IMO defaults → Platform defaults

CREATE TABLE recruiting_page_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  imo_id UUID NOT NULL REFERENCES imos(id) ON DELETE CASCADE,

  -- Display & Branding
  display_name TEXT,                    -- e.g., "The Standard - Tampa"
  headline TEXT,                        -- Hero headline
  subheadline TEXT,                     -- Hero subheadline
  about_text TEXT,                      -- Optional about paragraph

  -- Colors (hex format)
  primary_color TEXT,                   -- Main brand color
  accent_color TEXT,                    -- Secondary/accent color

  -- Assets (public bucket URLs)
  logo_light_url TEXT,                  -- Logo for dark backgrounds
  logo_dark_url TEXT,                   -- Logo for light backgrounds
  hero_image_url TEXT,                  -- Optional hero/background image

  -- CTA & Actions
  cta_text TEXT DEFAULT 'Apply Now',    -- Button text
  calendly_url TEXT,                    -- Booking link
  support_phone TEXT,                   -- "Text us" number

  -- Social Links (JSONB for flexibility)
  social_links JSONB DEFAULT '{}',      -- { facebook, instagram, twitter, youtube }

  -- Compliance
  disclaimer_text TEXT,                 -- Optional footer disclaimer

  -- Feature Flags (JSONB)
  enabled_features JSONB DEFAULT '{}',  -- { show_stats, show_testimonials, collect_phone, etc. }

  -- Location
  default_city TEXT,
  default_state TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recruiting_page_settings_user_id ON recruiting_page_settings(user_id);
CREATE INDEX idx_recruiting_page_settings_imo_id ON recruiting_page_settings(imo_id);

-- Updated_at trigger
CREATE TRIGGER update_recruiting_page_settings_updated_at
  BEFORE UPDATE ON recruiting_page_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE recruiting_page_settings ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own settings
CREATE POLICY "Users can view own settings"
  ON recruiting_page_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON recruiting_page_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON recruiting_page_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON recruiting_page_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Super admins can view all
CREATE POLICY "Super admins can view all settings"
  ON recruiting_page_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );
```

#### 1.2 Create Public Storage Bucket

**File:** `supabase/migrations/YYYYMMDD_NNN_recruiting_assets_bucket.sql`

```sql
-- Create public bucket for recruiting page assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recruiting-assets',
  'recruiting-assets',
  true,  -- Public bucket (no signed URLs needed)
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
);

-- RLS: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recruiting-assets' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: Authenticated users can update/delete their own assets
CREATE POLICY "Users can manage own assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'recruiting-assets' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'recruiting-assets' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access (bucket is public)
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recruiting-assets');
```

---

### Phase 2: Public API - Expand Resolver

#### 2.1 Update `resolve-custom-domain` Edge Function

**File:** `supabase/functions/resolve-custom-domain/index.ts`

Expand the response to include branding theme data:

```typescript
// Current response: { recruiter_slug }
// New response: { recruiter_slug, theme: RecruitingPageTheme }

interface RecruitingPageTheme {
  display_name: string;
  headline: string;
  subheadline: string;
  about_text: string | null;
  primary_color: string;
  accent_color: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  hero_image_url: string | null;
  cta_text: string;
  calendly_url: string | null;
  support_phone: string | null;
  social_links: Record<string, string>;
  disclaimer_text: string | null;
  enabled_features: Record<string, boolean>;
  default_city: string | null;
  default_state: string | null;
  recruiter_first_name: string;
  recruiter_last_name: string;
}
```

**Logic:**
1. Resolve hostname → user_id (existing)
2. Fetch `recruiting_page_settings` for user
3. Fetch `imos` for user's IMO (fallback values)
4. Merge: user settings → IMO defaults → platform defaults
5. Return whitelisted fields only (no user_id, imo_id exposed)

#### 2.2 Create `get-public-recruiting-theme` RPC (Fallback)

**File:** `supabase/migrations/YYYYMMDD_NNN_public_recruiting_theme_rpc.sql`

For primary domain path (`/join/{slug}`), create an RPC that returns theme by slug:

```sql
CREATE OR REPLACE FUNCTION get_public_recruiting_theme(p_slug TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_imo_id UUID;
  v_settings RECORD;
  v_imo RECORD;
  v_profile RECORD;
  v_result JSON;
BEGIN
  -- Get user by slug
  SELECT id, imo_id, first_name, last_name, custom_permissions
  INTO v_profile
  FROM user_profiles
  WHERE recruiter_slug = p_slug
    AND approval_status = 'approved';

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  v_user_id := v_profile.id;
  v_imo_id := v_profile.imo_id;

  -- Get user settings (if any)
  SELECT * INTO v_settings
  FROM recruiting_page_settings
  WHERE user_id = v_user_id;

  -- Get IMO defaults
  SELECT name, logo_url, primary_color, secondary_color, description
  INTO v_imo
  FROM imos
  WHERE id = v_imo_id AND is_active = true;

  IF v_imo IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build response with precedence: user → IMO → platform
  v_result := json_build_object(
    'display_name', COALESCE(v_settings.display_name, v_imo.name, 'Insurance Agency'),
    'headline', COALESCE(v_settings.headline, 'Join Our Team'),
    'subheadline', COALESCE(v_settings.subheadline, 'Build your career in insurance'),
    'about_text', v_settings.about_text,
    'primary_color', COALESCE(v_settings.primary_color, v_imo.primary_color, '#0ea5e9'),
    'accent_color', COALESCE(v_settings.accent_color, v_imo.secondary_color, '#22c55e'),
    'logo_light_url', COALESCE(v_settings.logo_light_url, v_imo.logo_url),
    'logo_dark_url', COALESCE(v_settings.logo_dark_url, v_imo.logo_url),
    'hero_image_url', v_settings.hero_image_url,
    'cta_text', COALESCE(v_settings.cta_text, 'Apply Now'),
    'calendly_url', COALESCE(v_settings.calendly_url, (v_profile.custom_permissions->>'calendly_url')::TEXT),
    'support_phone', v_settings.support_phone,
    'social_links', COALESCE(v_settings.social_links, '{}'),
    'disclaimer_text', v_settings.disclaimer_text,
    'enabled_features', COALESCE(v_settings.enabled_features, '{}'),
    'default_city', v_settings.default_city,
    'default_state', v_settings.default_state,
    'recruiter_first_name', v_profile.first_name,
    'recruiter_last_name', v_profile.last_name
  );

  RETURN v_result;
END;
$$;
```

---

### Phase 3: Frontend - Theme System

#### 3.1 Create Types

**File:** `src/types/recruiting-theme.types.ts`

```typescript
export interface RecruitingPageTheme {
  display_name: string;
  headline: string;
  subheadline: string;
  about_text: string | null;
  primary_color: string;
  accent_color: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  hero_image_url: string | null;
  cta_text: string;
  calendly_url: string | null;
  support_phone: string | null;
  social_links: SocialLinks;
  disclaimer_text: string | null;
  enabled_features: EnabledFeatures;
  default_city: string | null;
  default_state: string | null;
  recruiter_first_name: string;
  recruiter_last_name: string;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

export interface EnabledFeatures {
  show_stats?: boolean;
  show_testimonials?: boolean;
  collect_phone?: boolean;
  show_location?: boolean;
}

// Platform defaults
export const DEFAULT_THEME: RecruitingPageTheme = {
  display_name: 'Insurance Agency',
  headline: 'Join Our Team',
  subheadline: 'Build your career in insurance',
  about_text: null,
  primary_color: '#0ea5e9',
  accent_color: '#22c55e',
  logo_light_url: null,
  logo_dark_url: null,
  hero_image_url: null,
  cta_text: 'Apply Now',
  calendly_url: null,
  support_phone: null,
  social_links: {},
  disclaimer_text: null,
  enabled_features: { show_stats: true, collect_phone: true },
  default_city: null,
  default_state: null,
  recruiter_first_name: '',
  recruiter_last_name: '',
};
```

#### 3.2 Update CustomDomainContext

**File:** `src/contexts/CustomDomainContext.tsx`

Extend to include theme:

```typescript
interface CustomDomainContextValue {
  customDomainSlug: string | null;
  isCustomDomain: boolean;
  isLoading: boolean;
  error: string | null;
  theme: RecruitingPageTheme | null;  // NEW
}
```

#### 3.3 Create Theme Application Utility

**File:** `src/lib/recruiting-theme.ts`

```typescript
export function applyRecruitingTheme(theme: RecruitingPageTheme): void {
  const root = document.documentElement;

  // Set CSS custom properties
  root.style.setProperty('--recruiting-primary', theme.primary_color);
  root.style.setProperty('--recruiting-accent', theme.accent_color);

  // Generate color variants (lighter/darker)
  root.style.setProperty('--recruiting-primary-light', lighten(theme.primary_color, 0.9));
  root.style.setProperty('--recruiting-primary-dark', darken(theme.primary_color, 0.2));
}

export function clearRecruitingTheme(): void {
  const root = document.documentElement;
  root.style.removeProperty('--recruiting-primary');
  root.style.removeProperty('--recruiting-accent');
  // ... etc
}
```

#### 3.4 Add CSS Variables

**File:** `src/index.css`

```css
:root {
  /* Recruiting page theme variables with defaults */
  --recruiting-primary: #0ea5e9;
  --recruiting-accent: #22c55e;
  --recruiting-primary-light: #e0f2fe;
  --recruiting-primary-dark: #0284c7;
}

/* Utility classes for recruiting pages */
.recruiting-primary { color: var(--recruiting-primary); }
.recruiting-accent { color: var(--recruiting-accent); }
.bg-recruiting-primary { background-color: var(--recruiting-primary); }
.bg-recruiting-accent { background-color: var(--recruiting-accent); }
.border-recruiting-primary { border-color: var(--recruiting-primary); }
```

#### 3.5 Refactor PublicJoinPage

**File:** `src/features/recruiting/pages/PublicJoinPage.tsx`

Replace all hardcoded values with theme-driven content:

- Logo: `theme.logo_light_url` / `theme.logo_dark_url`
- Brand name: `theme.display_name`
- Headline: `theme.headline`
- Subheadline: `theme.subheadline`
- CTA button: `theme.cta_text`
- Colors: CSS variables (`var(--recruiting-primary)`)
- Social links: `theme.social_links`
- Calendly: `theme.calendly_url`

---

### Phase 4: Settings UI

#### 4.1 Create Branding Settings Service

**File:** `src/services/recruiting/brandingSettingsService.ts`

```typescript
export const brandingSettingsService = {
  async getSettings(): Promise<RecruitingPageSettings | null>,
  async upsertSettings(settings: Partial<RecruitingPageSettings>): Promise<void>,
  async uploadAsset(file: File, type: 'logo_light' | 'logo_dark' | 'hero'): Promise<string>,
  async deleteAsset(url: string): Promise<void>,
};
```

#### 4.2 Create Settings Hook

**File:** `src/features/settings/hooks/useBrandingSettings.ts`

```typescript
export function useBrandingSettings() {
  // TanStack Query hook for fetching/mutating branding settings
}
```

#### 4.3 Create Branding Settings Component

**File:** `src/features/settings/components/BrandingSettings.tsx`

Settings form with:
- Display name input
- Headline/subheadline inputs
- Color pickers (primary, accent)
- Logo upload (light/dark variants)
- Hero image upload
- CTA text input
- Calendly URL input
- Support phone input
- Social links inputs (Facebook, Instagram)
- Disclaimer text textarea
- Preview button (opens new tab with current settings)

---

### Phase 5: Integration

#### 5.1 Add Route to Settings Page

Add "Recruiting Page" or "Branding" tab to user settings.

#### 5.2 Update leadsService

Update `getPublicRecruiterInfo` to also return theme, or create separate service method.

#### 5.3 Regenerate Types

```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
```

---

## File Changes Summary

### New Files
- `supabase/migrations/YYYYMMDD_NNN_recruiting_page_settings.sql`
- `supabase/migrations/YYYYMMDD_NNN_recruiting_assets_bucket.sql`
- `supabase/migrations/YYYYMMDD_NNN_public_recruiting_theme_rpc.sql`
- `src/types/recruiting-theme.types.ts`
- `src/lib/recruiting-theme.ts`
- `src/services/recruiting/brandingSettingsService.ts`
- `src/features/settings/hooks/useBrandingSettings.ts`
- `src/features/settings/components/BrandingSettings.tsx`

### Modified Files
- `supabase/functions/resolve-custom-domain/index.ts` - Add theme to response
- `src/contexts/CustomDomainContext.tsx` - Store theme
- `src/features/recruiting/pages/PublicJoinPage.tsx` - Use theme
- `src/index.css` - Add CSS variables
- `src/types/database.types.ts` - Regenerate
- `src/services/leads/leadsService.ts` - Update to return theme
- `src/types/leads.types.ts` - Update PublicRecruiterInfo type

---

## Security Considerations

1. **No user_id/imo_id exposed** - Public API only returns whitelisted display fields
2. **Storage RLS** - Users can only upload to their own folder (`{user_id}/`)
3. **Input sanitization** - No HTML/scripts in text fields (plain text only)
4. **CORS** - Custom domains handled via dynamic origin headers
5. **Rate limiting** - Consider edge function rate limits for abuse prevention

---

## Caching Strategy

1. **Edge function response**: `Cache-Control: public, max-age=60, s-maxage=60`
2. **Assets (logos/images)**: Public bucket with CDN caching
3. **Frontend**: TanStack Query with 5-minute stale time for theme data

---

## Migration Path

1. Deploy database migrations
2. Deploy updated edge function
3. Deploy frontend changes
4. Existing pages continue to work (use platform defaults)
5. Users can optionally customize via Settings UI

---

## Out of Scope (v1)

- Per-domain settings override (all domains for a user share settings)
- Rich text/HTML in content fields
- Page builder / drag-and-drop customization
- A/B testing variants
- Analytics per-page
