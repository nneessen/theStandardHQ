// src/features/recruiting/layouts/blocks/__tests__/BlockRenderer.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BlockRenderer } from "../BlockRenderer";
import type { BlockRenderContext } from "../types";
import type { DesignBlock } from "@/types/recruiting-design-spec.types";

const ctx: BlockRenderContext = {
  recruiterId: "acme",
  palette: { primary: "#112233", accent: "#445566" },
  displayName: "Acme",
  recruiterFullName: "Jane Doe",
  logoUrl: null,
  headshotUrl: null,
  calendlyUrl: null,
  supportPhone: null,
  socialLinks: {},
  ctaText: "Apply",
  onOpenForm: vi.fn(),
  onBookCall: vi.fn(),
  onFormSuccess: vi.fn(),
};

describe("BlockRenderer", () => {
  it("renders nothing for an unknown block type", () => {
    const { container } = render(
      <BlockRenderer
        block={{ id: "x", type: "carousel" } as unknown as DesignBlock}
        ctx={ctx}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a markup-looking headline as escaped text, never as an element", () => {
    const { container } = render(
      <BlockRenderer
        block={{
          id: "h",
          type: "hero",
          variant: "split",
          headline: "<img src=x onerror=alert(1)>",
        }}
        ctx={ctx}
      />,
    );
    // React escaped it: no <img> element was created from the AI string.
    expect(container.querySelector("img")).toBeNull();
    // The literal text is present in the DOM.
    expect(screen.getByText(/img src=x onerror/)).toBeInTheDocument();
  });

  it("renders stat values + labels", () => {
    render(
      <BlockRenderer
        block={{
          id: "s",
          type: "stats",
          style: "lattice",
          items: [{ icon: "rocket", value: "30+", label: "Carriers" }],
        }}
        ctx={ctx}
      />,
    );
    expect(screen.getByText("30+")).toBeInTheDocument();
    expect(screen.getByText("Carriers")).toBeInTheDocument();
  });
});
