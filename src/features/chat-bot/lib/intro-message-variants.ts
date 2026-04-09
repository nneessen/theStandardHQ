// Types and client-side validation for per-agent intro SMS A/B test variants.
// Mirrors the backend Zod schema in standard-chat-bot `packages/shared/src/schemas/external-api.ts`.
//
// When at least one variant is active on an agent, the bot picks one (winner if
// locked, else random across actives) for every new lead's first SMS. When the
// list is empty, the bot falls back to a deterministic per-product template.

export interface IntroMessageVariant {
  id: string;
  label: string;
  template: string;
  active: boolean;
  isWinner: boolean;
}

export const INTRO_VARIANT_LIMITS = {
  LABEL_MAX: 100,
  TEMPLATE_MAX: 1000,
  ID_MAX: 16,
} as const;

export const INTRO_VARIANT_PLACEHOLDERS: ReadonlyArray<{
  key: string;
  description: string;
}> = [
  { key: "{firstName}", description: "Lead's first name" },
  { key: "{agentName}", description: "Your name" },
  { key: "{companyName}", description: "Your company name" },
  { key: "{productType}", description: "Product type from lead source" },
];

// "iv_" + 8 hex chars = 11 chars (under the backend's 16-char cap).
// Uses crypto.randomUUID() to match the existing project convention.
export function generateVariantId(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `iv_${uuid.slice(0, 8)}`;
}

export function createBlankVariant(): IntroMessageVariant {
  return {
    id: generateVariantId(),
    label: "",
    template: "",
    active: true,
    isWinner: false,
  };
}

export type VariantErrorField =
  | "label"
  | "template"
  | "id"
  | "isWinner"
  | "list";

export interface VariantValidationError {
  // `null` means the error applies to the list as a whole, not a specific row.
  variantId: string | null;
  field: VariantErrorField;
  message: string;
}

export function validateVariants(
  variants: ReadonlyArray<IntroMessageVariant>,
): VariantValidationError[] {
  const errors: VariantValidationError[] = [];

  // Per-variant field checks
  for (const variant of variants) {
    if (!variant.label.trim()) {
      errors.push({
        variantId: variant.id,
        field: "label",
        message: "Label is required",
      });
    } else if (variant.label.length > INTRO_VARIANT_LIMITS.LABEL_MAX) {
      errors.push({
        variantId: variant.id,
        field: "label",
        message: `Label must be ${INTRO_VARIANT_LIMITS.LABEL_MAX} characters or fewer`,
      });
    }

    if (!variant.template.trim()) {
      errors.push({
        variantId: variant.id,
        field: "template",
        message: "Template is required",
      });
    } else if (variant.template.length > INTRO_VARIANT_LIMITS.TEMPLATE_MAX) {
      errors.push({
        variantId: variant.id,
        field: "template",
        message: `Template must be ${INTRO_VARIANT_LIMITS.TEMPLATE_MAX} characters or fewer`,
      });
    }
  }

  // List-level: duplicate IDs (shouldn't happen with the generator, but guard anyway)
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const variant of variants) {
    if (seen.has(variant.id)) {
      duplicates.add(variant.id);
    }
    seen.add(variant.id);
  }
  for (const dupeId of duplicates) {
    errors.push({
      variantId: dupeId,
      field: "id",
      message: "Duplicate variant ID — regenerate this variant",
    });
  }

  // List-level: at most one winner, and the winner must be active.
  const winners = variants.filter((variant) => variant.isWinner);
  if (winners.length > 1) {
    for (const winner of winners) {
      errors.push({
        variantId: winner.id,
        field: "isWinner",
        message: "Only one variant can be marked as the winner",
      });
    }
  }
  for (const winner of winners) {
    if (!winner.active) {
      errors.push({
        variantId: winner.id,
        field: "isWinner",
        message: "A winning variant must also be active",
      });
    }
  }

  return errors;
}
