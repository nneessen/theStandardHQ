import { describe, expect, it } from "vitest";

import {
  analyzeChatBotLeadReview,
  buildChatBotImprovementBrief,
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
});
