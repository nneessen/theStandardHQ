// src/features/business-tools/components/WorkbookReview.tsx
// Upload corrected workbook after export for review/corrections

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReviewWorkbook } from "../hooks/useBusinessTools";

export function WorkbookReview() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reviewWorkbook = useReviewWorkbook();

  const handleFile = useCallback((f: File) => {
    if (
      f.name.endsWith(".xlsx") ||
      f.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      setFile(f);
    }
  }, []);

  const handleSubmit = () => {
    if (!file) return;
    reviewWorkbook.mutate(
      { file },
      {
        onSuccess: () => setFile(null),
      },
    );
  };

  return (
    <div className="rounded-lg border border-v2-ring bg-v2-card p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <FileSpreadsheet className="h-3.5 w-3.5 text-v2-ink-muted" />
        <span className="text-[11px] font-medium text-v2-ink-muted">
          Upload Corrected Workbook
        </span>
      </div>

      <p className="text-[10px] text-v2-ink-muted">
        After exporting and reviewing your workbook, upload the corrected
        version to apply changes.
      </p>

      {/* Drop zone */}
      <div
        className={cn(
          "border border-dashed rounded p-3 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-teal-500 bg-teal-50/50 dark:bg-teal-900/20"
            : "border-v2-ring  hover:border-v2-ring-strong dark:hover:border-v2-ring",
          reviewWorkbook.isPending && "opacity-50 pointer-events-none",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const droppedFile = e.dataTransfer.files[0];
          if (droppedFile) handleFile(droppedFile);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-teal-500" />
            <span className="text-[11px] text-v2-ink-muted">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="text-v2-ink-subtle hover:text-v2-ink-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-4 w-4 mx-auto text-v2-ink-subtle mb-1" />
            <p className="text-[10px] text-v2-ink-muted">
              Drop .xlsx file or click to browse
            </p>
          </>
        )}
      </div>

      {/* Submit */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px]"
        disabled={!file || reviewWorkbook.isPending}
        onClick={handleSubmit}
      >
        {reviewWorkbook.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Upload className="h-3 w-3 mr-1" />
        )}
        Apply Corrections
      </Button>

      {/* Success result */}
      {reviewWorkbook.isSuccess && reviewWorkbook.data && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-[10px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>
            Applied: {reviewWorkbook.data.applied_count} | Categorized:{" "}
            {reviewWorkbook.data.categorized_count} | Excluded:{" "}
            {reviewWorkbook.data.excluded_count} | Skipped:{" "}
            {reviewWorkbook.data.skipped_count}
          </span>
        </div>
      )}
    </div>
  );
}
