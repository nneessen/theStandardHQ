// src/features/recruiting/templates/index.ts
//
// The recruiting-page TEMPLATE GALLERY. Each template is a hand-authored, distinct,
// professional starting point (a complete RecruitingDesignSpec) the agent picks,
// then customizes (copy, headshot, calendar, colors) and optionally refines with AI.
// RECRUITING_TEMPLATES is the ordered list shown in the gallery.

import type { RecruitingTemplate } from "./types";
import { splitFormTemplate } from "./split-form";
import { splitHeroStackTemplate } from "./split-hero-stack";
import { coverHeroTemplate } from "./cover-hero";
import { identitySidebarTemplate } from "./identity-sidebar";
import { editorialBandsTemplate } from "./editorial-bands";
import { stackedCardTemplate } from "./stacked-card";
import { centeredFunnelTemplate } from "./centered-funnel";
import { posterImpactTemplate } from "./poster-impact";

export type { RecruitingTemplate } from "./types";

/** Ordered for the gallery (versatile → bold). */
export const RECRUITING_TEMPLATES: RecruitingTemplate[] = [
  splitFormTemplate,
  splitHeroStackTemplate,
  coverHeroTemplate,
  identitySidebarTemplate,
  editorialBandsTemplate,
  stackedCardTemplate,
  centeredFunnelTemplate,
  posterImpactTemplate,
];

export function getTemplateById(id: string): RecruitingTemplate | undefined {
  return RECRUITING_TEMPLATES.find((t) => t.id === id);
}
