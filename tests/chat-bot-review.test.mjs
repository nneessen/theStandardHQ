import { describe, expect, it } from "vitest";

import {
  analyzeChatBotLeadReview,
  buildChatBotImprovementBrief,
  analyzeRepetition,
  analyzeMessageQuality,
  analyzeConversationFlow,
  analyzeGuardrailsAndFallbacks,
  analyzeScheduling,
  analyzeCompliance,
  tokenize,
  jaccardSimilarity,
  isIntroPattern,
  containsPriceLanguage,
  containsLifeInsuranceLabel,
  containsDobRequest,
  containsBookingConfirmationLanguage,
  containsEmojiCharacters,
  isTruncated,
  containsMarkdown,
} from "../scripts/lib/chat-bot-review.mjs";

function buildInput(overrides = {}) {
  return {
    target: { leadId: "lead_test" },
    agentBundle: {
      agent: {
        usage: { leadCount: 10, leadLimit: 100 },
      },
      status: {
        isActive: true,
        botEnabled: true,
        closeConnected: true,
        calendlyConnected: true,
        googleConnected: false,
      },
      monitoring: {
        jobHealth: {
          pendingJobs: 0,
          failedJobs24h: 0,
        },
      },
    },
    conversation: {
      id: "conv_1",
      status: "awaiting_reply",
      suppressedAt: null,
      botPausedUntil: null,
      declineState: "soft",
      objectionCount: 1,
    },
    messages: [],
    ...overrides,
  };
}

function buildPassContext(overrides = {}) {
  const normalizedMessages = overrides.normalizedMessages ?? [];
  return {
    normalizedMessages,
    outboundMessages: normalizedMessages.filter((m) => m.direction === "outbound"),
    inboundMessages: normalizedMessages.filter((m) => m.direction === "inbound"),
    conversation: overrides.conversation ?? { id: "conv_1", status: "open" },
    agentBundle: overrides.agentBundle ?? {},
  };
}

// --- Existing tests ---

describe("analyzeChatBotLeadReview", () => {
  it("classifies a negative lead reply as the primary finding", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        messages: [
          {
            createdAt: "2026-03-18T12:27:51.449Z",
            direction: "outbound",
            content: "Hi there",
          },
          {
            createdAt: "2026-03-18T12:28:29.841Z",
            direction: "inbound",
            senderType: "bot",
            content: "No",
          },
        ],
      }),
    );

    expect(review.summary.primaryReasonCode).toBe("lead_replied_negative");
    expect(review.findings.some((item) => item.code === "bot_sent_messages")).toBe(
      true,
    );
    expect(
      review.findings.some((item) => item.code === "message_metadata_mismatch"),
    ).toBe(true);
  });

  it("flags missing outbound replies after inbound messages", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        messages: [
          {
            createdAt: "2026-03-18T12:28:29.841Z",
            direction: "inbound",
            content: "Hello?",
          },
        ],
      }),
    );

    expect(review.summary.primaryReasonCode).toBe("no_outbound_response");
  });

  it("prioritizes suppression when the conversation is suppressed", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        conversation: {
          id: "conv_1",
          status: "closed",
          suppressedAt: "2026-03-18T12:40:00.000Z",
          botPausedUntil: null,
          declineState: "none",
          objectionCount: 0,
        },
      }),
    );

    expect(review.summary.primaryReasonCode).toBe("conversation_suppressed");
  });

  it("reports no conversation found when nothing resolves", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        conversation: null,
      }),
    );

    expect(review.summary.primaryReasonCode).toBe("no_conversation_found");
  });

  it("builds an improvement brief with recommended changes and tests", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        conversation: {
          id: "conv_1",
          leadName: "Lakeshia R Ceasar",
          status: "awaiting_reply",
          suppressedAt: null,
          botPausedUntil: null,
          declineState: "soft",
          objectionCount: 1,
        },
        messages: [
          {
            createdAt: "2026-03-18T12:27:51.449Z",
            direction: "outbound",
            content: "Hi there",
          },
          {
            createdAt: "2026-03-18T12:28:29.841Z",
            direction: "inbound",
            senderType: "bot",
            content: "No",
          },
        ],
      }),
    );

    const brief = buildChatBotImprovementBrief(review);

    expect(brief).toContain("Recommended Changes");
    expect(brief).toContain("Regression Tests");
    expect(brief).toContain("Should a bare `No` be treated");
    expect(brief).toContain("direction` and `senderType`");
  });

  it("detects appointment reminder timezone mismatches", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        target: { leadId: "lead_test" },
        agentBundle: {
          agent: {
            agent: {
              timezone: "America/New_York",
            },
            usage: { leadCount: 10, leadLimit: 100 },
          },
          status: {
            isActive: true,
            botEnabled: true,
            closeConnected: true,
            calendlyConnected: true,
            googleConnected: false,
          },
          monitoring: {
            jobHealth: {
              pendingJobs: 0,
              failedJobs24h: 0,
            },
          },
          appointments: [
            {
              id: "appt_1",
              closeLeadId: "lead_test",
              startAt: "2026-03-18T15:00:00.000Z",
            },
          ],
        },
        messages: [
          {
            createdAt: "2026-03-18T04:35:02.060Z",
            direction: "inbound",
            senderType: "bot",
            content: "March 18,  10:00  AM, CST.",
          },
          {
            createdAt: "2026-03-18T11:50:29.634Z",
            direction: "outbound",
            senderType: "bot",
            content:
              "Hey Olivia, just a reminder about your call today at 11:00 AM. Looking forward to it!",
          },
          {
            createdAt: "2026-03-18T14:00:30.524Z",
            direction: "outbound",
            senderType: "bot",
            content:
              "Hey Olivia, just a heads up -- your call is coming up today at 11:00 AM. Talk soon!",
          },
        ],
      }),
    );

    expect(review.summary.primaryReasonCode).toBe(
      "appointment_timezone_mismatch",
    );
    expect(
      review.findings.some((item) => item.code === "message_metadata_mismatch"),
    ).toBe(true);
  });

  it("includes enriched timeline with replyCategory and metadata", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        messages: [
          {
            createdAt: "2026-03-18T12:27:51.449Z",
            direction: "outbound",
            content: "Hi there",
            replyCategory: "intro",
            fallbackKind: null,
            guardrailViolations: [],
            messageKind: "ai_reply",
          },
        ],
      }),
    );

    expect(review.timeline[0].replyCategory).toBe("intro");
    expect(review.timeline[0].messageKind).toBe("ai_reply");
    expect(review.timeline[0].fallbackKind).toBeNull();
    expect(review.timeline[0].guardrailViolations).toEqual([]);
  });
});

// --- Utility function tests ---

describe("utility functions", () => {
  it("tokenize splits text into lowercase word set", () => {
    const tokens = tokenize("Hello World hello");
    expect(tokens).toEqual(new Set(["hello", "world"]));
  });

  it("jaccardSimilarity returns 1 for identical text", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1);
  });

  it("jaccardSimilarity returns 0 for completely different text", () => {
    expect(jaccardSimilarity("hello world", "foo bar")).toBe(0);
  });

  it("isIntroPattern matches intro openers", () => {
    expect(isIntroPattern("Hi John, this is Sarah from ABC")).toBe(true);
    expect(isIntroPattern("Hey Jane, this is Mike")).toBe(true);
    expect(isIntroPattern("Hello Tom, this is the bot")).toBe(true);
    expect(isIntroPattern("Sure, I can help")).toBe(false);
  });

  it("containsPriceLanguage detects price keywords", () => {
    expect(containsPriceLanguage("The premium is $50")).toBe(true);
    expect(containsPriceLanguage("Let me get you a quote")).toBe(true);
    expect(containsPriceLanguage("What time works for you?")).toBe(false);
  });

  it("containsLifeInsuranceLabel detects life insurance", () => {
    expect(containsLifeInsuranceLabel("We offer life insurance")).toBe(true);
    expect(containsLifeInsuranceLabel("mortgage protection plan")).toBe(false);
  });

  it("containsDobRequest detects DOB requests", () => {
    expect(containsDobRequest("What is your DOB?")).toBe(true);
    expect(containsDobRequest("When is your birthday?")).toBe(true);
    expect(containsDobRequest("How old are you?")).toBe(true); // "how old" matches
    expect(containsDobRequest("What is your age range?")).toBe(true);
    expect(containsDobRequest("What time works?")).toBe(false);
  });

  it("containsBookingConfirmationLanguage detects booking language", () => {
    expect(containsBookingConfirmationLanguage("You're all set for Tuesday!")).toBe(true);
    expect(containsBookingConfirmationLanguage("Your appointment is confirmed")).toBe(true);
    expect(containsBookingConfirmationLanguage("What time works?")).toBe(false);
  });

  it("containsEmojiCharacters detects emoji", () => {
    expect(containsEmojiCharacters("Great! 👍")).toBe(true);
    expect(containsEmojiCharacters("Great!")).toBe(false);
  });

  it("isTruncated detects truncated messages", () => {
    expect(isTruncated("I wanted to ask you about yo")).toBe(true);
    expect(isTruncated("Are you available for a qu")).toBe(true);
    expect(isTruncated("Hello, how are you today?")).toBe(false);
    expect(isTruncated("This is a complete sentence.")).toBe(false);
    expect(isTruncated("Hi there")).toBe(false);
  });

  it("containsMarkdown detects markdown formatting", () => {
    expect(containsMarkdown("**bold text**")).toBe(true);
    expect(containsMarkdown("## Heading")).toBe(true);
    expect(containsMarkdown("- list item")).toBe(true);
    expect(containsMarkdown("plain text")).toBe(false);
  });
});

// --- analyzeRepetition tests ---

describe("analyzeRepetition", () => {
  it("detects repeated outbound content", () => {
    const findings = analyzeRepetition(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "Hi John, I wanted to reach out about your mortgage protection options and schedule a quick call.", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "Hi John, I wanted to reach out about your mortgage protection options and schedule a quick call with you.", createdAt: "2026-03-18T12:05:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "repeated_outbound_content")).toBe(true);
  });

  it("detects repeated intro messages", () => {
    const findings = analyzeRepetition(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "Hi John, this is Sarah from Standard. I wanted to reach out.", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "Hey John, this is Sarah from Standard. Just following up.", createdAt: "2026-03-18T12:05:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "repeated_intro_messages")).toBe(true);
  });

  it("detects repeated fallback replies", () => {
    const findings = analyzeRepetition(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "Thanks for your message.", fallbackKind: "qualification_followup", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "I appreciate your response.", fallbackKind: "qualification_followup", createdAt: "2026-03-18T12:05:00Z" },
          { direction: "outbound", content: "Got it, thanks.", fallbackKind: "qualification_followup", createdAt: "2026-03-18T12:10:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "repeated_fallback_reply")).toBe(true);
  });

  it("detects repeated qualification topic", () => {
    const findings = analyzeRepetition(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "What state are you in?", guardrailViolations: ["repeated_qualification_question"], createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "Which state do you live in?", guardrailViolations: ["repeated_qualification_question"], createdAt: "2026-03-18T12:05:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "repeated_qualification_topic")).toBe(true);
  });

  it("passes clean conversation with no repetition", () => {
    const findings = analyzeRepetition(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "Hi John, this is Sarah.", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "inbound", content: "Hi Sarah", createdAt: "2026-03-18T12:01:00Z" },
          { direction: "outbound", content: "What time works for a quick call?", createdAt: "2026-03-18T12:02:00Z" },
        ],
      }),
    );

    expect(findings.length).toBe(0);
  });
});

// --- analyzeMessageQuality tests ---

describe("analyzeMessageQuality", () => {
  it("detects truncated messages", () => {
    const findings = analyzeMessageQuality(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "I wanted to ask you about yo", createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "truncated_message")).toBe(true);
  });

  it("detects markdown in SMS", () => {
    const findings = analyzeMessageQuality(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "**Important:** Please call us back.", createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "markdown_in_sms")).toBe(true);
  });

  it("detects wall of text", () => {
    const longContent = "A".repeat(321);
    const findings = analyzeMessageQuality(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: longContent, createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "wall_of_text")).toBe(true);
  });

  it("detects emoji in outbound", () => {
    const findings = analyzeMessageQuality(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "Great to hear! 👍 Let me know.", createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "emoji_in_outbound")).toBe(true);
  });

  it("passes clean messages with no quality issues", () => {
    const findings = analyzeMessageQuality(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "What time works best for a quick call?", createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.length).toBe(0);
  });
});

// --- analyzeConversationFlow tests ---

describe("analyzeConversationFlow", () => {
  it("detects outbound spam ratio", () => {
    const messages = [];
    for (let i = 0; i < 6; i++) {
      messages.push({
        direction: "outbound",
        content: `Outbound message ${i}`,
        createdAt: `2026-03-18T12:${String(i).padStart(2, "0")}:00Z`,
      });
    }
    messages.push({
      direction: "inbound",
      content: "Hello",
      createdAt: "2026-03-18T11:59:00Z",
    });

    const findings = analyzeConversationFlow(buildPassContext({ normalizedMessages: messages }));

    expect(findings.some((f) => f.code === "outbound_spam_ratio")).toBe(true);
  });

  it("detects conversation stuck on same replyCategory", () => {
    const findings = analyzeConversationFlow(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "When works?", replyCategory: "scheduling", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "How about 2pm?", replyCategory: "scheduling", createdAt: "2026-03-18T12:05:00Z" },
          { direction: "outbound", content: "Would 3pm work?", replyCategory: "scheduling", createdAt: "2026-03-18T12:10:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "conversation_stuck")).toBe(true);
  });

  it("detects response gap over 10 minutes", () => {
    const findings = analyzeConversationFlow(
      buildPassContext({
        normalizedMessages: [
          { direction: "inbound", content: "Hello?", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "Hi there!", createdAt: "2026-03-18T12:15:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "response_gap_detected")).toBe(true);
  });

  it("passes clean conversation flow", () => {
    const findings = analyzeConversationFlow(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "Hi there", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "inbound", content: "Hey", createdAt: "2026-03-18T12:01:00Z" },
          { direction: "outbound", content: "How can I help?", createdAt: "2026-03-18T12:02:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "outbound_spam_ratio")).toBe(false);
    expect(findings.some((f) => f.code === "response_gap_detected")).toBe(false);
  });
});

// --- analyzeGuardrailsAndFallbacks tests ---

describe("analyzeGuardrailsAndFallbacks", () => {
  it("detects all messages are fallbacks", () => {
    const findings = analyzeGuardrailsAndFallbacks(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "Thanks.", fallbackKind: "generic", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "Got it.", fallbackKind: "qualification_followup", createdAt: "2026-03-18T12:05:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "all_messages_are_fallbacks")).toBe(true);
  });

  it("detects high guardrail violation rate", () => {
    const findings = analyzeGuardrailsAndFallbacks(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "Msg 1", guardrailViolations: ["price_quote"], createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "Msg 2", guardrailViolations: ["price_quote"], createdAt: "2026-03-18T12:01:00Z" },
          { direction: "outbound", content: "Msg 3", guardrailViolations: [], createdAt: "2026-03-18T12:02:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "high_guardrail_violation_rate")).toBe(true);
  });

  it("detects frequent violation type", () => {
    const findings = analyzeGuardrailsAndFallbacks(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "A", guardrailViolations: ["too_long"], createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "B", guardrailViolations: ["too_long"], createdAt: "2026-03-18T12:01:00Z" },
          { direction: "outbound", content: "C", guardrailViolations: ["too_long"], createdAt: "2026-03-18T12:02:00Z" },
          { direction: "outbound", content: "D", guardrailViolations: [], createdAt: "2026-03-18T12:03:00Z" },
          { direction: "outbound", content: "E", guardrailViolations: [], createdAt: "2026-03-18T12:04:00Z" },
          { direction: "outbound", content: "F", guardrailViolations: [], createdAt: "2026-03-18T12:05:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "frequent_violation_type")).toBe(true);
  });

  it("detects false appointment confirmation from guardrails", () => {
    const findings = analyzeGuardrailsAndFallbacks(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "You're all set!", guardrailViolations: ["false_appointment_confirmation"], createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "false_appointment_confirmation_detected")).toBe(true);
  });

  it("detects price quote violation from guardrails", () => {
    const findings = analyzeGuardrailsAndFallbacks(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "The cost is $50/mo.", guardrailViolations: ["price_quote"], createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "price_quote_violation_detected")).toBe(true);
  });

  it("passes clean conversation with no guardrail issues", () => {
    const findings = analyzeGuardrailsAndFallbacks(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "What time works?", guardrailViolations: [], createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "How about Tuesday?", guardrailViolations: [], createdAt: "2026-03-18T12:05:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "all_messages_are_fallbacks")).toBe(false);
    expect(findings.some((f) => f.code === "high_guardrail_violation_rate")).toBe(false);
  });
});

// --- analyzeScheduling tests ---

describe("analyzeScheduling", () => {
  it("detects scheduling without resolution", () => {
    const findings = analyzeScheduling(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "How about 2pm?", replyCategory: "scheduling", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "Would 3pm work?", replyCategory: "scheduling", createdAt: "2026-03-18T12:05:00Z" },
          { direction: "outbound", content: "4pm then?", replyCategory: "scheduling", createdAt: "2026-03-18T12:10:00Z" },
        ],
        conversation: { id: "conv_1", status: "stale" },
        agentBundle: { appointments: [] },
      }),
    );

    expect(findings.some((f) => f.code === "scheduling_without_resolution")).toBe(true);
  });

  it("detects false booking confirmation", () => {
    const findings = analyzeScheduling(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "You're all set for your appointment on Tuesday!", createdAt: "2026-03-18T12:00:00Z" },
        ],
        conversation: { id: "conv_1", status: "open" },
        agentBundle: { appointments: [] },
      }),
    );

    expect(findings.some((f) => f.code === "false_booking_confirmation")).toBe(true);
  });

  it("passes when appointment exists for booking confirmation", () => {
    const findings = analyzeScheduling(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "You're all set for your appointment!", createdAt: "2026-03-18T12:00:00Z" },
        ],
        conversation: { id: "conv_1", status: "booked", closeLeadId: "lead_1" },
        agentBundle: { appointments: [{ id: "appt_1", closeLeadId: "lead_1" }] },
      }),
    );

    expect(findings.some((f) => f.code === "false_booking_confirmation")).toBe(false);
  });
});

// --- analyzeCompliance tests ---

describe("analyzeCompliance", () => {
  it("detects price language in outbound", () => {
    const findings = analyzeCompliance(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "The premium would be around $150 per month.", createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "price_language_in_outbound")).toBe(true);
  });

  it("detects life insurance label misuse", () => {
    const findings = analyzeCompliance(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "We can discuss your mortgage protection options.", createdAt: "2026-03-18T12:00:00Z" },
          { direction: "outbound", content: "Our life insurance plans are great.", createdAt: "2026-03-18T12:05:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "life_insurance_label_misuse")).toBe(true);
  });

  it("detects DOB request in outbound", () => {
    const findings = analyzeCompliance(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "What is your date of birth?", createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.some((f) => f.code === "dob_request_in_outbound")).toBe(true);
  });

  it("detects pushy after hard decline", () => {
    const findings = analyzeCompliance(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "How about 2pm tomorrow?", replyCategory: "scheduling", createdAt: "2026-03-18T12:00:00Z" },
        ],
        conversation: { id: "conv_1", status: "open", declineState: "hard" },
      }),
    );

    expect(findings.some((f) => f.code === "pushy_after_decline")).toBe(true);
  });

  it("passes clean compliant conversation", () => {
    const findings = analyzeCompliance(
      buildPassContext({
        normalizedMessages: [
          { direction: "outbound", content: "What time works best for a quick call?", createdAt: "2026-03-18T12:00:00Z" },
        ],
      }),
    );

    expect(findings.length).toBe(0);
  });
});

// --- codePath tests ---

describe("codePath", () => {
  it("new deep analysis findings include codePath", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        messages: [
          { createdAt: "2026-03-18T12:00:00Z", direction: "outbound", content: "Hi John, this is Sarah from Standard. I wanted to reach out about mortgage protection." },
          { createdAt: "2026-03-18T12:01:00Z", direction: "outbound", content: "Hey John, this is Sarah from Standard. Just following up on mortgage protection." },
        ],
      }),
    );

    const introFinding = review.findings.find((f) => f.code === "repeated_intro_messages");
    expect(introFinding).toBeDefined();
    expect(introFinding.codePath).toBe("ai-helpers.ts > stripRedundantIntro()");
  });

  it("infrastructure findings do not have codePath", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        conversation: null,
      }),
    );

    const noConvFinding = review.findings.find((f) => f.code === "no_conversation_found");
    expect(noConvFinding).toBeDefined();
    expect(noConvFinding.codePath).toBeUndefined();
  });
});

// --- buildChatBotImprovementBrief with new findings ---

describe("buildChatBotImprovementBrief with deep analysis", () => {
  it("includes Code Paths to Investigate section", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        messages: [
          { createdAt: "2026-03-18T12:00:00Z", direction: "outbound", content: "Hi John, this is Sarah from Standard. Reaching out about mortgage protection." },
          { createdAt: "2026-03-18T12:01:00Z", direction: "outbound", content: "Hey John, this is Sarah from Standard. Following up on mortgage protection." },
        ],
      }),
    );

    const brief = buildChatBotImprovementBrief(review);
    expect(brief).toContain("Code Paths to Investigate");
    expect(brief).toContain("ai-helpers.ts");
  });

  it("includes recommendations for new finding codes", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        messages: [
          { createdAt: "2026-03-18T12:00:00Z", direction: "outbound", content: "The premium is $150 per month for the plan." },
        ],
      }),
    );

    const brief = buildChatBotImprovementBrief(review);
    expect(brief).toContain("Recommended Changes");
    expect(brief).toContain("CRITICAL");
    expect(brief).toContain("price");
  });

  it("includes recommendations for truncated messages", () => {
    const review = analyzeChatBotLeadReview(
      buildInput({
        messages: [
          { createdAt: "2026-03-18T12:00:00Z", direction: "outbound", content: "I wanted to ask you about yo" },
          { createdAt: "2026-03-18T12:01:00Z", direction: "inbound", content: "What?" },
          { createdAt: "2026-03-18T12:02:00Z", direction: "outbound", content: "Sorry about that. What time works?" },
        ],
      }),
    );

    const brief = buildChatBotImprovementBrief(review);
    expect(brief).toContain("truncation");
  });
});
