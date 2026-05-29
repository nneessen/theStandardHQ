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

  it("renders assistant Markdown as HTML, not literal syntax", () => {
    const messages: TranscriptMessage[] = [
      {
        id: "1",
        role: "assistant",
        content: "**Needs attention**\n\n- Call John\n- Email Sue",
      },
    ];
    const { container } = render(
      <TranscriptPanel
        messages={messages}
        assistantName="Jarvis"
        accent="#22d3ee"
      />,
    );
    // Bold becomes <strong>, not literal asterisks (the reported bug).
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("Needs attention");
    // Bullets become a real list.
    const items = container.querySelectorAll("li");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe("Call John");
    // No raw Markdown syntax leaked into the rendered text.
    expect(container.textContent).not.toContain("**");
  });

  it("renders user messages as plain text (no Markdown processing)", () => {
    const { container } = render(
      <TranscriptPanel
        messages={[{ id: "1", role: "user", content: "Profit was **huge**" }]}
        assistantName="Jarvis"
        accent="#22d3ee"
      />,
    );
    // User text is shown verbatim — asterisks preserved, no <strong>.
    expect(container.querySelector("strong")).toBeNull();
    expect(screen.getByText("Profit was **huge**")).toBeTruthy();
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
