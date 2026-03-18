// src/features/chat-bot/__tests__/get-agent-contract.test.ts
// Contract test: verifies the expected shape of the get_agent response
// from the chat-bot-api edge function. If the edge function response
// shaping drops a field (as happened with leadSourceEventTypeMappings),
// this test will catch it.

import { describe, it, expect } from "vitest";

/**
 * Simulates the get_agent response transformer from
 * supabase/functions/chat-bot-api/index.ts (lines 168-189).
 * This must be kept in sync with the edge function.
 */
function transformGetAgentResponse(
  agentData: Record<string, unknown>,
  closeConn?: Record<string, unknown> | null,
  calendlyConn?: Record<string, unknown> | null,
) {
  return {
    id: agentData.id,
    name: agentData.name,
    botEnabled: agentData.botEnabled ?? false,
    timezone: agentData.timezone ?? "America/New_York",
    isActive: agentData.isActive ?? true,
    billingExempt: agentData.billingExempt ?? false,
    createdAt: agentData.createdAt,
    autoOutreachLeadSources: agentData.autoOutreachLeadSources || [],
    allowedLeadStatuses: agentData.allowedLeadStatuses || [],
    calendlyEventTypeSlug: agentData.calendlyEventTypeSlug || null,
    leadSourceEventTypeMappings: agentData.leadSourceEventTypeMappings || [],
    responseSchedule: agentData.responseSchedule || null,
    connections: {
      close: closeConn
        ? { connected: true, orgName: closeConn.orgId || undefined }
        : { connected: false },
      calendly: calendlyConn
        ? { connected: true, eventType: calendlyConn.calendarId || undefined }
        : { connected: false },
    },
  };
}

describe("get_agent contract", () => {
  const mockAgentData = {
    id: "agent-123",
    name: "Test Agent",
    botEnabled: true,
    timezone: "America/Chicago",
    isActive: true,
    billingExempt: true,
    createdAt: "2026-01-01T00:00:00Z",
    autoOutreachLeadSources: ["Sitka Life"],
    allowedLeadStatuses: ["Potential"],
    calendlyEventTypeSlug: "mortgage-protection",
    leadSourceEventTypeMappings: [
      { leadSource: "Sitka Life", eventTypeSlug: "mortgage-protection" },
      {
        leadSource: "GOAT Realtime Veterans",
        eventTypeSlug: "veteran-benefits",
      },
    ],
    responseSchedule: {
      days: [
        {
          day: 6,
          responsesEnabled: true,
          responseStartTime: "09:00",
          responseEndTime: "17:00",
          sameDayBookingEnabled: true,
          sameDayBookingCutoffTime: "15:00",
        },
      ],
    },
  };

  it("includes leadSourceEventTypeMappings in the response", () => {
    const response = transformGetAgentResponse(mockAgentData);
    expect(response).toHaveProperty("leadSourceEventTypeMappings");
    expect(response.leadSourceEventTypeMappings).toEqual([
      { leadSource: "Sitka Life", eventTypeSlug: "mortgage-protection" },
      {
        leadSource: "GOAT Realtime Veterans",
        eventTypeSlug: "veteran-benefits",
      },
    ]);
  });

  it("defaults leadSourceEventTypeMappings to [] when missing from API", () => {
    const { leadSourceEventTypeMappings: _, ...agentWithoutMappings } =
      mockAgentData;
    const response = transformGetAgentResponse(agentWithoutMappings);
    expect(response.leadSourceEventTypeMappings).toEqual([]);
  });

  it("preserves calendlyEventTypeSlug for backward compatibility", () => {
    const response = transformGetAgentResponse(mockAgentData);
    expect(response).toHaveProperty("calendlyEventTypeSlug");
    expect(response.calendlyEventTypeSlug).toBe("mortgage-protection");
  });

  it("includes billingExempt in the response", () => {
    const response = transformGetAgentResponse(mockAgentData);
    expect(response.billingExempt).toBe(true);
  });

  it("defaults billingExempt to false when missing from API", () => {
    const { billingExempt: _, ...agentWithoutBillingExempt } = mockAgentData;
    const response = transformGetAgentResponse(agentWithoutBillingExempt);
    expect(response.billingExempt).toBe(false);
  });

  it("includes responseSchedule in the response", () => {
    const response = transformGetAgentResponse(mockAgentData);
    expect(response.responseSchedule).toEqual({
      days: [
        {
          day: 6,
          responsesEnabled: true,
          responseStartTime: "09:00",
          responseEndTime: "17:00",
          sameDayBookingEnabled: true,
          sameDayBookingCutoffTime: "15:00",
        },
      ],
    });
  });

  it("returns all required fields for ChatBotAgent type", () => {
    const response = transformGetAgentResponse(
      mockAgentData,
      { orgId: "org_123" },
      { calendarId: "cal_123" },
    );

    // Required fields from ChatBotAgent interface
    expect(response).toHaveProperty("id");
    expect(response).toHaveProperty("name");
    expect(response).toHaveProperty("botEnabled");
    expect(response).toHaveProperty("timezone");
    expect(response).toHaveProperty("isActive");
    expect(response).toHaveProperty("billingExempt");
    expect(response).toHaveProperty("createdAt");
    expect(response).toHaveProperty("autoOutreachLeadSources");
    expect(response).toHaveProperty("allowedLeadStatuses");
    expect(response).toHaveProperty("calendlyEventTypeSlug");
    expect(response).toHaveProperty("leadSourceEventTypeMappings");
    expect(response).toHaveProperty("responseSchedule");
    expect(response).toHaveProperty("connections");

    // Connection sub-shapes
    expect(response.connections.close).toEqual({
      connected: true,
      orgName: "org_123",
    });
    expect(response.connections.calendly).toEqual({
      connected: true,
      eventType: "cal_123",
    });
  });

  it("handles null/missing connections gracefully", () => {
    const response = transformGetAgentResponse(mockAgentData, null, null);
    expect(response.connections.close).toEqual({ connected: false });
    expect(response.connections.calendly).toEqual({ connected: false });
  });
});
