// File: /home/nneessen/projects/commissionTracker/src/lib/workflow-recipient-helpers.ts

import type { RecipientType } from "@/types/workflow-recipients.types";

/**
 * Maps event types to recommended recipient types
 * This ensures that when an event trigger is selected,
 * the recipient options are contextually relevant
 */
export const EVENT_RECIPIENT_MAPPING: Record<
  string,
  {
    recommended: RecipientType[];
    description: string;
  }
> = {
  // Recruit events
  "recruit.created": {
    recommended: [
      "eventuser",
      "pipeline_recruiter",
      "pipeline_upline",
      "all_trainers",
      "admins",
    ],
    description: "New recruit added to the system",
  },
  "recruit.phase_changed": {
    recommended: [
      "eventuser",
      "pipeline_recruiter",
      "pipeline_upline",
      "all_trainers",
    ],
    description: "Recruit moved to a new phase",
  },
  "recruit.graduated_to_agent": {
    recommended: [
      "eventuser",
      "pipeline_recruiter",
      "direct_upline",
      "all_managers",
      "admins",
    ],
    description: "Recruit graduated to agent status",
  },
  "recruit.dropped_out": {
    recommended: [
      "pipeline_recruiter",
      "pipeline_upline",
      "all_managers",
      "admins",
    ],
    description: "Recruit dropped out of pipeline",
  },

  // Policy events
  "policy.created": {
    recommended: [
      "policy_agent",
      "policy_client",
      "direct_upline",
      "commission_recipient",
    ],
    description: "New policy created",
  },
  "policy.approved": {
    recommended: ["policy_agent", "policy_client", "direct_upline", "admins"],
    description: "Policy approved",
  },
  "policy.cancelled": {
    recommended: ["policy_agent", "direct_upline", "admins"],
    description: "Policy cancelled",
  },
  "policy.renewed": {
    recommended: ["policy_agent", "policy_client", "commission_recipient"],
    description: "Policy renewed",
  },

  // Commission events
  "commission.earned": {
    recommended: ["commission_recipient", "direct_upline"],
    description: "Commission earned",
  },
  "commission.paid": {
    recommended: ["commission_recipient", "direct_upline", "admins"],
    description: "Commission paid out",
  },
  "commission.chargeback": {
    recommended: ["commission_recipient", "direct_upline", "admins"],
    description: "Commission chargeback occurred",
  },

  // User events
  "user.login": {
    recommended: ["eventuser", "admins"],
    description: "User logged in",
  },
  "user.role_changed": {
    recommended: ["eventuser", "direct_upline", "admins"],
    description: "User role changed",
  },

  // Email events
  "email.sent": {
    recommended: ["admins"],
    description: "Email sent successfully",
  },
  "email.failed": {
    recommended: ["admins", "eventuser"],
    description: "Email sending failed",
  },
};

/**
 * Get recommended recipient types for an event
 */
export function getRecommendedRecipients(eventName?: string): RecipientType[] {
  if (!eventName) return [];

  const mapping = EVENT_RECIPIENT_MAPPING[eventName];
  if (!mapping) {
    // Default recommendations for unknown events
    return ["eventuser", "admins"];
  }

  return mapping.recommended;
}

/**
 * Check if a recipient type is recommended for an event
 */
export function isRecommendedRecipient(
  eventName?: string,
  recipientType?: RecipientType,
): boolean {
  if (!eventName || !recipientType) return false;

  const recommended = getRecommendedRecipients(eventName);
  return recommended.includes(recipientType);
}

/**
 * Get a description for what a recipient type means in the context of an event
 */
export function getRecipientContextDescription(
  eventName?: string,
  recipientType?: RecipientType,
): string | null {
  if (!eventName || !recipientType) return null;

  const eventContext = eventName.split(".")[0]; // Get the category (recruit, policy, etc.)

  const descriptions: Record<string, Partial<Record<RecipientType, string>>> = {
    recruit: {
      eventuser: "The recruit who was created/updated",
      pipeline_recruiter: "The recruiter responsible for this recruit",
      pipeline_upline: "The recruit's assigned upline/manager",
      all_trainers: "All trainers in the system",
      admins: "System administrators",
    },
    policy: {
      policy_agent: "The agent who sold this policy",
      policy_client: "The client who purchased the policy",
      direct_upline: "The agent's direct manager",
      commission_recipient: "Whoever receives commission from this policy",
      admins: "System administrators",
    },
    commission: {
      commission_recipient: "The person receiving the commission",
      direct_upline: "The commission recipient's manager",
      admins: "System administrators",
    },
    user: {
      eventuser: "The user who triggered this event",
      direct_upline: "The user's manager",
      admins: "System administrators",
    },
  };

  return descriptions[eventContext]?.[recipientType] || null;
}
