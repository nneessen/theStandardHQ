-- Add billing_exempt column to chat_bot_agents
-- Team members (IMO owners, IMO admins, super admins) use the bot for free
-- with no Stripe subscription and no lead limits.
ALTER TABLE chat_bot_agents ADD COLUMN billing_exempt boolean NOT NULL DEFAULT false;
