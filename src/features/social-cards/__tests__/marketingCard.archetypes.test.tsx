// Render-smoke + content tests for the carousel-builder marketing slide archetypes.
// jsdom can't validate the PNG-export layout (that's the Playwright export harness —
// scripts/social-studio-export-render), but it cheaply guards against a crashing branch,
// a dropped field, or a regressed legacy variant.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingCard, type MarketingVariant } from "../MarketingCard";

const base = { agencyName: "THE STANDARD", network: "EPIC LIFE" as const };

describe("MarketingCard archetypes", () => {
  it("renders the hook cover (eyebrow + headline + subheadline)", () => {
    render(
      <MarketingCard
        {...base}
        variant="hook"
        eyebrow="For ambitious agents"
        headline="Stop trading nights for income"
        subheadline="There's a better way."
      />,
    );
    // The hook highlights the last word in its own span, so the headline text is split
    // across elements; assert the parts that render whole + the highlighted last word.
    expect(
      screen.getByText(
        (_t, el) => el?.textContent === "Stop trading nights for income",
      ),
    ).toBeTruthy();
    expect(screen.getByText("income")).toBeTruthy();
    expect(screen.getByText("For ambitious agents")).toBeTruthy();
    expect(screen.getByText("There's a better way.")).toBeTruthy();
  });

  it("renders a numbered list with rank numerals + item labels", () => {
    render(
      <MarketingCard
        {...base}
        variant="list"
        headline="5 ways to win"
        items={[
          { label: "Audit your leads", detail: "Know what converts" },
          { label: "Call in five minutes" },
        ]}
      />,
    );
    expect(screen.getByText("Audit your leads")).toBeTruthy();
    expect(screen.getByText("Know what converts")).toBeTruthy();
    expect(screen.getByText("Call in five minutes")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy(); // rank numeral
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("renders a checklist of bullets", () => {
    render(
      <MarketingCard
        {...base}
        variant="checklist"
        headline="What you get"
        bullets={["Fresh inbound leads", "No cold calling"]}
      />,
    );
    expect(screen.getByText("Fresh inbound leads")).toBeTruthy();
    expect(screen.getByText("No cold calling")).toBeTruthy();
  });

  it("renders the big-stat archetype (value + label + context)", () => {
    render(
      <MarketingCard
        {...base}
        variant="stat"
        stat="$1.2M"
        statLabel="In new annual premium"
        body="Written this month."
      />,
    );
    expect(screen.getByText("$1.2M")).toBeTruthy();
    expect(screen.getByText("In new annual premium")).toBeTruthy();
    expect(screen.getByText("Written this month.")).toBeTruthy();
  });

  it("renders a two-column compare with both column titles + items", () => {
    render(
      <MarketingCard
        {...base}
        variant="compare"
        headline="Them vs us"
        compare={{
          left: { title: "Most agencies", items: ["Cold calls", "Capped pay"] },
          right: { title: "Us", items: ["100% inbound", "Uncapped"] },
        }}
      />,
    );
    expect(screen.getByText("Most agencies")).toBeTruthy();
    expect(screen.getByText("Us")).toBeTruthy();
    expect(screen.getByText("Cold calls")).toBeTruthy();
    expect(screen.getByText("100% inbound")).toBeTruthy();
  });

  it("renders the closing CTA with a custom action chip", () => {
    render(
      <MarketingCard
        {...base}
        variant="cta"
        headline="Join our team"
        body="We're growing."
        ctaAction="Comment APPLY"
      />,
    );
    expect(screen.getByText("Comment APPLY")).toBeTruthy();
  });

  it("still renders the legacy variants (quote / tip / custom)", () => {
    const legacy: MarketingVariant[] = ["quote", "tip", "custom"];
    for (const variant of legacy) {
      const { unmount } = render(
        <MarketingCard
          {...base}
          variant={variant}
          text="A strong line"
          headline="A headline"
          body="Some body copy"
        />,
      );
      // brand tag (network) always present → component mounted without throwing
      expect(screen.getAllByText("EPIC LIFE").length).toBeGreaterThan(0);
      unmount();
    }
  });
});
