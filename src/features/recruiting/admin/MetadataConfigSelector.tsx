// src/features/recruiting/admin/MetadataConfigSelector.tsx

import type { ChecklistItemType } from "@/types/recruiting.types";
import type { SchedulingChecklistMetadata } from "@/types/integration.types";
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
} from "@/types/recruiting.types";
import { SchedulingItemConfig } from "./SchedulingItemConfig";
import { VideoItemConfig } from "./VideoItemConfig";
import { BooleanQuestionConfig } from "./BooleanQuestionConfig";
import { AcknowledgmentConfig } from "./AcknowledgmentConfig";
import { TextResponseConfig } from "./TextResponseConfig";
import { MultipleChoiceConfig } from "./MultipleChoiceConfig";
import { FileDownloadConfig } from "./FileDownloadConfig";
import { ExternalLinkConfig } from "./ExternalLinkConfig";
import { QuizConfig } from "./QuizConfig";
import { CarrierContractingConfig } from "./CarrierContractingConfig";

interface MetadataConfigSelectorProps {
  itemType: ChecklistItemType;
  schedulingMetadata:
    | (SchedulingChecklistMetadata & { _type: "scheduling_booking" })
    | null;
  videoMetadata: (VideoEmbedMetadata & { _type: "video_embed" }) | null;
  booleanQuestionMetadata:
    | (BooleanQuestionMetadata & { _type: "boolean_question" })
    | null;
  acknowledgmentMetadata:
    | (AcknowledgmentMetadata & { _type: "acknowledgment" })
    | null;
  textResponseMetadata:
    | (TextResponseMetadata & { _type: "text_response" })
    | null;
  multipleChoiceMetadata:
    | (MultipleChoiceMetadata & { _type: "multiple_choice" })
    | null;
  fileDownloadMetadata:
    | (FileDownloadMetadata & { _type: "file_download" })
    | null;
  externalLinkMetadata:
    | (ExternalLinkMetadata & { _type: "external_link" })
    | null;
  quizMetadata: (QuizMetadata & { _type: "quiz" }) | null;
  carrierContractingMetadata:
    | (CarrierContractingMetadata & { _type: "carrier_contracting" })
    | null;
  onSchedulingChange: (
    metadata: SchedulingChecklistMetadata & { _type: "scheduling_booking" },
  ) => void;
  onVideoChange: (
    metadata: VideoEmbedMetadata & { _type: "video_embed" },
  ) => void;
  onBooleanQuestionChange: (
    metadata: BooleanQuestionMetadata & { _type: "boolean_question" },
  ) => void;
  onAcknowledgmentChange: (
    metadata: AcknowledgmentMetadata & { _type: "acknowledgment" },
  ) => void;
  onTextResponseChange: (
    metadata: TextResponseMetadata & { _type: "text_response" },
  ) => void;
  onMultipleChoiceChange: (
    metadata: MultipleChoiceMetadata & { _type: "multiple_choice" },
  ) => void;
  onFileDownloadChange: (
    metadata: FileDownloadMetadata & { _type: "file_download" },
  ) => void;
  onExternalLinkChange: (
    metadata: ExternalLinkMetadata & { _type: "external_link" },
  ) => void;
  onQuizChange: (metadata: QuizMetadata & { _type: "quiz" }) => void;
  onCarrierContractingChange: (
    metadata: CarrierContractingMetadata & { _type: "carrier_contracting" },
  ) => void;
}

/**
 * Renders the appropriate metadata configuration component based on checklist item type.
 * Uses discriminated unions for type-safe metadata handling.
 */
export function MetadataConfigSelector({
  itemType,
  schedulingMetadata,
  videoMetadata,
  booleanQuestionMetadata,
  acknowledgmentMetadata,
  textResponseMetadata,
  multipleChoiceMetadata,
  fileDownloadMetadata,
  externalLinkMetadata,
  quizMetadata,
  carrierContractingMetadata,
  onSchedulingChange,
  onVideoChange,
  onBooleanQuestionChange,
  onAcknowledgmentChange,
  onTextResponseChange,
  onMultipleChoiceChange,
  onFileDownloadChange,
  onExternalLinkChange,
  onQuizChange,
  onCarrierContractingChange,
}: MetadataConfigSelectorProps) {
  switch (itemType) {
    case "scheduling_booking":
      return (
        <SchedulingItemConfig
          metadata={schedulingMetadata}
          onChange={onSchedulingChange}
        />
      );
    case "video_embed":
      return (
        <VideoItemConfig metadata={videoMetadata} onChange={onVideoChange} />
      );
    case "boolean_question":
      return (
        <BooleanQuestionConfig
          metadata={booleanQuestionMetadata}
          onChange={onBooleanQuestionChange}
        />
      );
    case "acknowledgment":
      return (
        <AcknowledgmentConfig
          metadata={acknowledgmentMetadata}
          onChange={onAcknowledgmentChange}
        />
      );
    case "text_response":
      return (
        <TextResponseConfig
          metadata={textResponseMetadata}
          onChange={onTextResponseChange}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoiceConfig
          metadata={multipleChoiceMetadata}
          onChange={onMultipleChoiceChange}
        />
      );
    case "file_download":
      return (
        <FileDownloadConfig
          metadata={fileDownloadMetadata}
          onChange={onFileDownloadChange}
        />
      );
    case "external_link":
      return (
        <ExternalLinkConfig
          metadata={externalLinkMetadata}
          onChange={onExternalLinkChange}
        />
      );
    case "quiz":
      return <QuizConfig metadata={quizMetadata} onChange={onQuizChange} />;
    case "carrier_contracting":
      return (
        <CarrierContractingConfig
          metadata={carrierContractingMetadata}
          onChange={onCarrierContractingChange}
        />
      );
    default:
      return null;
  }
}
