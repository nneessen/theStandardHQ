// src/features/recruiting/components/wizard/__tests__/DesignStep.test.tsx
//
// Functional coverage for the template-first Design step (the wizard UI is behind
// auth, so this exercises the flow in jsdom): the gallery lists every template,
// adopting one sets the design + enters the editor, and editing a field flows
// through the single write funnel back into form.design_spec (tolerant editing).

import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeAll, describe, it, expect } from "vitest";
import { DesignStep } from "../DesignStep";
import { RECRUITING_TEMPLATES } from "../../../templates";
import {
  DEFAULT_THEME,
  type RecruitingPageSettingsInput,
} from "@/types/recruiting-theme.types";

// Radix (inside ColorPicker) + some UI set up ResizeObserver, absent in jsdom.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
});

// A stateful host that mimics the wizard: updateField mutates the form so the
// DesignStep re-renders with the new design_spec (mode flips gallery → editor).
function Host() {
  const [form, setForm] = useState<RecruitingPageSettingsInput>({
    primary_color: DEFAULT_THEME.primary_color,
    accent_color: DEFAULT_THEME.accent_color,
    logo_light_url: null,
    logo_dark_url: null,
    hero_image_url: null,
    headshot_url: null,
    social_links: {},
    design_spec: null,
    design_prompt: "",
  });
  return (
    <DesignStep
      form={form}
      updateField={(f, v) => setForm((prev) => ({ ...prev, [f]: v }))}
      onUpload={() => {}}
      onDeleteImage={() => {}}
      uploadingType={null}
    />
  );
}

describe("DesignStep — template gallery → editor", () => {
  it("lists every template in the gallery", () => {
    render(<Host />);
    expect(screen.getByText("Pick a starting design")).toBeInTheDocument();
    for (const t of RECRUITING_TEMPLATES) {
      expect(screen.getByText(t.name)).toBeInTheDocument();
    }
  });

  it("adopting a template enters the editor seeded with its copy", () => {
    render(<Host />);
    // The first template is selected by default → "Use this design" is present.
    fireEvent.click(screen.getByRole("button", { name: /use this design/i }));

    // Editor mode.
    expect(screen.getByText("Make it yours")).toBeInTheDocument();

    // The hero headline input is seeded from the adopted template's spec.
    const first = RECRUITING_TEMPLATES[0];
    const hero = first.spec.blocks.find((b) => b.type === "hero") as {
      headline: string;
    };
    expect(screen.getByDisplayValue(hero.headline)).toBeInTheDocument();
  });

  it("editing a headline flows through to the working design (tolerant)", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: /use this design/i }));

    const first = RECRUITING_TEMPLATES[0];
    const hero = first.spec.blocks.find((b) => b.type === "hero") as {
      headline: string;
    };
    const input = screen.getByDisplayValue(hero.headline);
    fireEvent.change(input, { target: { value: "Grow With Our Agency" } });

    // The edited value is reflected (input kept its identity — no remount/wipe).
    expect(
      screen.getByDisplayValue("Grow With Our Agency"),
    ).toBeInTheDocument();
  });

  it("can switch to the advanced blank-prompt AI path", () => {
    render(<Host />);
    fireEvent.click(
      screen.getByText(/describe your own page and let AI build it/i),
    );
    expect(
      screen.getByRole("button", { name: /build my page/i }),
    ).toBeInTheDocument();
  });
});
