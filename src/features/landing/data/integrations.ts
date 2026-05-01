export type Integration = {
  id: string;
  name: string;
  description: string;
};

export const INTEGRATIONS: Integration[] = [
  {
    id: "close",
    name: "Close CRM",
    description:
      "Two-way sync of leads, opportunities, custom fields, smart views, notes, and call logs.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description:
      "Powers Lead Heat AI, Close AI Builder, Underwriting Wizard, Game Plan Coach.",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Secondary LLM provider for fallback and specialized tasks.",
  },
  {
    id: "retell",
    name: "Retell AI",
    description:
      "Voice cloning, inbound and outbound call automation, transcripts.",
  },
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Subscription billing, invoicing, and self-service customer portal.",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Postgres database, auth, edge functions, and storage.",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Two-way messaging: daily leaderboards, policy alerts, reaction logging.",
  },
  {
    id: "resend",
    name: "Resend",
    description:
      "Production transactional email delivery with template support.",
  },
  {
    id: "mailgun",
    name: "Mailgun",
    description:
      "Legacy email transport for password reset, email change, and notifications.",
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS delivery with template support and opt-in management.",
  },
  {
    id: "docuseal",
    name: "DocuSeal",
    description:
      "Electronic signature collection during recruiting and contracting.",
  },
  {
    id: "paddleocr",
    name: "PaddleOCR",
    description:
      "Document parsing for underwriting guides and financial statements.",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Hosting, edge networking, and CI/CD.",
  },
  {
    id: "google",
    name: "Google",
    description: "Gmail OAuth, Google Calendar event creation and scheduling.",
  },
];
