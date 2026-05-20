// src/features/recruiting/utils/template-filters.ts
// Per product decision: users only ever pick from the two DEFAULT-named
// templates (one for licensed agents, one for non-licensed recruits).
// All other org templates (Standard Licensed/Non-Licensed Pipeline, internal
// TEST pipelines, etc.) remain in the DB so legacy enrollments keep working —
// they just don't appear in the user-facing pipeline picker.

export interface MinimalTemplate {
  id: string;
  name: string;
  is_default?: boolean;
  is_active?: boolean | null;
}

/**
 * True for the two pipelines a user is allowed to choose from when
 * enrolling a new recruit. Identified by the `DEFAULT` prefix in `name`
 * (e.g. "DEFAULT Non-Licensed Recruit Pipeline",
 *       "DEFAULT Licensed Agent Pipeline").
 */
export function isUserSelectableTemplate(t: MinimalTemplate): boolean {
  return t.name.trim().toLowerCase().startsWith("default");
}

export interface FilterTemplatesOptions {
  /**
   * Super-admin escape hatch. When true, returns every template the caller
   * passed in (still respecting any caller-side active/archive filters),
   * bypassing the DEFAULT-name gate. Everyone else only sees DEFAULT pipelines.
   */
  includeAll?: boolean;
}

export function filterUserSelectableTemplates<T extends MinimalTemplate>(
  templates: T[] | undefined,
  options: FilterTemplatesOptions = {},
): T[] {
  if (!templates) return [];
  if (options.includeAll) return templates;
  return templates.filter(isUserSelectableTemplate);
}

export function selectDefaultRecruitTemplate<T extends MinimalTemplate>(
  templates: T[] | undefined,
  isLicensed: boolean,
): T | undefined {
  if (!templates || templates.length === 0) return undefined;

  const licensedTemplate = templates.find((t) =>
    t.name.toLowerCase().includes("licensed agent"),
  );
  const nonLicensedTemplate = templates.find((t) =>
    t.name.toLowerCase().includes("non-licensed"),
  );
  const preferred = isLicensed ? licensedTemplate : nonLicensedTemplate;
  const flagged = templates.find((t) => t.is_default);

  return preferred ?? flagged ?? templates[0];
}
