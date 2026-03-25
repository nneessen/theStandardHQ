// src/features/voice-agent/lib/prompt-wizard-presets.ts
// Preset constants for the guided prompt builder wizard.

export const STYLE_RULE_PRESETS = [
  {
    key: "short_sentences",
    label: "Keep replies short — 1-2 sentences at a time",
    prompt:
      "Keep replies to 1-2 sentences unless the caller asks you to explain more.",
  },
  {
    key: "one_question_at_a_time",
    label: "Ask only one question, then wait for the answer",
    prompt: "Ask only one question at a time.",
  },
  {
    key: "warm_tone",
    label: "Warm, calm, natural tone — like a real person",
    prompt: "Sound warm, calm, and natural — like a real person, not a script.",
  },
  {
    key: "use_contractions",
    label: 'Use contractions ("I\'m", "it\'s", "doesn\'t")',
    prompt:
      'Use contractions and brief acknowledgments ("Got it," "Sure thing," "That makes sense").',
  },
  {
    key: "no_repeat_verbatim",
    label: "Don't repeat the same phrase twice",
    prompt: "Never repeat the same phrase verbatim across turns.",
  },
  {
    key: "not_pushy",
    label: "Helpful, not pushy — never sound like a salesperson",
    prompt: "Do not talk like a salesperson. Be helpful, not pushy.",
  },
  {
    key: "never_say_ai",
    label: "Don't volunteer that it's AI unless asked",
    prompt: 'Never say "I\'m an AI" unless directly asked.',
  },
] as const;

export const PRODUCT_PRESETS = [
  {
    key: "mortgage_protection",
    label: "Mortgage Protection",
    description:
      "what it is, why people get it, how it protects a family's home if something happens",
  },
  {
    key: "term_life",
    label: "Term Life Insurance",
    description: "basic concept, typical term lengths, who it's designed for",
  },
  {
    key: "iul",
    label: "Indexed Universal Life (IUL)",
    description:
      "general concept of cash value growth tied to a market index with downside protection",
  },
  {
    key: "final_expense",
    label: "Final Expense / Burial Insurance",
    description: "what it covers, who it's for",
  },
  {
    key: "medicare",
    label: "Medicare / Medicare Advantage",
    description:
      "enrollment periods, plan types, supplement vs advantage overview",
  },
  {
    key: "health",
    label: "Health Insurance (ACA)",
    description: "marketplace basics, enrollment periods, subsidy eligibility",
  },
  {
    key: "annuities",
    label: "Annuities",
    description: "retirement income concept, fixed vs indexed basics",
  },
] as const;

export const HARD_LIMIT_PRESETS = [
  {
    key: "no_specific_prices",
    label: "Never quote specific dollar amounts or premiums",
    prompt: "Never quote specific dollar amounts, premiums, or rate ranges.",
  },
  {
    key: "no_guaranteed_approval",
    label: "Never promise savings or guaranteed approval",
    prompt: "Never make promises about savings or guaranteed approval.",
  },
  {
    key: "no_licensed_advice",
    label: "Never provide advice that requires a license",
    prompt: "Never provide policy advice that requires a license.",
  },
  {
    key: "no_competitor_pricing",
    label: "Never discuss competitor pricing",
    prompt: "Never discuss competitor pricing or make comparative claims.",
  },
  {
    key: "no_false_booking_claims",
    label:
      "Never claim it booked an appointment unless confirmed by the system",
    prompt:
      "Never claim you booked or confirmed an appointment unless a real booking system actually did it.",
  },
  {
    key: "no_guessing_facts",
    label: "Never guess or make up facts",
    prompt: "Do not guess or invent facts.",
  },
] as const;

export const TRANSFER_TRIGGER_PRESETS = [
  {
    key: "asks_for_specific_person",
    label: "Caller asks for someone by name",
    prompt: "The caller asks for a specific person by name",
  },
  {
    key: "payment_or_policy_change",
    label: "Caller wants to make a payment or change a policy",
    prompt: "The caller wants to make a payment or change a policy",
  },
  {
    key: "caller_upset",
    label: "Caller is upset or asks for a manager",
    prompt: "The caller is upset or asks to speak with a manager",
  },
  {
    key: "ready_for_quote",
    label: "Caller has been qualified and is ready for a quote",
    prompt:
      "You've collected the qualification info and they're ready for a quote",
  },
  {
    key: "beyond_general_education",
    label:
      "Question goes beyond general education into specific policy decisions",
    prompt:
      "The conversation moves beyond general education into specific policy advice, rates, or binding decisions",
  },
] as const;

export const WORKFLOW_PRESETS = [
  {
    key: "missed_appointment",
    label: "Missed Appointment",
    defaultGuidance:
      "Open with empathy, not guilt. Mention the missed appointment only if appointment_window_local is available. Ask if they want help finding a better time.",
    defaultGreeting:
      "Hi {{lead_name}}, this is {{agent_name}} from {{company_name}}. I was reaching out because it looks like we missed connecting earlier — do you have a minute?",
  },
  {
    key: "reschedule",
    label: "Reschedule",
    defaultGuidance:
      "Focus on moving the appointment. Reference appointment_window_local briefly if available. Do not say the calendar has already been updated.",
    defaultGreeting:
      "Hi {{lead_name}}, this is {{agent_name}} from {{company_name}}. I'm calling about your upcoming appointment — I wanted to check if the time still works for you.",
  },
  {
    key: "after_hours_inbound",
    label: "After-Hours Inbound",
    defaultGuidance:
      "Act like a friendly after-hours receptionist. Greet by name if known. Ask what they need — be open to any topic. Help with scheduling, callbacks, general questions, or transfers.",
    defaultGreeting:
      "Hi, thanks for calling {{company_name}}. This is {{agent_name}} — we're currently closed but I'd be happy to help you or take a message.",
  },
  {
    key: "quoted_followup",
    label: "Quoted Follow-Up",
    defaultGuidance:
      "Keep it conversational, not transactional. Ask if they had any questions about what was discussed. If they ask about pricing, use the pricing bridge. Offer to schedule a follow-up.",
    defaultGreeting:
      "Hi {{lead_name}}, this is {{agent_name}} from {{company_name}}. I wanted to follow up on the information we sent over — do you have any questions?",
  },
  {
    key: "general_inbound",
    label: "General Inbound (no specific scenario)",
    defaultGuidance:
      "Greet warmly as the agency's assistant. Ask how you can help today. Be open to any topic — scheduling, questions, or transfers.",
    defaultGreeting:
      "Hi, thanks for calling {{company_name}}. This is {{agent_name}}, how can I help you today?",
  },
] as const;

export const GREETING_VAR_PREFIX = "greeting_";

export const DEFAULT_WORKFLOW_GREETINGS: Record<string, string> =
  Object.fromEntries(WORKFLOW_PRESETS.map((p) => [p.key, p.defaultGreeting]));

export const WORKFLOW_CATEGORIES = {
  inbound: ["general_inbound", "after_hours_inbound"],
  outbound: ["missed_appointment", "reschedule", "quoted_followup"],
} as const;

export const TIMEZONE_PRESETS = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
] as const;

/** Model options for non-technical users. Retell passes these to the underlying LLM. */
export const MODEL_PRESETS = [
  {
    value: "gpt-4o-mini",
    label: "Standard",
    description: "Faster responses, good for most use cases",
  },
  {
    value: "gpt-4o",
    label: "Enhanced",
    description: "Smarter responses, better at complex conversations",
  },
] as const;
