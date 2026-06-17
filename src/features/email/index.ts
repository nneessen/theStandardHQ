// src/features/email/index.ts
// Email Feature Exports
// NOTE: Gmail OAuth has been removed. All email sending now uses Resend via emailService.

// Components (kept for email composition UI)
export { EmailComposer } from "./components/EmailComposer";
export { TipTapEditor } from "./components/TipTapEditor";
export { TipTapMenuBar } from "./components/TipTapMenuBar";

// Block Builder (visual email template builder)
export {
  EmailBlockBuilder,
  blocksToHtml,
  BlockPalette,
  BlockCanvas,
  BlockStylePanel,
  BlockPreview,
  VariableDropdown,
} from "./components/block-builder";

// Sanitization Services
export {
  sanitizeHtml,
  sanitizeForEmail,
  stripHtml,
  containsDangerousContent,
} from "./services/sanitizationService";

// HTML to Text conversion
export {
  convertHtmlToText,
  generatePreviewText,
  countWords,
  estimateReadingTime,
} from "./services/htmlToTextService";

// Template CRUD
export {
  getEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  duplicateEmailTemplate,
  toggleTemplateActive,
  getUserTemplateStatus,
  getGroupedEmailTemplates,
} from "./services/emailTemplateService";

// Template Hooks
export {
  useEmailTemplates,
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  useDuplicateEmailTemplate,
  useToggleTemplateActive,
  useUserTemplateStatus,
  useGroupedEmailTemplates,
  useGenerateAiEmailTemplateDraft,
} from "./hooks/useEmailTemplates";
export type { AiEmailDraft } from "./services/emailTemplateService";

// The ONE shared email-template editor — reused by every surface that builds a
// template (Workflows / Training Hub email-templates tab, Marketing templates).
export { EmailTemplateEditor } from "./components/template-editor/EmailTemplateEditor";

// Template Picker
export { TemplatePicker } from "./components/TemplatePicker";

// Constants
export {
  EMAIL_TEMPLATE_CATEGORIES,
  TEMPLATE_PREVIEW_VARIABLES,
} from "./constants";
