// src/features/channel-orchestration/data/starter-templates.ts
// Hardcoded orchestration rule templates available locally.
// These serve as fallbacks when the chat-bot-api is unavailable, and as the
// primary source of truth for starter orchestration templates.

import type {
  OrchestrationTemplate,
  OrchestrationTemplatePreview,
} from "../types/orchestration.types";

// ─── Template Definitions ────────────────────────────────────────────────────

const STARTER_ORCHESTRATION_TEMPLATES: OrchestrationTemplatePreview[] = [
  {
    id: "sms-first-escalation",
    name: "SMS-First Escalation",
    description:
      "Start with SMS for all new leads. Escalate to voice after 2 unanswered SMS attempts. Ideal for high-volume lead sources.",
    tags: ["sms", "escalation", "new-leads"],
    fallbackAction: {
      allowedChannels: ["sms"],
      preferredChannel: "sms",
    },
    rules: [
      {
        id: "sms-esc-rule-1",
        name: "New Lead — SMS First",
        enabled: true,
        conditions: {
          channelHistory: {
            smsAttempts: { operator: "lt", value: 2 },
          },
        },
        action: {
          allowedChannels: ["sms"],
          preferredChannel: "sms",
          cooldownMinutes: 240,
        },
      },
      {
        id: "sms-esc-rule-2",
        name: "No SMS Reply — Escalate to Voice",
        enabled: true,
        conditions: {
          channelHistory: {
            smsAttempts: { operator: "gte", value: 2 },
            lastSmsAgeMinutes: { operator: "gte", value: 480 },
          },
        },
        action: {
          allowedChannels: ["voice"],
          preferredChannel: "voice",
          cooldownMinutes: 1440,
        },
      },
      {
        id: "sms-esc-rule-3",
        name: "Voice Attempted — Back to SMS",
        enabled: true,
        conditions: {
          channelHistory: {
            voiceAttempts: { operator: "gte", value: 1 },
            lastVoiceOutcome: ["voicemail", "no_answer"],
          },
        },
        action: {
          allowedChannels: ["sms"],
          preferredChannel: "sms",
          cooldownMinutes: 1440,
        },
      },
    ],
  },
  {
    id: "voice-first-high-value",
    name: "Voice-First High Value",
    description:
      "Lead with voice calls for high-intent leads. Falls back to SMS if call goes unanswered. Best for quoted leads and warm referrals.",
    tags: ["voice", "high-value", "quoted-leads"],
    fallbackAction: {
      allowedChannels: ["sms", "voice"],
      preferredChannel: "voice",
    },
    rules: [
      {
        id: "vf-rule-1",
        name: "First Touch — Voice Call",
        enabled: true,
        conditions: {
          channelHistory: {
            voiceAttempts: { operator: "eq", value: 0 },
          },
        },
        action: {
          allowedChannels: ["voice"],
          preferredChannel: "voice",
          cooldownMinutes: 60,
        },
      },
      {
        id: "vf-rule-2",
        name: "Voice Unanswered — Follow Up SMS",
        enabled: true,
        conditions: {
          channelHistory: {
            voiceAttempts: { operator: "gte", value: 1 },
            lastVoiceOutcome: ["voicemail", "no_answer", "busy"],
          },
        },
        action: {
          allowedChannels: ["sms"],
          preferredChannel: "sms",
          cooldownMinutes: 120,
        },
      },
      {
        id: "vf-rule-3",
        name: "SMS Sent — Retry Voice Next Day",
        enabled: true,
        conditions: {
          channelHistory: {
            smsAttempts: { operator: "gte", value: 1 },
            lastSmsAgeMinutes: { operator: "gte", value: 1440 },
          },
        },
        action: {
          allowedChannels: ["voice"],
          preferredChannel: "voice",
          cooldownMinutes: 1440,
        },
      },
    ],
  },
  {
    id: "business-hours-routing",
    name: "Business Hours Routing",
    description:
      "SMS during business hours, voice for after-hours inbound. Ensures leads always get a response regardless of time.",
    tags: ["time-based", "after-hours", "inbound"],
    fallbackAction: {
      allowedChannels: ["sms"],
      preferredChannel: "sms",
    },
    rules: [
      {
        id: "bh-rule-1",
        name: "Business Hours — SMS Outreach",
        enabled: true,
        conditions: {
          timeWindow: {
            startTime: "09:00",
            endTime: "17:00",
            days: [1, 2, 3, 4, 5],
            timezone: "America/New_York",
          },
        },
        action: {
          allowedChannels: ["sms"],
          preferredChannel: "sms",
          cooldownMinutes: 240,
        },
      },
      {
        id: "bh-rule-2",
        name: "After Hours — Voice Coverage",
        enabled: true,
        conditions: {
          timeWindow: {
            startTime: "17:00",
            endTime: "09:00",
            days: [0, 1, 2, 3, 4, 5, 6],
            timezone: "America/New_York",
          },
        },
        action: {
          allowedChannels: ["voice"],
          preferredChannel: "voice",
          cooldownMinutes: 60,
        },
      },
      {
        id: "bh-rule-3",
        name: "Weekend — SMS Only",
        enabled: true,
        conditions: {
          timeWindow: {
            startTime: "10:00",
            endTime: "16:00",
            days: [0, 6],
            timezone: "America/New_York",
          },
        },
        action: {
          allowedChannels: ["sms"],
          preferredChannel: "sms",
          cooldownMinutes: 480,
        },
      },
    ],
  },
  {
    id: "appointment-recovery",
    name: "Missed Appointment Recovery",
    description:
      "Automated recovery sequence for no-shows. Voice call immediately, SMS follow-up if no answer. Recovers lost revenue.",
    tags: ["appointment", "recovery", "no-show"],
    fallbackAction: {
      allowedChannels: ["sms", "voice"],
      preferredChannel: "voice",
    },
    rules: [
      {
        id: "ar-rule-1",
        name: "No-Show — Immediate Voice Call",
        enabled: true,
        conditions: {
          conversationStatuses: ["scheduled"],
          channelHistory: {
            voiceAttempts: { operator: "eq", value: 0 },
          },
        },
        action: {
          allowedChannels: ["voice"],
          preferredChannel: "voice",
          cooldownMinutes: 30,
        },
      },
      {
        id: "ar-rule-2",
        name: "Voice Failed — SMS Rescue",
        enabled: true,
        conditions: {
          conversationStatuses: ["scheduled"],
          channelHistory: {
            voiceAttempts: { operator: "gte", value: 1 },
            lastVoiceOutcome: ["voicemail", "no_answer"],
          },
        },
        action: {
          allowedChannels: ["sms"],
          preferredChannel: "sms",
          cooldownMinutes: 120,
        },
      },
      {
        id: "ar-rule-3",
        name: "SMS Sent — Final Voice Attempt",
        enabled: true,
        conditions: {
          conversationStatuses: ["scheduled"],
          channelHistory: {
            smsAttempts: { operator: "gte", value: 1 },
            voiceAttempts: { operator: "lt", value: 3 },
            lastSmsAgeMinutes: { operator: "gte", value: 720 },
          },
        },
        action: {
          allowedChannels: ["voice"],
          preferredChannel: "voice",
          cooldownMinutes: 1440,
        },
      },
    ],
  },
  {
    id: "multi-channel-blitz",
    name: "Multi-Channel Blitz",
    description:
      "Aggressive multi-channel engagement. Both SMS and voice enabled on all rules with short cooldowns. For time-sensitive campaigns.",
    tags: ["multi-channel", "aggressive", "campaign"],
    fallbackAction: {
      allowedChannels: ["sms", "voice"],
      preferredChannel: "sms",
    },
    rules: [
      {
        id: "mc-rule-1",
        name: "First Touch — SMS + Voice Available",
        enabled: true,
        conditions: {
          channelHistory: {
            smsAttempts: { operator: "eq", value: 0 },
            voiceAttempts: { operator: "eq", value: 0 },
          },
        },
        action: {
          allowedChannels: ["sms", "voice"],
          preferredChannel: "sms",
          cooldownMinutes: 60,
          escalateAfter: {
            channel: "sms",
            attempts: 1,
            escalateTo: "voice",
          },
        },
      },
      {
        id: "mc-rule-2",
        name: "Contacted — Alternate Channels",
        enabled: true,
        conditions: {
          channelHistory: {
            smsAttempts: { operator: "gte", value: 1 },
          },
        },
        action: {
          allowedChannels: ["sms", "voice"],
          preferredChannel: "voice",
          cooldownMinutes: 120,
        },
      },
      {
        id: "mc-rule-3",
        name: "Stale Conversation — Re-engage",
        enabled: true,
        conditions: {
          conversationStatuses: ["stale"],
        },
        action: {
          allowedChannels: ["sms", "voice"],
          preferredChannel: "sms",
          cooldownMinutes: 1440,
          escalateAfter: {
            channel: "sms",
            attempts: 2,
            escalateTo: "voice",
          },
        },
      },
    ],
  },
  {
    id: "conservative-sms-only",
    name: "Conservative SMS Only",
    description:
      "SMS-only engagement with generous cooldowns. No voice calls. Best for compliance-sensitive markets or early-stage testing.",
    tags: ["sms-only", "conservative", "compliance"],
    fallbackAction: {
      allowedChannels: ["sms"],
      preferredChannel: "sms",
    },
    rules: [
      {
        id: "cs-rule-1",
        name: "New Lead — Single SMS",
        enabled: true,
        conditions: {
          channelHistory: {
            smsAttempts: { operator: "eq", value: 0 },
          },
        },
        action: {
          allowedChannels: ["sms"],
          preferredChannel: "sms",
          cooldownMinutes: 1440,
        },
      },
      {
        id: "cs-rule-2",
        name: "Follow-Up — After 48h",
        enabled: true,
        conditions: {
          channelHistory: {
            smsAttempts: { operator: "gte", value: 1 },
            lastSmsAgeMinutes: { operator: "gte", value: 2880 },
          },
        },
        action: {
          allowedChannels: ["sms"],
          preferredChannel: "sms",
          cooldownMinutes: 4320,
        },
      },
    ],
  },
];

// ─── Exports ─────────────────────────────────────────────────────────────────

/** Summary list for the template selector dialog */
export function getStarterTemplates(): OrchestrationTemplate[] {
  return STARTER_ORCHESTRATION_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    ruleCount: t.rules.length,
    tags: t.tags,
  }));
}

/** Full preview with rules for a specific template */
export function getStarterTemplatePreview(
  key: string,
): OrchestrationTemplatePreview | null {
  return STARTER_ORCHESTRATION_TEMPLATES.find((t) => t.id === key) ?? null;
}
