// src/features/recruiting/admin/ExternalLinkConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { ExternalLink, AlertCircle } from "lucide-react";
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
  ExternalLinkMetadata,
  ExternalLinkCompletionMethod,
} from "@/types/recruiting.types";
import { EXTERNAL_LINK_COMPLETION_LABELS } from "@/types/recruiting.types";
import { createExternalLinkMetadata } from "@/types/checklist-metadata.types";

interface ExternalLinkConfigProps {
  metadata: ExternalLinkMetadata | null;
  onChange: (
    metadata: ExternalLinkMetadata & { _type: "external_link" },
  ) => void;
}

export function ExternalLinkConfig({
  metadata,
  onChange,
}: ExternalLinkConfigProps) {
  const [url, setUrl] = useState(metadata?.url ?? "");
  const [linkText, setLinkText] = useState(metadata?.link_text ?? "");
  const [description, setDescription] = useState(metadata?.description ?? "");
  const [openInNewTab, setOpenInNewTab] = useState(
    metadata?.open_in_new_tab ?? true,
  );
  const [completionMethod, setCompletionMethod] =
    useState<ExternalLinkCompletionMethod>(
      metadata?.completion_method ?? "manual",
    );
  const [expectedDuration, setExpectedDuration] = useState<number | undefined>(
    metadata?.expected_duration_minutes,
  );
  const [verificationInstructions, setVerificationInstructions] = useState(
    metadata?.verification_instructions ?? "",
  );

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    if (!url.trim() || !linkText.trim()) {
      return;
    }

    const data: ExternalLinkMetadata = {
      url: url,
      link_text: linkText,
      description: description || undefined,
      open_in_new_tab: openInNewTab,
      completion_method: completionMethod,
      expected_duration_minutes: expectedDuration,
      verification_instructions: verificationInstructions || undefined,
    };

    const newMetadata = createExternalLinkMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    url,
    linkText,
    description,
    openInNewTab,
    completionMethod,
    expectedDuration,
    verificationInstructions,
  ]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  const handleNumberChange = (
    value: string,
    setter: (val: number | undefined) => void,
  ) => {
    if (value === "") {
      setter(undefined);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) {
        setter(num);
      }
    }
  };

  return (
    <div className="space-y-3 p-2.5 bg-background rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          External Link Configuration
        </span>
      </div>

      {/* URL */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          External URL <span className="text-destructive">*</span>
        </Label>
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/training"
          className="h-7 text-[11px]"
        />
        {!url.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <AlertCircle className="h-3 w-3" />
            URL is required
          </div>
        )}
      </div>

      {/* Link Text */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Button/Link Text <span className="text-destructive">*</span>
        </Label>
        <Input
          type="text"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          placeholder="e.g., Complete Background Check"
          className="h-7 text-[11px]"
        />
        {!linkText.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <AlertCircle className="h-3 w-3" />
            Link text is required
          </div>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Instructions for Recruit (Optional)
        </Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Click the button to access the background check portal. Complete all required steps and return here when finished."
          className="min-h-[60px] text-[11px] resize-none"
        />
      </div>

      {/* Open in New Tab */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Open in New Tab
          </Label>
          <p className="text-[9px] text-muted-foreground">
            Open link in a new browser tab
          </p>
        </div>
        <Switch
          checked={openInNewTab}
          onCheckedChange={setOpenInNewTab}
          className="scale-75"
        />
      </div>

      {/* Completion Method */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Completion Method
        </Label>
        <Select
          value={completionMethod}
          onValueChange={(value: ExternalLinkCompletionMethod) =>
            setCompletionMethod(value)
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EXTERNAL_LINK_COMPLETION_LABELS).map(
              ([value, label]) => (
                <SelectItem key={value} value={value} className="text-[11px]">
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <p className="text-[9px] text-muted-foreground">
          {completionMethod === "manual" &&
            "Recruit clicks a button to mark complete after visiting the link"}
          {completionMethod === "webhook" &&
            "External system sends a webhook to mark complete"}
          {completionMethod === "return_url" &&
            "Auto-completes when recruit returns to this page"}
        </p>
      </div>

      {/* Expected Duration */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Expected Duration (minutes)
        </Label>
        <Input
          type="number"
          min={0}
          value={expectedDuration ?? ""}
          onChange={(e) =>
            handleNumberChange(e.target.value, setExpectedDuration)
          }
          placeholder="Optional (e.g., 15)"
          className="h-7 text-[11px]"
        />
        <p className="text-[9px] text-muted-foreground">
          Shown to recruit to set expectations
        </p>
      </div>

      {/* Verification Instructions (for manual) */}
      {completionMethod === "manual" && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Verification Instructions (for Admin)
          </Label>
          <Textarea
            value={verificationInstructions}
            onChange={(e) => setVerificationInstructions(e.target.value)}
            placeholder="e.g., Check the background check portal to verify completion. Look for status 'Completed' in the candidate's profile."
            className="min-h-[50px] text-[11px] resize-none"
          />
          <p className="text-[9px] text-muted-foreground">
            Notes for admin/upline on how to verify this was completed
          </p>
        </div>
      )}

      {/* Info */}
      <div className="p-2 bg-info/10 rounded border border-info/30">
        <p className="text-[9px] text-info">
          <strong>Note:</strong> Recruit will see a "{linkText || "link"}"
          button.
          {expectedDuration && ` Expected time: ~${expectedDuration} minutes.`}
          {completionMethod === "manual" &&
            " They mark it complete manually after."}
        </p>
      </div>
    </div>
  );
}
