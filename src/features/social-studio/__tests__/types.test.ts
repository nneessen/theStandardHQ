// toTemplateConfig must strip ALL per-post content so applying a saved STYLE
// template never clobbers the working post (photo / background image / caption).

import { describe, it, expect } from "vitest";
import {
  toTemplateConfig,
  DEFAULT_CONFIG,
  type SocialStudioConfig,
} from "../types";

describe("toTemplateConfig", () => {
  it("strips every per-post field (photo, storage url, bg image, caption)", () => {
    const full: SocialStudioConfig = {
      ...DEFAULT_CONFIG,
      caption: "my working caption",
      aowPhotoUrl: "data:image/png;base64,AAA",
      aowPhotoStorageUrl: "https://cdn/p?v=1",
      aowBgImageUrl: "data:image/png;base64,BBB",
      aowBackground: "#111317",
      aowFontDisplay: '"Syne", system-ui, sans-serif',
      aowTitleScale: 1.2,
    };
    const tpl = toTemplateConfig(full);

    expect(tpl).not.toHaveProperty("caption");
    expect(tpl).not.toHaveProperty("aowPhotoUrl");
    expect(tpl).not.toHaveProperty("aowPhotoStorageUrl");
    expect(tpl).not.toHaveProperty("aowPhotoPosition");
    expect(tpl).not.toHaveProperty("aowBgImageUrl");
  });

  it("keeps the reusable STYLE fields", () => {
    const tpl = toTemplateConfig({
      ...DEFAULT_CONFIG,
      aowBackground: "#111317",
      aowFontDisplay: '"Syne", system-ui, sans-serif',
      aowTitleScale: 1.2,
      aowAgencyScale: 1.5,
      caption: "should be dropped",
    });
    expect(tpl.aowBackground).toBe("#111317");
    expect(tpl.aowFontDisplay).toBe('"Syne", system-ui, sans-serif');
    expect(tpl.aowTitleScale).toBe(1.2);
    expect(tpl.aowAgencyScale).toBe(1.5);
    expect(tpl.view).toBe(DEFAULT_CONFIG.view);
    expect(tpl.cardTheme).toBe(DEFAULT_CONFIG.cardTheme);
  });
});
