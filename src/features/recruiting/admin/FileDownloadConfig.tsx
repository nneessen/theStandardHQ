// src/features/recruiting/admin/FileDownloadConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { Download, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FileDownloadMetadata,
  FileDownloadType,
} from "@/types/recruiting.types";
import { FILE_DOWNLOAD_TYPE_LABELS } from "@/types/recruiting.types";
import { createFileDownloadMetadata } from "@/types/checklist-metadata.types";

interface FileDownloadConfigProps {
  metadata: FileDownloadMetadata | null;
  onChange: (
    metadata: FileDownloadMetadata & { _type: "file_download" },
  ) => void;
}

export function FileDownloadConfig({
  metadata,
  onChange,
}: FileDownloadConfigProps) {
  const [fileUrl, setFileUrl] = useState(metadata?.file_url ?? "");
  const [fileName, setFileName] = useState(metadata?.file_name ?? "");
  const [fileType, setFileType] = useState<FileDownloadType>(
    metadata?.file_type ?? "pdf",
  );
  const [fileSizeBytes, setFileSizeBytes] = useState<number | undefined>(
    metadata?.file_size_bytes,
  );
  const [requireDownload, setRequireDownload] = useState(
    metadata?.require_download ?? true,
  );
  const [minimumReviewTime, setMinimumReviewTime] = useState<
    number | undefined
  >(metadata?.minimum_review_time_seconds);
  const [acknowledgmentText, setAcknowledgmentText] = useState(
    metadata?.acknowledgment_text ?? "",
  );

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    if (!fileUrl.trim() || !fileName.trim()) {
      return;
    }

    const data: FileDownloadMetadata = {
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
      file_size_bytes: fileSizeBytes,
      require_download: requireDownload,
      minimum_review_time_seconds: minimumReviewTime,
      acknowledgment_text: acknowledgmentText || undefined,
    };

    const newMetadata = createFileDownloadMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    fileUrl,
    fileName,
    fileType,
    fileSizeBytes,
    requireDownload,
    minimumReviewTime,
    acknowledgmentText,
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

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3 p-2.5 bg-v2-canvas rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <Download className="h-3.5 w-3.5 text-v2-ink-muted" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted">
          File Download Configuration
        </span>
      </div>

      {/* File URL */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          File URL <span className="text-red-500">*</span>
        </Label>
        <Input
          type="url"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://example.com/document.pdf"
          className="h-7 text-[11px]"
        />
        {!fileUrl.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            File URL is required
          </div>
        )}
      </div>

      {/* File Name */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Display Name <span className="text-red-500">*</span>
        </Label>
        <Input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="e.g., Agent Handbook 2024"
          className="h-7 text-[11px]"
        />
        {!fileName.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            Display name is required
          </div>
        )}
      </div>

      {/* File Type and Size */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            File Type
          </Label>
          <Select
            value={fileType}
            onValueChange={(value: FileDownloadType) => setFileType(value)}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FILE_DOWNLOAD_TYPE_LABELS).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value} className="text-[11px]">
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            File Size (bytes)
          </Label>
          <Input
            type="number"
            min={0}
            value={fileSizeBytes ?? ""}
            onChange={(e) =>
              handleNumberChange(e.target.value, setFileSizeBytes)
            }
            placeholder="Optional"
            className="h-7 text-[11px]"
          />
          {fileSizeBytes && (
            <p className="text-[9px] text-v2-ink-muted">
              {formatFileSize(fileSizeBytes)}
            </p>
          )}
        </div>
      </div>

      {/* Require Download */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Require Download
          </Label>
          <p className="text-[9px] text-v2-ink-muted">
            Track that recruit clicked download before completing
          </p>
        </div>
        <Switch
          checked={requireDownload}
          onCheckedChange={setRequireDownload}
          className="scale-75"
        />
      </div>

      {/* Minimum Review Time */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Minimum Review Time (seconds)
        </Label>
        <Input
          type="number"
          min={0}
          value={minimumReviewTime ?? ""}
          onChange={(e) =>
            handleNumberChange(e.target.value, setMinimumReviewTime)
          }
          placeholder="Optional (e.g., 60 for 1 minute)"
          className="h-7 text-[11px]"
        />
        <p className="text-[9px] text-v2-ink-muted">
          Time recruit must wait after download before marking complete
        </p>
      </div>

      {/* Acknowledgment Text */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Acknowledgment Text (Optional)
        </Label>
        <Input
          type="text"
          value={acknowledgmentText}
          onChange={(e) => setAcknowledgmentText(e.target.value)}
          placeholder="e.g., I have downloaded and reviewed this document"
          className="h-7 text-[11px]"
        />
        <p className="text-[9px] text-v2-ink-muted">
          If set, recruit must check this box after downloading
        </p>
      </div>

      {/* Info */}
      <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
        <p className="text-[9px] text-blue-700 dark:text-blue-400">
          <strong>Note:</strong> Recruit will see a download button for "
          {fileName || "the file"}".
          {requireDownload && " Download will be tracked."}
          {minimumReviewTime &&
            ` Must wait ${minimumReviewTime}s after download.`}
        </p>
      </div>
    </div>
  );
}
