// src/lib/sanitizeHtml.ts
// Shared HTML sanitization helper — thin wrapper around the email sanitization
// service so all dangerouslySetInnerHTML call-sites use one consistent config.
// Allows standard email-formatting tags (p, strong, a, table, img, span, div,
// style attr, etc.) while stripping scripts and all event-handler attributes.
//
// Deep-imports the leaf service on purpose: the @/features/email barrel
// re-exports TemplatePicker, which imports THIS shim, so importing the barrel
// here would form a circular dependency. Pulling the service directly breaks it.
// eslint-disable-next-line no-restricted-imports -- justified: avoids the cycle described above
export { sanitizeHtml } from "@/features/email/services/sanitizationService";
