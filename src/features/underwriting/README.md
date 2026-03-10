# Underwriting Feature Layout

This feature is organized by capability so it is easier to place new code in the right slice.

- `components/Wizard`: end-user wizard flow and step UI.
- `components/Settings`: admin/settings entrypoint for underwriting operations.
- `components/*`: remaining admin/detail surfaces grouped by capability (`AcceptanceRules`, `CoverageBuilder`, `CriteriaReview`, `GuideManager`, `QuickQuote`, `RateEntry`, `RuleEngine`, `SessionHistory`).
- `hooks/wizard`: wizard-only orchestration hooks.
- `hooks/sessions`: session history, save, and reload hooks.
- `hooks/rules`: acceptance/rule engine/rule workflow hooks.
- `hooks/rates`: premium matrix and rate-entry hooks.
- `hooks/coverage`: product/carrier coverage and audit hooks.
- `hooks/criteria`: extracted underwriting criteria hooks.
- `hooks/guides`: guide upload/parse hooks.
- `hooks/shared`: shared feature queries used across multiple capabilities.
- `utils/wizard`: wizard request-building and follow-up validation helpers.
- `utils/sessions`: session serialization/parsing helpers.
- `utils/rates`: build-table parsing and lookup helpers.
- `utils/criteria`, `utils/rules`, `utils/coverage`, `utils/shared`: capability-specific helper modules.
- `types`: shared feature DTOs and type contracts.

Conventions:

- Components should import feature hooks from [hooks/index.ts](/Users/nickneessen/projects/commissionTracker/src/features/underwriting/hooks/index.ts) when a public hook is already exported there.
- Cross-capability helpers should live in the smallest capability folder that owns them, not in a flat `utils/` bucket.
- New wizard code should not be added to settings/admin folders, and admin management code should not be added to `components/Wizard`.
