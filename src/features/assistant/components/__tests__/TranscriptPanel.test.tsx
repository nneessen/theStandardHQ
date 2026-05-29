import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptPanel } from "../TranscriptPanel";
import type { TranscriptMessage } from "../../types/assistant.types";

// Force prefers-reduced-motion so the typewriter + chip reveals render instantly.
beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
});

describe("TranscriptPanel", () => {
  it("shows the empty state with no messages", () => {
    render(
      <TranscriptPanel messages={[]} assistantName="Jarvis" accent="#22d3ee" />,
    );
    expect(screen.getByText(/command center online/i)).toBeTruthy();
  });

  it("renders user and assistant content with labeled tool chips", () => {
    const messages: TranscriptMessage[] = [
      { id: "1", role: "user", content: "How is my team doing?" },
      {
        id: "2",
        role: "assistant",
        content: "I don't have team data connected yet.",
        toolActivity: [{ name: "getDailyBriefingData", status: "success" }],
      },
    ];
    render(
      <TranscriptPanel
        messages={messages}
        assistantName="Jarvis"
        accent="#22d3ee"
      />,
    );
    expect(screen.getByText("How is my team doing?")).toBeTruthy();
    expect(
      screen.getByText("I don't have team data connected yet."),
    ).toBeTruthy();
    expect(screen.getByText(/daily briefing/i)).toBeTruthy();
  });

  it("shows a scanning indicator for a pending assistant turn", () => {
    render(
      <TranscriptPanel
        messages={[{ id: "1", role: "assistant", content: "", pending: true }]}
        assistantName="Jarvis"
        accent="#22d3ee"
      />,
    );
    expect(screen.getByText(/scanning/i)).toBeTruthy();
  });
});
