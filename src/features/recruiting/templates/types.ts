// src/features/recruiting/templates/types.ts
//
// A recruiting page TEMPLATE = a hand-authored, professional starting point an
// agent picks from the gallery. It is just a complete RecruitingDesignSpec
// (layout + theme + blocks) with placeholder copy the agent then edits. Picking a
// template sets the agent's design_spec; it is always re-run through
// validateDesignSpec before render, so a template can never bypass the security
// boundary. The recruiter's real identity (name, headshot, calendar, socials)
// comes from their theme/settings — never baked into the template spec.

import type { RecruitingDesignSpec } from "@/types/recruiting-design-spec.types";

export interface RecruitingTemplate {
  /** Stable id; conventionally matches the spec's layout (e.g. "cover-hero"). */
  id: string;
  /** Gallery display name, e.g. "Cover Story". */
  name: string;
  /** One-line description shown on the gallery card. */
  blurb: string;
  /** The starting design. MUST pass validateDesignSpec unchanged (one form). */
  spec: RecruitingDesignSpec;
}
