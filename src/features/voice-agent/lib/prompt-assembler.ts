// src/features/voice-agent/lib/prompt-assembler.ts
// Pure function that assembles wizard form data into a structured Markdown prompt.

import type { PromptWizardFormData } from "./prompt-wizard-types";
import {
  STYLE_RULE_PRESETS,
  PRODUCT_PRESETS,
  HARD_LIMIT_PRESETS,
  TRANSFER_TRIGGER_PRESETS,
  WORKFLOW_PRESETS,
} from "./prompt-wizard-presets";

function lookupPreset<T extends { key: string }>(
  presets: readonly T[],
  key: string,
): T | undefined {
  return presets.find((p) => p.key === key);
}

function buildIdentitySection(data: PromptWizardFormData): string {
  const name = data.agentName.trim() || "{{agent_name}}";
  const agency = data.agencyName.trim() || "{{company_name}}";
  const role = data.agentRole.trim() || "friendly and professional assistant";

  if (data.identityMode === "cloned_voice") {
    // Cloned voice: the AI IS the agent, speaking as the real person
    const lines = [
      "## Identity",
      `You ARE ${name} from ${agency}. You are not an assistant or a bot — you are the actual agent.`,
      `Speak exactly as ${name} would: use first person ("I", "my", "me"), reference your own experience and your agency naturally.`,
      `Callers believe they are speaking directly to ${name}. Maintain that reality throughout the entire call.`,
      `Never say you are an AI, a virtual assistant, or a bot. If pressed, redirect: "I'm ${name}, how can I help you?"`,
      `The business timezone is ${data.timezone}.`,
    ];
    return lines.join("\n");
  }

  // Stock voice: acts as a named assistant
  const lines = [
    "## Identity",
    `You are ${name}, a ${role} at ${agency}.`,
    `You handle calls, answer general questions, and schedule appointments.`,
    `The business timezone is ${data.timezone}.`,
  ];
  return lines.join("\n");
}

function buildDynamicVariablesSection(): string {
  return `## Dynamic Variables
You may receive these runtime variables — use them when available:
- {{workflow_type}} — the type of call (missed_appointment, reschedule, after_hours_inbound, quoted_followup, general_inbound)
- {{workflow_goal}} — what this call should accomplish
- {{workflow_opening_guidance}} — suggested opening approach
- {{workflow_handoff_rule}} — when to hand off
- {{workflow_context}} — additional context about the call
- {{greeting_general_inbound}} — opening greeting for general inbound calls
- {{greeting_after_hours_inbound}} — opening greeting for after-hours inbound calls
- {{greeting_missed_appointment}} — opening greeting for missed appointment outreach
- {{greeting_reschedule}} — opening greeting for reschedule calls
- {{greeting_quoted_followup}} — opening greeting for quoted follow-up calls
- {{appointment_window_local}} — the appointment time in the caller's timezone
- {{lead_name}} — the lead's name from CRM
- {{known_lead_name}} — confirmed name if recognized
- {{caller_number}} — the caller's phone number
- {{lead_status_label}} — current lead status
- {{product_type}} — the product being discussed
- {{human_handoff_enabled}} — whether live transfer is available ("true" or "false")
- {{transfer_number}} — the number to transfer to
- {{sms_history}} — recent SMS conversation context
- {{lead_context}} — additional lead information
- {{source_rules}} — source-specific handling rules
- {{agent_name}} — your name
- {{company_name}} — the agency name

If any variable still appears with curly braces, treat it as missing and do not read it out loud.`;
}

function buildStyleSection(data: PromptWizardFormData): string | null {
  const lines: string[] = [];

  for (const key of data.styleRules) {
    const preset = lookupPreset(STYLE_RULE_PRESETS, key);
    if (preset) lines.push(`- ${preset.prompt}`);
  }

  if (data.styleCustom.trim()) {
    for (const line of data.styleCustom.trim().split("\n")) {
      const trimmed = line.trim();
      if (trimmed) lines.push(`- ${trimmed}`);
    }
  }

  if (lines.length === 0) return null;
  return `## Style\n${lines.join("\n")}`;
}

function buildProductKnowledgeSection(
  data: PromptWizardFormData,
): string | null {
  const productLines: string[] = [];

  for (const key of data.products) {
    const preset = lookupPreset(PRODUCT_PRESETS, key);
    if (preset) {
      productLines.push(`- **${preset.label}** — ${preset.description}`);
    }
  }

  if (productLines.length === 0 && !data.productCustomKnowledge.trim()) {
    return null;
  }

  const parts = ["## Insurance Knowledge"];
  parts.push("You can discuss these topics in general, educational terms:");

  if (productLines.length > 0) {
    parts.push(productLines.join("\n"));
  }

  if (data.productCustomKnowledge.trim()) {
    parts.push(data.productCustomKnowledge.trim());
  }

  parts.push(
    "When discussing any product, keep it educational. Explain what it is and why people consider it. If the caller wants to go deeper, engage naturally.",
  );

  return parts.join("\n\n");
}

function buildQualificationSection(data: PromptWizardFormData): string | null {
  const questions = data.qualificationQuestions.filter((q) => q.trim());
  if (questions.length === 0) return null;

  const numbered = questions.map((q, i) => `${i + 1}. ${q.trim()}`).join("\n");

  return `## Qualification
Ask these questions naturally during the conversation:\n${numbered}`;
}

function buildPricingSection(data: PromptWizardFormData): string {
  const isCloned = data.identityMode === "cloned_voice";
  const parts = [
    "## Pricing and Quotes",
    "When a caller asks about specific prices, rates, or premiums:",
  ];

  // Cloned voice speaks as the agent; stock voice references {{agent_name}}
  const bridgePhrase = isCloned
    ? `"The good news is it only takes a few minutes to get your exact numbers. Let me check my calendar — what day works best for a quick call?"`
    : `"The good news is it only takes a few minutes to get your exact numbers. Let me get you set up with {{agent_name}} — what day works best for a quick call?"`;

  const rangesBridge = isCloned
    ? `"To get your exact numbers, let's set up a quick call. What works for you?"`
    : `"To get your exact numbers, it helps to spend a few minutes with {{agent_name}}. Want me to set that up?"`;

  const declineBridge = isCloned
    ? `"I'd be happy to go over the details — let me find a good time. What works for you?"`
    : `"I'd be happy to set up a quick call with {{agent_name}} to go over the details. What works for you?"`;

  switch (data.pricingStrategy) {
    case "bridge_to_appointment":
      parts.push(`- Never quote a specific number or price range.
- Acknowledge the question warmly: "That's a great question."
- Explain briefly that rates are personalized — they depend on age, health history, coverage amount, and the type of policy.
- Bridge to scheduling: ${bridgePhrase}
- Always bridge to scheduling an appointment.`);
      break;
    case "provide_ranges":
      parts.push(`- You may provide general ballpark ranges when asked, but always clarify that exact rates depend on individual factors like age, health, and coverage amount.
- After giving a general range, recommend a personalized call: ${rangesBridge}
- Never guarantee specific rates or make binding promises.`);
      break;
    case "decline":
      parts.push(`- Politely decline to discuss specific pricing.
- Explain that accurate pricing requires a personalized review.
- Offer to schedule a time: ${declineBridge}`);
      break;
  }

  if (data.pricingCustomScript.trim()) {
    parts.push(data.pricingCustomScript.trim());
  }

  return parts.join("\n");
}

function buildHardLimitsSection(data: PromptWizardFormData): string | null {
  const lines: string[] = [];

  for (const key of data.hardLimits) {
    const preset = lookupPreset(HARD_LIMIT_PRESETS, key);
    if (preset) lines.push(`- ${preset.prompt}`);
  }

  if (data.hardLimitsCustom.trim()) {
    for (const line of data.hardLimitsCustom.trim().split("\n")) {
      const trimmed = line.trim();
      if (trimmed) lines.push(`- ${trimmed}`);
    }
  }

  if (lines.length === 0) return null;
  return `## Hard Limits\n${lines.join("\n")}`;
}

function buildTaskSection(data: PromptWizardFormData): string {
  const isCloned = data.identityMode === "cloned_voice";

  // When cloned, the AI IS the agent — it bridges to "scheduling a time" rather than "connecting with someone else"
  const bridgeLine = isCloned
    ? `6. When the caller's question goes beyond general education into specific policy advice, rates, or binding decisions, bridge to scheduling: "Let me pull up my calendar — what day works best for us to sit down and go through the details?"`
    : `6. When the caller's question goes beyond general education into specific policy advice, rates, or binding decisions, bridge to an appointment: "Let me get you connected with {{agent_name}} who can walk through the exact details with you."`;

  const transferLine = isCloned
    ? `7. If the caller needs something you cannot handle on this call, offer to schedule a dedicated time or transfer them to your team.`
    : `7. If the caller explicitly asks for a human, and human_handoff_enabled is "true", and transfer_number is present, and the transfer_call tool is available, use transfer_call.`;

  return `## Task
1. Determine the workflow from {{workflow_type}} if available.
2. Start the call using the greeting variable that matches {{workflow_type}}. For example, if workflow_type is "missed_appointment", speak {{greeting_missed_appointment}} as your opening. If workflow_type is "general_inbound", speak {{greeting_general_inbound}}. If no matching greeting is set, use a warm generic greeting.
3. Ask one short question, then wait for the caller to respond.
4. Stay focused on {{workflow_goal}} when available, but follow the caller's lead if they want to discuss something else.
5. If the conversation naturally moves toward insurance questions, engage — use your insurance knowledge to educate and build trust.
${bridgeLine}
${transferLine}
8. If transfer is not available, offer a callback.
9. End politely once the next action is clear.`;
}

function buildTransferSection(data: PromptWizardFormData): string | null {
  const lines: string[] = [];

  for (const key of data.transferTriggers) {
    const preset = lookupPreset(TRANSFER_TRIGGER_PRESETS, key);
    if (preset) lines.push(`- ${preset.prompt}`);
  }

  if (data.transferCustom.trim()) {
    for (const line of data.transferCustom.trim().split("\n")) {
      const trimmed = line.trim();
      if (trimmed) lines.push(`- ${trimmed}`);
    }
  }

  if (lines.length === 0) return null;
  return `## When to Transfer
Transfer the call to a live agent when:\n${lines.join("\n")}`;
}

function buildWorkflowSection(data: PromptWizardFormData): string | null {
  if (data.enabledWorkflows.length === 0) return null;

  const subsections: string[] = [];

  for (const key of data.enabledWorkflows) {
    const preset = lookupPreset(WORKFLOW_PRESETS, key);
    if (!preset) continue;

    const greeting =
      data.workflowGreetings?.[key]?.trim() || preset.defaultGreeting;
    const guidance =
      data.workflowGuidance[key]?.trim() || preset.defaultGuidance;

    subsections.push(`### ${key}\n**Opening:** "${greeting}"\n${guidance}`);
  }

  if (subsections.length === 0) return null;
  return `## Workflow-Specific Openings\n\n${subsections.join("\n\n")}`;
}

export function assemblePrompt(data: PromptWizardFormData): string {
  const sections: string[] = [
    buildIdentitySection(data),
    buildDynamicVariablesSection(),
  ];

  const optional = [
    buildStyleSection(data),
    buildProductKnowledgeSection(data),
    buildQualificationSection(data),
    buildPricingSection(data),
    buildHardLimitsSection(data),
    buildTaskSection(data),
    buildTransferSection(data),
    buildWorkflowSection(data),
  ];

  for (const section of optional) {
    if (section) sections.push(section);
  }

  return sections.join("\n\n");
}
