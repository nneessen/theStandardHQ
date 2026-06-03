// src/types/checklist-metadata.types.ts

import type { SchedulingChecklistMetadata } from "./integration.types";
import type {
  VideoEmbedMetadata,
  BooleanQuestionMetadata,
  AcknowledgmentMetadata,
  TextResponseMetadata,
  MultipleChoiceMetadata,
  FileDownloadMetadata,
  ExternalLinkMetadata,
  QuizMetadata,
  CarrierContractingMetadata,
} from "./recruiting.types";

// =============================================================================
// Discriminated Union Types
// =============================================================================

/**
 * Discriminated union for checklist item metadata
 * Uses _type field to enable type-safe narrowing
 */
export type ChecklistMetadata =
  | (SchedulingChecklistMetadata & { _type: "scheduling_booking" })
  | (VideoEmbedMetadata & { _type: "video_embed" })
  | (BooleanQuestionMetadata & { _type: "boolean_question" })
  | (AcknowledgmentMetadata & { _type: "acknowledgment" })
  | (TextResponseMetadata & { _type: "text_response" })
  | (MultipleChoiceMetadata & { _type: "multiple_choice" })
  | (FileDownloadMetadata & { _type: "file_download" })
  | (ExternalLinkMetadata & { _type: "external_link" })
  | (QuizMetadata & { _type: "quiz" })
  | (CarrierContractingMetadata & { _type: "carrier_contracting" })
  | null;

/**
 * Helper type to extract metadata type for a specific item type
 */
export type MetadataForType<T extends string> = Extract<
  NonNullable<ChecklistMetadata>,
  { _type: T }
>;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for scheduling metadata
 */
export function isSchedulingMetadata(
  metadata: ChecklistMetadata,
): metadata is SchedulingChecklistMetadata & { _type: "scheduling_booking" } {
  return (
    metadata !== null &&
    "_type" in metadata &&
    metadata._type === "scheduling_booking"
  );
}

/**
 * Type guard for video embed metadata
 */
export function isVideoMetadata(
  metadata: ChecklistMetadata,
): metadata is VideoEmbedMetadata & { _type: "video_embed" } {
  return (
    metadata !== null && "_type" in metadata && metadata._type === "video_embed"
  );
}

/**
 * Type guard for boolean question metadata
 */
export function isBooleanQuestionMetadata(
  metadata: ChecklistMetadata,
): metadata is BooleanQuestionMetadata & { _type: "boolean_question" } {
  return (
    metadata !== null &&
    "_type" in metadata &&
    metadata._type === "boolean_question"
  );
}

/**
 * Type guard for acknowledgment metadata
 */
export function isAcknowledgmentMetadata(
  metadata: ChecklistMetadata,
): metadata is AcknowledgmentMetadata & { _type: "acknowledgment" } {
  return (
    metadata !== null &&
    "_type" in metadata &&
    metadata._type === "acknowledgment"
  );
}

/**
 * Type guard for text response metadata
 */
export function isTextResponseMetadata(
  metadata: ChecklistMetadata,
): metadata is TextResponseMetadata & { _type: "text_response" } {
  return (
    metadata !== null &&
    "_type" in metadata &&
    metadata._type === "text_response"
  );
}

/**
 * Type guard for multiple choice metadata
 */
export function isMultipleChoiceMetadata(
  metadata: ChecklistMetadata,
): metadata is MultipleChoiceMetadata & { _type: "multiple_choice" } {
  return (
    metadata !== null &&
    "_type" in metadata &&
    metadata._type === "multiple_choice"
  );
}

/**
 * Type guard for file download metadata
 */
export function isFileDownloadMetadata(
  metadata: ChecklistMetadata,
): metadata is FileDownloadMetadata & { _type: "file_download" } {
  return (
    metadata !== null &&
    "_type" in metadata &&
    metadata._type === "file_download"
  );
}

/**
 * Type guard for external link metadata
 */
export function isExternalLinkMetadata(
  metadata: ChecklistMetadata,
): metadata is ExternalLinkMetadata & { _type: "external_link" } {
  return (
    metadata !== null &&
    "_type" in metadata &&
    metadata._type === "external_link"
  );
}

/**
 * Type guard for quiz metadata
 */
export function isQuizMetadata(
  metadata: ChecklistMetadata,
): metadata is QuizMetadata & { _type: "quiz" } {
  return metadata !== null && "_type" in metadata && metadata._type === "quiz";
}

/**
 * Type guard for carrier contracting metadata
 */
export function isCarrierContractingMetadata(
  metadata: ChecklistMetadata,
): metadata is CarrierContractingMetadata & { _type: "carrier_contracting" } {
  return (
    metadata !== null &&
    "_type" in metadata &&
    metadata._type === "carrier_contracting"
  );
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Factory function to create type-safe scheduling metadata
 */
export function createSchedulingMetadata(
  data: SchedulingChecklistMetadata,
): SchedulingChecklistMetadata & { _type: "scheduling_booking" } {
  return { ...data, _type: "scheduling_booking" };
}

/**
 * Factory function to create type-safe video embed metadata
 */
export function createVideoMetadata(
  data: VideoEmbedMetadata,
): VideoEmbedMetadata & { _type: "video_embed" } {
  return { ...data, _type: "video_embed" };
}

/**
 * Factory function to create type-safe boolean question metadata
 */
export function createBooleanQuestionMetadata(
  data: BooleanQuestionMetadata,
): BooleanQuestionMetadata & { _type: "boolean_question" } {
  return { ...data, _type: "boolean_question" };
}

/**
 * Factory function to create type-safe acknowledgment metadata
 */
export function createAcknowledgmentMetadata(
  data: AcknowledgmentMetadata,
): AcknowledgmentMetadata & { _type: "acknowledgment" } {
  return { ...data, _type: "acknowledgment" };
}

/**
 * Factory function to create type-safe text response metadata
 */
export function createTextResponseMetadata(
  data: TextResponseMetadata,
): TextResponseMetadata & { _type: "text_response" } {
  return { ...data, _type: "text_response" };
}

/**
 * Factory function to create type-safe multiple choice metadata
 */
export function createMultipleChoiceMetadata(
  data: MultipleChoiceMetadata,
): MultipleChoiceMetadata & { _type: "multiple_choice" } {
  return { ...data, _type: "multiple_choice" };
}

/**
 * Factory function to create type-safe file download metadata
 */
export function createFileDownloadMetadata(
  data: FileDownloadMetadata,
): FileDownloadMetadata & { _type: "file_download" } {
  return { ...data, _type: "file_download" };
}

/**
 * Factory function to create type-safe external link metadata
 */
export function createExternalLinkMetadata(
  data: ExternalLinkMetadata,
): ExternalLinkMetadata & { _type: "external_link" } {
  return { ...data, _type: "external_link" };
}

/**
 * Factory function to create type-safe quiz metadata
 */
export function createQuizMetadata(
  data: QuizMetadata,
): QuizMetadata & { _type: "quiz" } {
  return { ...data, _type: "quiz" };
}

/**
 * Factory function to create type-safe carrier contracting metadata
 */
export function createCarrierContractingMetadata(
  data: CarrierContractingMetadata,
): CarrierContractingMetadata & { _type: "carrier_contracting" } {
  return { ...data, _type: "carrier_contracting" };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the _type discriminator from metadata if it exists
 */
export function getMetadataType(metadata: ChecklistMetadata): string | null {
  if (metadata === null) return null;
  if ("_type" in metadata) return metadata._type;
  return null;
}

/**
 * Check if metadata has the required _type discriminator
 */
export function hasTypeDiscriminator(
  metadata: unknown,
): metadata is { _type: string } {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    "_type" in metadata &&
    typeof (metadata as { _type: unknown })._type === "string"
  );
}

/**
 * Map of item_type to type guard functions
 */
export const METADATA_TYPE_GUARDS: Record<
  string,
  (metadata: ChecklistMetadata) => boolean
> = {
  scheduling_booking: isSchedulingMetadata,
  video_embed: isVideoMetadata,
  boolean_question: isBooleanQuestionMetadata,
  acknowledgment: isAcknowledgmentMetadata,
  text_response: isTextResponseMetadata,
  multiple_choice: isMultipleChoiceMetadata,
  file_download: isFileDownloadMetadata,
  external_link: isExternalLinkMetadata,
  quiz: isQuizMetadata,
  carrier_contracting: isCarrierContractingMetadata,
};

/**
 * Validate that metadata matches the expected type for an item_type
 */
export function validateMetadataForType(
  itemType: string,
  metadata: ChecklistMetadata,
): boolean {
  const guard = METADATA_TYPE_GUARDS[itemType];
  if (!guard) return true; // No validation for types without metadata
  if (metadata === null) return false;
  return guard(metadata);
}
