import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/closeKpiService", () => ({
  closeKpiService: {
    analyzeLeadDeepDive: vi.fn(),
  },
}));

vi.mock("../../../hooks/useCloseKpiDashboard", () => ({
  useLeadHeatRescore: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

import { closeKpiService } from "../../../services/closeKpiService";
import { LeadHeatListWidget } from "../LeadHeatListWidget";

describe("LeadHeatListWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the local Anthropic configuration error for failed deep dives", async () => {
    vi.mocked(closeKpiService.analyzeLeadDeepDive).mockRejectedValue(
      new Error("ANTHROPIC_API_KEY not configured"),
    );

    render(
      <LeadHeatListWidget
        data={{
          leads: [
            {
              closeLeadId: "lead-123",
              displayName: "Test Lead",
              score: 82,
              heatLevel: "hot",
              trend: "up",
              previousScore: 74,
              lastTouchAt: "2026-03-30T12:00:00.000Z",
              currentStatus: "Contacted",
              topSignal: "Inbound Calls",
              aiInsight: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
        }}
      />,
    );

    fireEvent.click(screen.getByText("Test Lead"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "AI lead analysis is unavailable locally until ANTHROPIC_API_KEY is set.",
        ),
      ).toBeInTheDocument();
    });
  });
});
