import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptPanel } from "../TranscriptPanel";
import type { TranscriptMessage } from "../../types/assistant.types";

describe("TranscriptPanel", () => {
  it("shows the empty state with no messages", () => {
    render(<TranscriptPanel messages={[]} assistantName="Jarvis" />);
    expect(screen.getByText(/command center is ready/i)).toBeTruthy();
  });

  it("renders user and assistant content verbatim with tool chips", () => {
    const messages: TranscriptMessage[] = [
      { id: "1", role: "user", content: "How is my team doing?" },
      {
        id: "2",
        role: "assistant",
        content: "I don't have team data connected yet.",
        toolActivity: [{ name: "getDailyBriefingData", status: "success" }],
      },
    ];
    render(<TranscriptPanel messages={messages} assistantName="Jarvis" />);
    expect(screen.getByText("How is my team doing?")).toBeTruthy();
    expect(
      screen.getByText("I don't have team data connected yet."),
    ).toBeTruthy();
    expect(screen.getByText("getDailyBriefingData")).toBeTruthy();
  });

  it("shows a thinking indicator for a pending assistant turn", () => {
    render(
      <TranscriptPanel
        messages={[{ id: "1", role: "assistant", content: "", pending: true }]}
        assistantName="Jarvis"
      />,
    );
    expect(screen.getByText(/thinking/i)).toBeTruthy();
  });
});
