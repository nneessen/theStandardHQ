-- Durable storage for chat bot conversation reviews and improvement briefs

BEGIN;

CREATE TABLE public.chat_bot_conversation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  external_agent_id text NOT NULL,
  external_conversation_id text,
  close_lead_id text,
  review_mode text NOT NULL
    CHECK (review_mode IN ('diagnostic', 'improve')),
  primary_reason_code text NOT NULL,
  primary_reason text NOT NULL,
  found_conversation boolean NOT NULL DEFAULT false,
  conversation_status text,
  outbound_count integer NOT NULL DEFAULT 0,
  inbound_count integer NOT NULL DEFAULT 0,
  prompt_version text,
  human_verdict text,
  resolution_status text NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'reviewed', 'resolved', 'ignored')),
  target_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvement_brief text,
  agent_snapshot jsonb,
  conversation_snapshot jsonb,
  review_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_bot_conversation_reviews_user_created
  ON public.chat_bot_conversation_reviews(user_id, created_at DESC);

CREATE INDEX idx_chat_bot_conversation_reviews_agent_created
  ON public.chat_bot_conversation_reviews(external_agent_id, created_at DESC);

CREATE INDEX idx_chat_bot_conversation_reviews_conversation
  ON public.chat_bot_conversation_reviews(external_conversation_id)
  WHERE external_conversation_id IS NOT NULL;

CREATE INDEX idx_chat_bot_conversation_reviews_close_lead
  ON public.chat_bot_conversation_reviews(close_lead_id)
  WHERE close_lead_id IS NOT NULL;

CREATE INDEX idx_chat_bot_conversation_reviews_primary_reason
  ON public.chat_bot_conversation_reviews(primary_reason_code);

CREATE INDEX idx_chat_bot_conversation_reviews_resolution_status
  ON public.chat_bot_conversation_reviews(resolution_status);

ALTER TABLE public.chat_bot_conversation_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat bot reviews"
  ON public.chat_bot_conversation_reviews
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own chat bot reviews"
  ON public.chat_bot_conversation_reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages chat bot reviews"
  ON public.chat_bot_conversation_reviews
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_chat_bot_conversation_reviews_updated_at
  BEFORE UPDATE ON public.chat_bot_conversation_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.chat_bot_conversation_reviews IS
  'Stored chat bot conversation diagnostics and improvement briefs generated from review scripts or automations.';

COMMENT ON COLUMN public.chat_bot_conversation_reviews.review_payload IS
  'Full structured review payload returned by scripts/review-chat-bot-lead.mjs.';

COMMENT ON COLUMN public.chat_bot_conversation_reviews.improvement_brief IS
  'Reusable handoff text for future bot-improvement work.';

COMMIT;
