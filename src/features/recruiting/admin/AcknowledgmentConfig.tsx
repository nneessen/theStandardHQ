// src/features/recruiting/admin/AcknowledgmentConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { FileCheck, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AcknowledgmentMetadata,
  AcknowledgmentContentType,
} from "@/types/recruiting.types";
import { ACKNOWLEDGMENT_CONTENT_TYPE_LABELS } from "@/types/recruiting.types";
import { createAcknowledgmentMetadata } from "@/types/checklist-metadata.types";

interface AcknowledgmentConfigProps {
  metadata: AcknowledgmentMetadata | null;
  onChange: (
    metadata: AcknowledgmentMetadata & { _type: "acknowledgment" },
  ) => void;
}

export function AcknowledgmentConfig({
  metadata,
  onChange,
}: AcknowledgmentConfigProps) {
  const [contentType, setContentType] = useState<AcknowledgmentContentType>(
    metadata?.content_type ?? "inline_text",
  );
  const [content, setContent] = useState(metadata?.content ?? "");
  const [acknowledgmentText, setAcknowledgmentText] = useState(
    metadata?.acknowledgment_text ?? "I have read and understand the above.",
  );
  const [documentTitle, setDocumentTitle] = useState(
    metadata?.document_title ?? "",
  );
  const [requireScroll, setRequireScroll] = useState(
    metadata?.require_scroll ?? false,
  );

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    if (!content.trim() || !acknowledgmentText.trim()) {
      return;
    }

    const data: AcknowledgmentMetadata = {
      content_type: contentType,
      content: content,
      acknowledgment_text: acknowledgmentText,
      document_title: documentTitle || undefined,
      require_scroll: requireScroll,
    };

    const newMetadata = createAcknowledgmentMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [contentType, content, acknowledgmentText, documentTitle, requireScroll]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  const getContentPlaceholder = () => {
    switch (contentType) {
      case "inline_text":
        return "Enter the policy text, disclosure, or content the recruit must read...";
      case "document_url":
        return "https://example.com/policy.pdf";
      case "terms_reference":
        return "e.g., privacy-policy-v2, agent-agreement-2024";
      default:
        return "";
    }
  };

  const getContentLabel = () => {
    switch (contentType) {
      case "inline_text":
        return "Content Text";
      case "document_url":
        return "Document URL";
      case "terms_reference":
        return "Terms/Policy Reference ID";
      default:
        return "Content";
    }
  };

  return (
    <div className="space-y-3 p-2.5 bg-background rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Acknowledgment Configuration
        </span>
      </div>

      {/* Content Type */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Content Type
        </Label>
        <Select
          value={contentType}
          onValueChange={(value: AcknowledgmentContentType) =>
            setContentType(value)
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACKNOWLEDGMENT_CONTENT_TYPE_LABELS).map(
              ([value, label]) => (
                <SelectItem key={value} value={value} className="text-[11px]">
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Document Title (for URL and reference types) */}
      {(contentType === "document_url" ||
        contentType === "terms_reference") && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Document Title
          </Label>
          <Input
            type="text"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            placeholder="e.g., Agent Terms & Conditions"
            className="h-7 text-[11px]"
          />
        </div>
      )}

      {/* Content */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          {getContentLabel()} <span className="text-destructive">*</span>
        </Label>
        {contentType === "inline_text" ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={getContentPlaceholder()}
            className="min-h-[100px] text-[11px]"
          />
        ) : (
          <Input
            type={contentType === "document_url" ? "url" : "text"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={getContentPlaceholder()}
            className="h-7 text-[11px]"
          />
        )}
        {!content.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <AlertCircle className="h-3 w-3" />
            Content is required
          </div>
        )}
      </div>

      {/* Acknowledgment Text */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Acknowledgment Checkbox Text{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          type="text"
          value={acknowledgmentText}
          onChange={(e) => setAcknowledgmentText(e.target.value)}
          placeholder="I have read and understand the above."
          className="h-7 text-[11px]"
        />
        {!acknowledgmentText.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <AlertCircle className="h-3 w-3" />
            Acknowledgment text is required
          </div>
        )}
        <p className="text-[9px] text-muted-foreground">
          This text appears next to the checkbox the recruit must check
        </p>
      </div>

      {/* Require Scroll (for inline text) */}
      {contentType === "inline_text" && (
        <div className="flex items-center justify-between py-1">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Require Scroll to Bottom
            </Label>
            <p className="text-[9px] text-muted-foreground">
              Recruit must scroll through entire content before acknowledging
            </p>
          </div>
          <Switch
            checked={requireScroll}
            onCheckedChange={setRequireScroll}
            className="scale-75"
          />
        </div>
      )}

      {/* Info */}
      <div className="p-2 bg-info/10 rounded border border-info/30">
        <p className="text-[9px] text-info">
          <strong>Note:</strong> The recruit will see the content and must check
          a box with "{acknowledgmentText || "I acknowledge..."}" to complete
          this item.
        </p>
      </div>
    </div>
  );
}
