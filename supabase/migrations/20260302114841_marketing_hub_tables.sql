-- Marketing Hub: audiences, external contacts, brand settings
-- Also extends bulk_email_campaigns for SMS + audience support

-- marketing_audiences: reusable audience segments
CREATE TABLE IF NOT EXISTS marketing_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  audience_type TEXT NOT NULL DEFAULT 'dynamic',
  source_pool TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  contact_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- marketing_audience_members: static audience membership
CREATE TABLE IF NOT EXISTS marketing_audience_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID NOT NULL REFERENCES marketing_audiences(id) ON DELETE CASCADE,
  contact_id UUID,
  contact_type TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(audience_id, email)
);

-- marketing_external_contacts: contacts outside the system
CREATE TABLE IF NOT EXISTS marketing_external_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, created_by)
);

-- marketing_brand_settings: brand identity for campaigns
CREATE TABLE IF NOT EXISTS marketing_brand_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  primary_color TEXT DEFAULT '#18181b',
  secondary_color TEXT DEFAULT '#71717a',
  accent_color TEXT DEFAULT '#3b82f6',
  font_family TEXT DEFAULT 'Inter',
  company_name TEXT,
  footer_text TEXT,
  social_links JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(created_by)
);

-- Extend bulk_email_campaigns for SMS + audience support
ALTER TABLE bulk_email_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS audience_id UUID REFERENCES marketing_audiences(id),
  ADD COLUMN IF NOT EXISTS sms_content TEXT,
  ADD COLUMN IF NOT EXISTS brand_settings JSONB DEFAULT '{}';

-- RLS policies
ALTER TABLE marketing_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_audience_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_external_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_brand_settings ENABLE ROW LEVEL SECURITY;

-- Super-admin full access policies
CREATE POLICY "Super admins manage audiences" ON marketing_audiences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins manage audience members" ON marketing_audience_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins manage external contacts" ON marketing_external_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins manage brand settings" ON marketing_brand_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_marketing_audiences_created_by ON marketing_audiences(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_audience_members_audience_id ON marketing_audience_members(audience_id);
CREATE INDEX IF NOT EXISTS idx_marketing_external_contacts_created_by ON marketing_external_contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_bulk_email_campaigns_audience_id ON bulk_email_campaigns(audience_id);
CREATE INDEX IF NOT EXISTS idx_bulk_email_campaigns_campaign_type ON bulk_email_campaigns(campaign_type);
