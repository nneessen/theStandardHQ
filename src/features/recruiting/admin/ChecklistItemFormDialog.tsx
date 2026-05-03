// src/features/recruiting/admin/ChecklistItemFormDialog.tsx

import { useState, useCallback, useEffect, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type {
  PhaseChecklistItem,
  CreateChecklistItemInput,
  ChecklistItemType,
  CompletedBy,
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
import { CHECKLIST_ITEM_TYPE_LABELS } from "@/types/recruiting.types";
import type { SchedulingChecklistMetadata } from "@/types/integration.types";
import type { SignatureRequiredMetadata } from "@/types/signature.types";
import {
  isSchedulingMetadata,
  isVideoMetadata,
  isBooleanQuestionMetadata,
  isAcknowledgmentMetadata,
  isTextResponseMetadata,
  isMultipleChoiceMetadata,
  isFileDownloadMetadata,
  isExternalLinkMetadata,
  isQuizMetadata,
  isSignatureRequiredMetadata,
  isCarrierContractingMetadata,
} from "@/types/checklist-metadata.types";
import { MetadataConfigSelector } from "./MetadataConfigSelector";

const ITEM_TYPES: { value: ChecklistItemType; label: string }[] = [
  {
    value: "document_upload",
    label: CHECKLIST_ITEM_TYPE_LABELS.document_upload,
  },
  {
    value: "task_completion",
    label: CHECKLIST_ITEM_TYPE_LABELS.task_completion,
  },
  {
    value: "training_module",
    label: CHECKLIST_ITEM_TYPE_LABELS.training_module,
  },
  {
    value: "manual_approval",
    label: CHECKLIST_ITEM_TYPE_LABELS.manual_approval,
  },
  {
    value: "automated_check",
    label: CHECKLIST_ITEM_TYPE_LABELS.automated_check,
  },
  {
    value: "signature_required",
    label: CHECKLIST_ITEM_TYPE_LABELS.signature_required,
  },
  {
    value: "scheduling_booking",
    label: CHECKLIST_ITEM_TYPE_LABELS.scheduling_booking,
  },
  { value: "video_embed", label: CHECKLIST_ITEM_TYPE_LABELS.video_embed },
  {
    value: "boolean_question",
    label: CHECKLIST_ITEM_TYPE_LABELS.boolean_question,
  },
  { value: "acknowledgment", label: CHECKLIST_ITEM_TYPE_LABELS.acknowledgment },
  { value: "text_response", label: CHECKLIST_ITEM_TYPE_LABELS.text_response },
  {
    value: "multiple_choice",
    label: CHECKLIST_ITEM_TYPE_LABELS.multiple_choice,
  },
  { value: "file_download", label: CHECKLIST_ITEM_TYPE_LABELS.file_download },
  { value: "external_link", label: CHECKLIST_ITEM_TYPE_LABELS.external_link },
  { value: "quiz", label: CHECKLIST_ITEM_TYPE_LABELS.quiz },
  {
    value: "carrier_contracting",
    label: CHECKLIST_ITEM_TYPE_LABELS.carrier_contracting,
  },
];

const VALID_ITEM_TYPES = new Set<string>(ITEM_TYPES.map((t) => t.value));

/**
 * Runtime type guard for ChecklistItemType
 */
function isValidItemType(type: string): type is ChecklistItemType {
  return VALID_ITEM_TYPES.has(type);
}

const CAN_BE_COMPLETED_BY: { value: CompletedBy; label: string }[] = [
  { value: "recruit", label: "Recruit" },
  { value: "upline", label: "Upline" },
  { value: "system", label: "System" },
];

const VALID_COMPLETED_BY = new Set<string>(
  CAN_BE_COMPLETED_BY.map((c) => c.value),
);

/**
 * Runtime type guard for CompletedBy
 */
function isValidCompletedBy(value: string): value is CompletedBy {
  return VALID_COMPLETED_BY.has(value);
}

const INITIAL_FORM_STATE: CreateChecklistItemInput = {
  item_name: "",
  item_description: undefined,
  item_type: "task_completion",
  is_required: true,
  visible_to_recruit: true,
  can_be_completed_by: "recruit" as const,
  requires_verification: false,
  external_link: undefined,
  metadata: undefined,
};

interface ChecklistItemFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  editingItem?: PhaseChecklistItem | null;
  isPending: boolean;
  onSubmit: (data: CreateChecklistItemInput) => Promise<void>;
  onClose: () => void;
}

function ChecklistItemFormDialogComponent({
  mode,
  open,
  editingItem,
  isPending,
  onSubmit,
  onClose,
}: ChecklistItemFormDialogProps) {
  // Form state for create mode
  const [formState, setFormState] =
    useState<CreateChecklistItemInput>(INITIAL_FORM_STATE);

  // Local editing state for edit mode
  const [localEditingItem, setLocalEditingItem] =
    useState<PhaseChecklistItem | null>(null);

  // Track the ID of the item being edited to guard against stale prop updates
  const editingItemIdRef = useRef<string | null>(null);

  // Metadata states for all types
  const [schedulingMetadata, setSchedulingMetadata] = useState<
    (SchedulingChecklistMetadata & { _type: "scheduling_booking" }) | null
  >(null);
  const [videoMetadata, setVideoMetadata] = useState<
    (VideoEmbedMetadata & { _type: "video_embed" }) | null
  >(null);
  const [booleanQuestionMetadata, setBooleanQuestionMetadata] = useState<
    (BooleanQuestionMetadata & { _type: "boolean_question" }) | null
  >(null);
  const [acknowledgmentMetadata, setAcknowledgmentMetadata] = useState<
    (AcknowledgmentMetadata & { _type: "acknowledgment" }) | null
  >(null);
  const [textResponseMetadata, setTextResponseMetadata] = useState<
    (TextResponseMetadata & { _type: "text_response" }) | null
  >(null);
  const [multipleChoiceMetadata, setMultipleChoiceMetadata] = useState<
    (MultipleChoiceMetadata & { _type: "multiple_choice" }) | null
  >(null);
  const [fileDownloadMetadata, setFileDownloadMetadata] = useState<
    (FileDownloadMetadata & { _type: "file_download" }) | null
  >(null);
  const [externalLinkMetadata, setExternalLinkMetadata] = useState<
    (ExternalLinkMetadata & { _type: "external_link" }) | null
  >(null);
  const [quizMetadata, setQuizMetadata] = useState<
    (QuizMetadata & { _type: "quiz" }) | null
  >(null);
  const [signatureRequiredMetadata, setSignatureRequiredMetadata] = useState<
    (SignatureRequiredMetadata & { _type: "signature_required" }) | null
  >(null);
  const [carrierContractingMetadata, setCarrierContractingMetadata] = useState<
    (CarrierContractingMetadata & { _type: "carrier_contracting" }) | null
  >(null);

  // Helper to initialize metadata based on item type
  const initializeMetadata = useCallback((item: PhaseChecklistItem) => {
    // Reset all metadata first
    setSchedulingMetadata(null);
    setVideoMetadata(null);
    setBooleanQuestionMetadata(null);
    setAcknowledgmentMetadata(null);
    setTextResponseMetadata(null);
    setMultipleChoiceMetadata(null);
    setFileDownloadMetadata(null);
    setExternalLinkMetadata(null);
    setQuizMetadata(null);
    setSignatureRequiredMetadata(null);
    setCarrierContractingMetadata(null);

    if (!item.metadata) return;

    switch (item.item_type) {
      case "scheduling_booking":
        if (isSchedulingMetadata(item.metadata)) {
          setSchedulingMetadata(item.metadata);
        } else {
          setSchedulingMetadata({
            ...(item.metadata as unknown as SchedulingChecklistMetadata),
            _type: "scheduling_booking",
          });
        }
        break;
      case "video_embed":
        if (isVideoMetadata(item.metadata)) {
          setVideoMetadata(item.metadata);
        } else {
          setVideoMetadata({
            ...(item.metadata as unknown as VideoEmbedMetadata),
            _type: "video_embed",
          });
        }
        break;
      case "boolean_question":
        if (isBooleanQuestionMetadata(item.metadata)) {
          setBooleanQuestionMetadata(item.metadata);
        } else {
          setBooleanQuestionMetadata({
            ...(item.metadata as unknown as BooleanQuestionMetadata),
            _type: "boolean_question",
          });
        }
        break;
      case "acknowledgment":
        if (isAcknowledgmentMetadata(item.metadata)) {
          setAcknowledgmentMetadata(item.metadata);
        } else {
          setAcknowledgmentMetadata({
            ...(item.metadata as unknown as AcknowledgmentMetadata),
            _type: "acknowledgment",
          });
        }
        break;
      case "text_response":
        if (isTextResponseMetadata(item.metadata)) {
          setTextResponseMetadata(item.metadata);
        } else {
          setTextResponseMetadata({
            ...(item.metadata as unknown as TextResponseMetadata),
            _type: "text_response",
          });
        }
        break;
      case "multiple_choice":
        if (isMultipleChoiceMetadata(item.metadata)) {
          setMultipleChoiceMetadata(item.metadata);
        } else {
          setMultipleChoiceMetadata({
            ...(item.metadata as unknown as MultipleChoiceMetadata),
            _type: "multiple_choice",
          });
        }
        break;
      case "file_download":
        if (isFileDownloadMetadata(item.metadata)) {
          setFileDownloadMetadata(item.metadata);
        } else {
          setFileDownloadMetadata({
            ...(item.metadata as unknown as FileDownloadMetadata),
            _type: "file_download",
          });
        }
        break;
      case "external_link":
        if (isExternalLinkMetadata(item.metadata)) {
          setExternalLinkMetadata(item.metadata);
        } else {
          setExternalLinkMetadata({
            ...(item.metadata as unknown as ExternalLinkMetadata),
            _type: "external_link",
          });
        }
        break;
      case "quiz":
        if (isQuizMetadata(item.metadata)) {
          setQuizMetadata(item.metadata);
        } else {
          setQuizMetadata({
            ...(item.metadata as unknown as QuizMetadata),
            _type: "quiz",
          });
        }
        break;
      case "signature_required":
        if (isSignatureRequiredMetadata(item.metadata)) {
          setSignatureRequiredMetadata(item.metadata);
        } else {
          setSignatureRequiredMetadata({
            ...(item.metadata as unknown as SignatureRequiredMetadata),
            _type: "signature_required",
          });
        }
        break;
      case "carrier_contracting":
        if (isCarrierContractingMetadata(item.metadata)) {
          setCarrierContractingMetadata(item.metadata);
        } else {
          setCarrierContractingMetadata({
            ...(item.metadata as unknown as CarrierContractingMetadata),
            _type: "carrier_contracting",
          });
        }
        break;
    }
  }, []);

  // Sync editing item when it changes - use ID comparison to prevent stale overwrites
  useEffect(() => {
    if (mode === "edit" && editingItem) {
      // Only update if this is a NEW item being edited (different ID)
      if (editingItemIdRef.current !== editingItem.id) {
        editingItemIdRef.current = editingItem.id;
        setLocalEditingItem(editingItem);
        initializeMetadata(editingItem);
      }
    }
  }, [mode, editingItem, initializeMetadata]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormState(INITIAL_FORM_STATE);
      setLocalEditingItem(null);
      setSchedulingMetadata(null);
      setVideoMetadata(null);
      setBooleanQuestionMetadata(null);
      setAcknowledgmentMetadata(null);
      setTextResponseMetadata(null);
      setMultipleChoiceMetadata(null);
      setFileDownloadMetadata(null);
      setExternalLinkMetadata(null);
      setQuizMetadata(null);
      setSignatureRequiredMetadata(null);
      setCarrierContractingMetadata(null);
      editingItemIdRef.current = null;
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Get the active metadata for the current item type
  const getActiveMetadata = useCallback(
    (itemType: ChecklistItemType) => {
      switch (itemType) {
        case "scheduling_booking":
          return schedulingMetadata;
        case "video_embed":
          return videoMetadata;
        case "boolean_question":
          return booleanQuestionMetadata;
        case "acknowledgment":
          return acknowledgmentMetadata;
        case "text_response":
          return textResponseMetadata;
        case "multiple_choice":
          return multipleChoiceMetadata;
        case "file_download":
          return fileDownloadMetadata;
        case "external_link":
          return externalLinkMetadata;
        case "quiz":
          return quizMetadata;
        case "signature_required":
          return signatureRequiredMetadata;
        case "carrier_contracting":
          return carrierContractingMetadata;
        default:
          return undefined;
      }
    },
    [
      schedulingMetadata,
      videoMetadata,
      booleanQuestionMetadata,
      acknowledgmentMetadata,
      textResponseMetadata,
      multipleChoiceMetadata,
      fileDownloadMetadata,
      externalLinkMetadata,
      quizMetadata,
      signatureRequiredMetadata,
      carrierContractingMetadata,
    ],
  );

  const handleSubmit = useCallback(async () => {
    try {
      if (mode === "create") {
        if (!formState.item_name.trim()) {
          toast.error("Item name is required");
          return;
        }

        const metadata = getActiveMetadata(formState.item_type);
        await onSubmit({ ...formState, metadata: metadata ?? undefined });
      } else if (mode === "edit" && localEditingItem) {
        if (!localEditingItem.item_name.trim()) {
          toast.error("Item name is required");
          return;
        }

        const itemType = isValidItemType(localEditingItem.item_type)
          ? localEditingItem.item_type
          : "task_completion";
        const completedBy = isValidCompletedBy(
          localEditingItem.can_be_completed_by,
        )
          ? localEditingItem.can_be_completed_by
          : "recruit";

        const metadata = getActiveMetadata(itemType);

        await onSubmit({
          item_name: localEditingItem.item_name,
          item_description: localEditingItem.item_description ?? undefined,
          item_type: itemType,
          is_required: localEditingItem.is_required,
          visible_to_recruit: localEditingItem.visible_to_recruit,
          can_be_completed_by: completedBy,
          requires_verification: localEditingItem.requires_verification,
          external_link: localEditingItem.external_link ?? undefined,
          metadata: metadata ?? undefined,
        });
      }
    } catch (error) {
      console.error("Form submission failed:", error);
    }
  }, [mode, formState, localEditingItem, getActiveMetadata, onSubmit]);

  // Get current values based on mode
  const currentItemType =
    mode === "create"
      ? formState.item_type
      : isValidItemType(localEditingItem?.item_type ?? "")
        ? (localEditingItem?.item_type as ChecklistItemType)
        : "task_completion";

  const renderFormFields = () => {
    const isCreate = mode === "create";
    const item = isCreate ? formState : localEditingItem;

    if (!item) return null;

    const updateField = <K extends keyof CreateChecklistItemInput>(
      key: K,
      value: CreateChecklistItemInput[K],
    ) => {
      if (isCreate) {
        setFormState((prev) => ({ ...prev, [key]: value }));
      } else if (localEditingItem) {
        setLocalEditingItem((prev) =>
          prev ? { ...prev, [key]: value } : null,
        );
      }
    };

    return (
      <div className="space-y-3 py-3 max-h-[60vh] overflow-y-auto">
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Item Name
          </Label>
          <Input
            value={item.item_name}
            onChange={(e) => updateField("item_name", e.target.value)}
            placeholder="e.g., Upload Resume"
            className="h-7 text-[11px] bg-background border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Description
          </Label>
          <Textarea
            value={item.item_description || ""}
            onChange={(e) => updateField("item_description", e.target.value)}
            placeholder="Optional instructions..."
            className="text-[11px] min-h-14 bg-background border-border"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Type
            </Label>
            <Select
              value={item.item_type}
              onValueChange={(value: ChecklistItemType) =>
                updateField("item_type", value)
              }
            >
              <SelectTrigger className="h-7 text-[11px] bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {ITEM_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-[11px]">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Completed By
            </Label>
            <Select
              value={item.can_be_completed_by}
              onValueChange={(value: CompletedBy) =>
                updateField("can_be_completed_by", value)
              }
            >
              <SelectTrigger className="h-7 text-[11px] bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAN_BE_COMPLETED_BY.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-[11px]">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {item.item_type === "training_module" && (
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              External Link
            </Label>
            <Input
              value={item.external_link || ""}
              onChange={(e) => updateField("external_link", e.target.value)}
              placeholder="https://..."
              className="h-7 text-[11px] bg-background border-border"
            />
          </div>
        )}

        <MetadataConfigSelector
          itemType={currentItemType}
          schedulingMetadata={schedulingMetadata}
          videoMetadata={videoMetadata}
          booleanQuestionMetadata={booleanQuestionMetadata}
          acknowledgmentMetadata={acknowledgmentMetadata}
          textResponseMetadata={textResponseMetadata}
          multipleChoiceMetadata={multipleChoiceMetadata}
          fileDownloadMetadata={fileDownloadMetadata}
          externalLinkMetadata={externalLinkMetadata}
          quizMetadata={quizMetadata}
          signatureRequiredMetadata={signatureRequiredMetadata}
          carrierContractingMetadata={carrierContractingMetadata}
          onSchedulingChange={setSchedulingMetadata}
          onVideoChange={setVideoMetadata}
          onBooleanQuestionChange={setBooleanQuestionMetadata}
          onAcknowledgmentChange={setAcknowledgmentMetadata}
          onTextResponseChange={setTextResponseMetadata}
          onMultipleChoiceChange={setMultipleChoiceMetadata}
          onFileDownloadChange={setFileDownloadMetadata}
          onExternalLinkChange={setExternalLinkMetadata}
          onQuizChange={setQuizMetadata}
          onSignatureRequiredChange={setSignatureRequiredMetadata}
          onCarrierContractingChange={setCarrierContractingMetadata}
        />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${mode}_is_required`}
              checked={item.is_required}
              onCheckedChange={(checked) =>
                updateField("is_required", !!checked)
              }
            />
            <label
              htmlFor={`${mode}_is_required`}
              className="text-[11px] text-muted-foreground cursor-pointer"
            >
              Required
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`${mode}_requires_verification`}
              checked={item.requires_verification}
              onCheckedChange={(checked) =>
                updateField("requires_verification", !!checked)
              }
            />
            <label
              htmlFor={`${mode}_requires_verification`}
              className="text-[11px] text-muted-foreground cursor-pointer"
            >
              Requires Verification
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id={`${mode}_visible_to_recruit`}
            checked={item.visible_to_recruit !== false}
            onCheckedChange={(checked) =>
              updateField("visible_to_recruit", !!checked)
            }
          />
          <label
            htmlFor={`${mode}_visible_to_recruit`}
            className="text-[11px] text-muted-foreground cursor-pointer"
          >
            Visible to recruits
          </label>
        </div>

        {item.visible_to_recruit === false && (
          <p className="text-[10px] text-warning ml-5">
            This item will be hidden from recruits.
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-3 bg-card">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {mode === "create" ? "Add Checklist Item" : "Edit Checklist Item"}
          </DialogTitle>
        </DialogHeader>

        {renderFormFields()}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            {mode === "create" ? "Add Item" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const ChecklistItemFormDialog = memo(ChecklistItemFormDialogComponent);
