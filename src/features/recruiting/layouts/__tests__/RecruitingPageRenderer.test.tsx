// src/features/recruiting/layouts/__tests__/RecruitingPageRenderer.test.tsx
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, describe, it, expect, vi } from "vitest";
import { RecruitingPageRenderer } from "../shells/registry";

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
import { LAYOUT_NAMES } from "@/types/recruiting-design-spec.types";
import { DEFAULT_THEME } from "@/types/recruiting-theme.types";
import type { PublicRecruiterInfo } from "@/types/leads.types";

// The lead form is multi-step (TCPA lives on the final step). The honeypot input
// is always rendered, regardless of step, so it's a stable "one form" marker.
const formCount = (c: HTMLElement) =>
  c.querySelectorAll('input[name="company_fax_ext"]').length;

function renderLayout(specInput: unknown) {
  const { spec } = validateDesignSpec(specInput);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RecruitingPageRenderer
        spec={spec}
        theme={{ ...DEFAULT_THEME, display_name: "Acme Agency" }}
        recruiterInfo={{ is_active: true } as PublicRecruiterInfo}
        recruiterId="acme"
        onFormSuccess={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("RecruitingPageRenderer (default split-form shell)", () => {
  it("renders exactly ONE lead form when the spec has two form blocks", () => {
    const { container } = renderLayout({
      theme: { palette: { primary: "#112233", accent: "#445566" } },
      blocks: [
        { id: "h", type: "hero", variant: "split", headline: "Join Acme" },
        { id: "f1", type: "form", heading: "First" },
        { id: "f2", type: "form", heading: "Second" },
      ],
    });
    expect(formCount(container)).toBe(1);
    expect(screen.getByText(/Join Acme/)).toBeInTheDocument();
    expect(screen.getByText(/About you/i)).toBeInTheDocument();
  });

  it("injects and renders the lead form when the spec has NO form block", () => {
    const { container } = renderLayout({
      theme: { palette: { primary: "#0ea5e9", accent: "#22c55e" } },
      blocks: [{ id: "h", type: "hero", variant: "stacked", headline: "Hi" }],
    });
    expect(formCount(container)).toBe(1);
  });

  it("renders content blocks (value grid) alongside the form", () => {
    const { container } = renderLayout({
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
    expect(formCount(container)).toBe(1);
  });

  it("advances the multi-step form when the first step is valid", async () => {
    renderLayout({
      theme: { palette: { primary: "#112233", accent: "#445566" } },
      blocks: [
        { id: "h", type: "hero", variant: "split", headline: "Join" },
        { id: "f", type: "form" },
      ],
    });
    expect(screen.getByText(/About you/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("John"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByPlaceholderText("Doe"), {
      target: { value: "Roe" },
    });
    fireEvent.change(screen.getByPlaceholderText("john.doe@example.com"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "(555) 123-4567" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(
      await screen.findByText(/Location & availability/i),
    ).toBeInTheDocument();
  });
});

// R4: regardless of which shell renders, EXACTLY ONE frozen lead form must mount
// (single-form guarantee + preview inertness ride on this). Every layout in the
// registry is exercised here.
describe("every shell mounts exactly one lead form", () => {
  for (const layout of LAYOUT_NAMES) {
    it(`${layout} renders exactly one form`, () => {
      const { container } = renderLayout({
        layout,
        theme: { palette: { primary: "#112233", accent: "#445566" } },
        blocks: [
          { type: "hero", variant: "split", headline: "Join" },
          {
            type: "value_grid",
            heading: "Why",
            items: [{ title: "Growth" }],
          },
          { type: "form" },
        ],
      });
      expect(formCount(container)).toBe(1);
    });
  }
});

describe("XSS guard: no raw HTML injection sink in the renderer", () => {
  it("no block component, shell, or scaffold uses dangerouslySetInnerHTML", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const layoutsDir = join(here, "..");
    const blocksDir = join(layoutsDir, "blocks");
    const shellsDir = join(layoutsDir, "shells");
    const collect = (dir: string) =>
      readdirSync(dir)
        .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
        .map((f) => join(dir, f));
    const files = [...collect(shellsDir), ...collect(blocksDir)];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must not use dangerouslySetInnerHTML`).not.toContain(
        "dangerouslySetInnerHTML",
      );
    }
  });
});
