-- Add logos column to feature_spotlights for integration brand logos
ALTER TABLE feature_spotlights
  ADD COLUMN IF NOT EXISTS logos JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN feature_spotlights.logos IS 'JSON array of logo identifiers, e.g. ["close_crm", "calendly", "google_calendar"]';

-- Update the AI Chatbot spotlight with integration logos
UPDATE feature_spotlights
SET logos = '["close_crm", "calendly", "google_calendar"]'::jsonb
WHERE title = 'AI-Powered SMS Appointment Setter';
