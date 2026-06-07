// src/features/recruiting/layouts/__tests__/AiComposedLayout.test.tsx
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, describe, it, expect, vi } from "vitest";
import { AiComposedLayout } from "../AiComposedLayout";

// Radix Select (inside LeadInterestForm) sets up a ResizeObserver on mount,
// which jsdom doesn't provide. Stub it so the form mounts.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});
import { validateDesignSpec } from "@/lib/recruiting-design-spec";
import { DEFAULT_THEME } from "@/types/recruiting-theme.types";
import type { PublicRecruiterInfo } from "@/types/leads.types";

const TCPA_SNIPPET = /prior express written consent/i;

function renderLayout(specInput: unknown) {
  const { spec } = validateDesignSpec(specInput);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AiComposedLayout
        spec={spec}
        theme={{ ...DEFAULT_THEME, display_name: "Acme Agency" }}
        recruiterInfo={{ is_active: true } as PublicRecruiterInfo}
        recruiterId="acme"
        onFormSuccess={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("AiComposedLayout", () => {
  it("renders exactly ONE lead form (with TCPA consent) when the spec has two form blocks", () => {
    renderLayout({
      theme: { palette: { primary: "#112233", accent: "#445566" } },
      blocks: [
        { id: "h", type: "hero", variant: "split", headline: "Join Acme" },
        { id: "f1", type: "form", heading: "First" },
        { id: "f2", type: "form", heading: "Second" },
      ],
    });
    expect(screen.getAllByText(TCPA_SNIPPET)).toHaveLength(1);
    expect(screen.getByText(/Join Acme/)).toBeInTheDocument();
  });

  it("injects and renders the lead form when the spec has NO form block", () => {
    renderLayout({
      theme: { palette: { primary: "#0ea5e9", accent: "#22c55e" } },
      blocks: [{ id: "h", type: "hero", variant: "stacked", headline: "Hi" }],
    });
    expect(screen.getAllByText(TCPA_SNIPPET)).toHaveLength(1);
  });

  it("renders content blocks (value grid) alongside the form", () => {
    renderLayout({
      theme: { palette: { primary: "#112233", accent: "#445566" } },
      blocks: [
        { id: "h", type: "hero", variant: "split", headline: "Build" },
        {
          id: "v",
          type: "value_grid",
          heading: "Why us",
          items: [{ icon: "rocket", title: "Fast growth" }],
        },
        { id: "f", type: "form" },
      ],
    });
    expect(screen.getByText("Fast growth")).toBeInTheDocument();
    expect(screen.getAllByText(TCPA_SNIPPET)).toHaveLength(1);
  });
});

describe("XSS guard: no raw HTML injection sink in the renderer", () => {
  it("no block component or layout uses dangerouslySetInnerHTML", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const layoutsDir = join(here, "..");
    const blocksDir = join(layoutsDir, "blocks");
    const files = [
      join(layoutsDir, "AiComposedLayout.tsx"),
      ...readdirSync(blocksDir)
        .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
        .map((f) => join(blocksDir, f)),
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must not use dangerouslySetInnerHTML`).not.toContain(
        "dangerouslySetInnerHTML",
      );
    }
  });
});
