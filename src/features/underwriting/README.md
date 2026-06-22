# Underwriting Feature Layout

This feature is organized by capability so it is easier to place new code in the right slice.

- `components/Wizard`: end-user wizard flow and step UI.
- `components/SessionHistory`: `WizardSessionHistory` (used by the wizard).
- `components/UnderwritingGuidesPage.tsx` (+ `components/guides-library/`): Training-section carrier guide library at `/underwriting/guides`, backed by the `underwriting_guides` table. A 3-pane master–detail document browser — carrier rail (folder icons + counts, color-coded; never monogram tiles) · paginated document list (category badge, carrier dot, size/date) · preview pane (carrier-banded cover + facts + Open/Download). Filter by carrier or category, free-text search, client-side pagination (9/18/30). Category / product / carrier-color are DERIVED client-side in `guides-library/guideAttributes.ts` (no schema columns) — that file is the seam to promote them to real columns later. PDFs open in a new tab via on-demand signed URLs. Everyone in the IMO views; admins (`is_imo_admin`) upload/delete.
- `admin/`: admin workflow at `/underwriting/admin` (carrier rail + guide upload/parse/extract/review on one page). Composes existing hooks via `useUnderwritingAdmin.ts`.
- `hooks/wizard`: wizard-only orchestration hooks.
- `hooks/sessions`: session history, save, and reload hooks.
- `hooks/rules`: rule sets, rules, and rule workflow hooks.
- `hooks/coverage`: per-carrier rule coverage stats (left-rail counts).
- `hooks/guides`: guide upload/parse hooks.
- `hooks/shared`: shared feature queries used across multiple capabilities.
- `utils/wizard`: wizard request-building and follow-up validation helpers.
- `utils/sessions`: session serialization/parsing helpers.
- `utils/rates`: build-table parsing and lookup helpers.
- `utils/shared`: cross-capability helper modules.
- `types`: shared feature DTOs and type contracts.

Conventions:

- Components should import feature hooks from [hooks/index.ts](./hooks/index.ts) when a public hook is already exported there. The admin page is allowed to import hooks directly via `admin/useUnderwritingAdmin.ts`.
- New wizard code should not be added to admin folders, and admin management code should not be added to `components/Wizard`.
