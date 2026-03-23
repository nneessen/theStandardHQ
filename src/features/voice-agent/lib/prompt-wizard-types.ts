// src/features/voice-agent/lib/prompt-wizard-types.ts
// Data model for the guided prompt builder wizard.

export interface PromptWizardFormData {
  // Section 1: Identity
  identityMode: "cloned_voice" | "assistant";
  agentName: string;
  agencyName: string;
  agentRole: string;
  timezone: string;

  // Section 2: Style
  styleRules: string[];
  styleCustom: string;

  // Section 3: Products
  products: string[];
  productCustomKnowledge: string;

  // Section 4: Qualification
  qualificationQuestions: string[];

  // Section 5: Pricing
  pricingStrategy: "bridge_to_appointment" | "provide_ranges" | "decline";
  pricingCustomScript: string;

  // Section 6: Hard Limits
  hardLimits: string[];
  hardLimitsCustom: string;

  // Section 7: Transfer Rules
  transferTriggers: string[];
  transferCustom: string;

  // Section 8: Workflow Openings
  enabledWorkflows: string[];
  workflowGuidance: Record<string, string>;
}

export const EMPTY_WIZARD_FORM: PromptWizardFormData = {
  identityMode: "assistant",
  agentName: "",
  agencyName: "",
  agentRole: "friendly and professional insurance office assistant",
  timezone: "America/New_York",
  styleRules: [
    "short_sentences",
    "one_question_at_a_time",
    "warm_tone",
    "use_contractions",
    "no_repeat_verbatim",
    "not_pushy",
    "never_say_ai",
  ],
  styleCustom: "",
  products: [],
  productCustomKnowledge: "",
  qualificationQuestions: [
    "What type of coverage are you looking for?",
    "What state do you live in?",
    "What is your date of birth?",
    "Do you currently have coverage, or is this new?",
  ],
  pricingStrategy: "bridge_to_appointment",
  pricingCustomScript: "",
  hardLimits: [
    "no_specific_prices",
    "no_guaranteed_approval",
    "no_licensed_advice",
    "no_competitor_pricing",
    "no_false_booking_claims",
    "no_guessing_facts",
  ],
  hardLimitsCustom: "",
  transferTriggers: [
    "asks_for_specific_person",
    "payment_or_policy_change",
    "caller_upset",
    "ready_for_quote",
    "beyond_general_education",
  ],
  transferCustom: "",
  enabledWorkflows: [],
  workflowGuidance: {},
};

const WIZARD_STORAGE_KEY = "voice-prompt-wizard-v1";

export function loadWizardData(): PromptWizardFormData | null {
  try {
    const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PromptWizardFormData;
  } catch {
    return null;
  }
}

export function saveWizardData(data: PromptWizardFormData): void {
  try {
    localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable or full — wizard still works, just won't persist
  }
}
