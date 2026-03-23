import { describe, it, expect } from "vitest";
import { assemblePrompt } from "./prompt-assembler";
import {
  EMPTY_WIZARD_FORM,
  type PromptWizardFormData,
} from "./prompt-wizard-types";

function makeForm(
  overrides: Partial<PromptWizardFormData> = {},
): PromptWizardFormData {
  return { ...EMPTY_WIZARD_FORM, ...overrides };
}

describe("assemblePrompt", () => {
  it("produces a non-empty string from defaults", () => {
    const result = assemblePrompt(EMPTY_WIZARD_FORM);
    expect(result.length).toBeGreaterThan(100);
  });

  it("always includes Identity section", () => {
    const result = assemblePrompt(EMPTY_WIZARD_FORM);
    expect(result).toContain("## Identity");
  });

  it("always includes Dynamic Variables section", () => {
    const result = assemblePrompt(EMPTY_WIZARD_FORM);
    expect(result).toContain("## Dynamic Variables");
    expect(result).toContain("{{workflow_type}}");
    expect(result).toContain("curly braces, treat it as missing");
  });

  it("always includes Task section", () => {
    const result = assemblePrompt(EMPTY_WIZARD_FORM);
    expect(result).toContain("## Task");
    expect(result).toContain("1. Determine the workflow");
  });

  it("always includes Pricing section", () => {
    const result = assemblePrompt(EMPTY_WIZARD_FORM);
    expect(result).toContain("## Pricing and Quotes");
  });

  describe("Identity", () => {
    it("uses agent name and agency when provided (assistant mode)", () => {
      const result = assemblePrompt(
        makeForm({
          identityMode: "assistant",
          agentName: "Sarah",
          agencyName: "ABC Insurance",
        }),
      );
      expect(result).toContain("You are Sarah");
      expect(result).toContain("at ABC Insurance");
    });

    it("falls back to dynamic variables when name/agency are empty", () => {
      const result = assemblePrompt(
        makeForm({ agentName: "", agencyName: "" }),
      );
      expect(result).toContain("{{agent_name}}");
      expect(result).toContain("{{company_name}}");
    });

    it("includes timezone", () => {
      const result = assemblePrompt(makeForm({ timezone: "America/Chicago" }));
      expect(result).toContain("America/Chicago");
    });

    it("includes agent role in assistant mode", () => {
      const result = assemblePrompt(
        makeForm({
          identityMode: "assistant",
          agentRole: "Medicare enrollment specialist",
        }),
      );
      expect(result).toContain("Medicare enrollment specialist");
    });

    it("uses first-person framing in cloned_voice mode", () => {
      const result = assemblePrompt(
        makeForm({
          identityMode: "cloned_voice",
          agentName: "Nick",
          agencyName: "Nick Insurance",
        }),
      );
      expect(result).toContain("You ARE Nick from Nick Insurance");
      expect(result).toContain("not an assistant or a bot");
      expect(result).toContain("first person");
      expect(result).toContain("Never say you are an AI");
    });

    it("cloned_voice mode adjusts pricing bridge language", () => {
      const result = assemblePrompt(
        makeForm({
          identityMode: "cloned_voice",
          pricingStrategy: "bridge_to_appointment",
        }),
      );
      expect(result).toContain("my calendar");
      expect(result).not.toContain("get you set up with {{agent_name}}");
    });

    it("cloned_voice mode adjusts task section language", () => {
      const result = assemblePrompt(makeForm({ identityMode: "cloned_voice" }));
      expect(result).toContain("Let me pull up my calendar");
      expect(result).not.toContain(
        "Let me get you connected with {{agent_name}}",
      );
    });
  });

  describe("Style", () => {
    it("includes style rules from presets", () => {
      const result = assemblePrompt(
        makeForm({ styleRules: ["short_sentences", "warm_tone"] }),
      );
      expect(result).toContain("## Style");
      expect(result).toContain("Keep replies to 1-2 sentences");
      expect(result).toContain("warm, calm, and natural");
    });

    it("includes custom style rules", () => {
      const result = assemblePrompt(
        makeForm({ styleRules: [], styleCustom: "Always say goodbye warmly" }),
      );
      expect(result).toContain("Always say goodbye warmly");
    });

    it("omits section when no style rules selected and no custom", () => {
      const result = assemblePrompt(
        makeForm({ styleRules: [], styleCustom: "" }),
      );
      expect(result).not.toContain("## Style");
    });
  });

  describe("Products", () => {
    it("includes selected products with descriptions", () => {
      const result = assemblePrompt(
        makeForm({ products: ["mortgage_protection", "term_life"] }),
      );
      expect(result).toContain("## Insurance Knowledge");
      expect(result).toContain("**Mortgage Protection**");
      expect(result).toContain("**Term Life Insurance**");
      expect(result).toContain("keep it educational");
    });

    it("includes custom product knowledge", () => {
      const result = assemblePrompt(
        makeForm({ productCustomKnowledge: "We also sell pet insurance." }),
      );
      expect(result).toContain("pet insurance");
    });

    it("omits section when no products and no custom", () => {
      const result = assemblePrompt(
        makeForm({ products: [], productCustomKnowledge: "" }),
      );
      expect(result).not.toContain("## Insurance Knowledge");
    });
  });

  describe("Qualification", () => {
    it("includes qualification questions as numbered list", () => {
      const result = assemblePrompt(
        makeForm({
          qualificationQuestions: ["What state?", "Date of birth?"],
        }),
      );
      expect(result).toContain("## Qualification");
      expect(result).toContain("1. What state?");
      expect(result).toContain("2. Date of birth?");
    });

    it("omits section when questions are empty", () => {
      const result = assemblePrompt(makeForm({ qualificationQuestions: [] }));
      expect(result).not.toContain("## Qualification");
    });

    it("filters out blank questions", () => {
      const result = assemblePrompt(
        makeForm({ qualificationQuestions: ["What state?", "", "  "] }),
      );
      const qualSection =
        result.split("## Qualification")[1]?.split("##")[0] ?? "";
      expect(qualSection).toContain("1. What state?");
      expect(qualSection).not.toContain("2.");
    });
  });

  describe("Pricing", () => {
    it("uses bridge_to_appointment strategy by default", () => {
      const result = assemblePrompt(EMPTY_WIZARD_FORM);
      expect(result).toContain("Never quote a specific number");
      expect(result).toContain("bridge to scheduling");
    });

    it("uses provide_ranges strategy", () => {
      const result = assemblePrompt(
        makeForm({ pricingStrategy: "provide_ranges" }),
      );
      expect(result).toContain("general ballpark ranges");
    });

    it("uses decline strategy", () => {
      const result = assemblePrompt(makeForm({ pricingStrategy: "decline" }));
      expect(result).toContain("Politely decline");
    });

    it("includes custom pricing script", () => {
      const result = assemblePrompt(
        makeForm({ pricingCustomScript: "Mention our free consultation." }),
      );
      expect(result).toContain("free consultation");
    });
  });

  describe("Hard Limits", () => {
    it("includes checked limits", () => {
      const result = assemblePrompt(
        makeForm({ hardLimits: ["no_specific_prices", "no_guessing_facts"] }),
      );
      expect(result).toContain("## Hard Limits");
      expect(result).toContain("Never quote specific dollar amounts");
      expect(result).toContain("Do not guess or invent facts");
    });

    it("includes custom limits", () => {
      const result = assemblePrompt(
        makeForm({
          hardLimits: [],
          hardLimitsCustom: "Never discuss competitors by name",
        }),
      );
      expect(result).toContain("Never discuss competitors by name");
    });

    it("omits section when nothing selected", () => {
      const result = assemblePrompt(
        makeForm({ hardLimits: [], hardLimitsCustom: "" }),
      );
      expect(result).not.toContain("## Hard Limits");
    });
  });

  describe("Transfer Rules", () => {
    it("includes checked transfer triggers", () => {
      const result = assemblePrompt(
        makeForm({ transferTriggers: ["caller_upset", "ready_for_quote"] }),
      );
      expect(result).toContain("## When to Transfer");
      expect(result).toContain("upset or asks to speak with a manager");
      expect(result).toContain("ready for a quote");
    });

    it("omits section when nothing selected", () => {
      const result = assemblePrompt(
        makeForm({ transferTriggers: [], transferCustom: "" }),
      );
      expect(result).not.toContain("## When to Transfer");
    });
  });

  describe("Workflows", () => {
    it("includes enabled workflows with default guidance", () => {
      const result = assemblePrompt(
        makeForm({ enabledWorkflows: ["missed_appointment", "reschedule"] }),
      );
      expect(result).toContain("## Workflow-Specific Openings");
      expect(result).toContain("### missed_appointment");
      expect(result).toContain("empathy, not guilt");
      expect(result).toContain("### reschedule");
    });

    it("uses custom guidance when provided", () => {
      const result = assemblePrompt(
        makeForm({
          enabledWorkflows: ["after_hours_inbound"],
          workflowGuidance: {
            after_hours_inbound: "Just take a message and say goodbye.",
          },
        }),
      );
      expect(result).toContain("Just take a message and say goodbye");
      expect(result).not.toContain("friendly after-hours receptionist");
    });

    it("omits section when no workflows enabled", () => {
      const result = assemblePrompt(makeForm({ enabledWorkflows: [] }));
      expect(result).not.toContain("## Workflow-Specific Openings");
    });
  });

  describe("Full assembly", () => {
    it("assembles all sections in correct order", () => {
      const full = makeForm({
        agentName: "Nick",
        agencyName: "Nick Insurance",
        products: ["mortgage_protection"],
        enabledWorkflows: ["after_hours_inbound"],
      });
      const result = assemblePrompt(full);

      const identityIdx = result.indexOf("## Identity");
      const dynamicIdx = result.indexOf("## Dynamic Variables");
      const styleIdx = result.indexOf("## Style");
      const knowledgeIdx = result.indexOf("## Insurance Knowledge");
      const qualIdx = result.indexOf("## Qualification");
      const pricingIdx = result.indexOf("## Pricing");
      const limitsIdx = result.indexOf("## Hard Limits");
      const taskIdx = result.indexOf("## Task");
      const transferIdx = result.indexOf("## When to Transfer");
      const workflowIdx = result.indexOf("## Workflow-Specific");

      expect(identityIdx).toBeLessThan(dynamicIdx);
      expect(dynamicIdx).toBeLessThan(styleIdx);
      expect(styleIdx).toBeLessThan(knowledgeIdx);
      expect(knowledgeIdx).toBeLessThan(qualIdx);
      expect(qualIdx).toBeLessThan(pricingIdx);
      expect(pricingIdx).toBeLessThan(limitsIdx);
      expect(limitsIdx).toBeLessThan(taskIdx);
      expect(taskIdx).toBeLessThan(transferIdx);
      expect(transferIdx).toBeLessThan(workflowIdx);
    });

    it("handles special characters in user input without corruption", () => {
      const result = assemblePrompt(
        makeForm({
          agentName: 'O\'Brien & "Associates"',
          styleCustom: "Use `backticks` and **bold** carefully",
        }),
      );
      expect(result).toContain('O\'Brien & "Associates"');
      expect(result).toContain("`backticks`");
    });
  });
});
