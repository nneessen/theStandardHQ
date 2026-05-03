// src/features/business-tools/components/UploadTab.tsx
// File upload with drag-and-drop, filing month, job polling, result summary, institution request

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useRunPipeline,
  useJobStatus,
  useInstitutions,
} from "../hooks/useBusinessTools";
import { UploadResultSummary } from "./UploadResultSummary";
import { InstitutionRequestForm } from "./InstitutionRequestForm";
import type { BusinessToolsTab } from "../types";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (base64 overhead + edge function body limit)
const ACCEPTED_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
];

interface UploadTabProps {
  onSwitchTab: (tab: BusinessToolsTab) => void;
}

export function UploadTab({ onSwitchTab }: UploadTabProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [filingMonth, setFilingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runPipeline = useRunPipeline();
  const { data: job } = useJobStatus(jobId);
  const { data: institutionsData } = useInstitutions();

  const isProcessing =
    !!jobId && job?.status !== "complete" && job?.status !== "failed";
  const isJobDone = job?.status === "complete" || job?.status === "failed";

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type) && !f.name.endsWith(".csv")) {
        return false;
      }
      if (f.size > MAX_FILE_SIZE) return false;
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (files.length === 0 || !filingMonth) return;
    const result = await runPipeline.mutateAsync({ files, filingMonth });
    setJobId(result.job_id);
  };

  const handleReset = () => {
    setJobId(null);
    setFiles([]);
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Show result summary when job is done */}
      {isJobDone && job ? (
        <UploadResultSummary
          job={job}
          onSwitchTab={onSwitchTab}
          onReset={handleReset}
        />
      ) : (
        <>
          {/* Drag-and-drop zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              dragOver
                ? "border-success bg-success/10/50 dark:bg-success/20"
                : "border-v2-ring  hover:border-v2-ring-strong dark:hover:border-v2-ring",
              isProcessing && "opacity-50 pointer-events-none",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.csv"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <Upload className="h-6 w-6 mx-auto text-v2-ink-subtle mb-2" />
            <p className="text-xs font-medium text-v2-ink-muted">
              Drop files here or click to browse
            </p>
            <p className="text-[10px] text-v2-ink-muted mt-1">
              PDF or CSV, max 4MB per file
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-v2-card rounded border border-v2-ring"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-v2-ink-subtle shrink-0" />
                    <span className="text-[11px] text-v2-ink-muted truncate">
                      {f.name}
                    </span>
                    <span className="text-[10px] text-v2-ink-subtle shrink-0">
                      {(f.size / 1024).toFixed(0)}KB
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="text-v2-ink-subtle hover:text-v2-ink-muted dark:hover:text-v2-ink-subtle"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Filing month */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-medium text-v2-ink-muted shrink-0">
              Filing Month
            </label>
            <input
              type="month"
              value={filingMonth}
              onChange={(e) => setFilingMonth(e.target.value)}
              disabled={isProcessing}
              className="h-7 px-2 text-[11px] border border-v2-ring  rounded bg-v2-card text-v2-ink"
            />
          </div>

          {/* Submit */}
          <Button
            size="sm"
            className="h-8 text-xs w-full bg-success hover:bg-success text-white"
            disabled={
              files.length === 0 ||
              !filingMonth ||
              isProcessing ||
              runPipeline.isPending
            }
            onClick={handleSubmit}
          >
            {runPipeline.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {runPipeline.isPending ? "Uploading..." : "Process Statements"}
          </Button>

          {/* Job progress (while processing) */}
          {isProcessing && job && (
            <div className="rounded-lg border border-v2-ring bg-v2-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-success" />
                <span className="text-xs font-medium text-v2-ink dark:text-v2-ink-subtle">
                  Processing...
                </span>
              </div>
              <div className="w-full bg-v2-ring rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all bg-success"
                  style={{
                    width: `${job.progress_total > 0 ? (job.progress_stage / job.progress_total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-v2-ink-muted">
                {job.progress_message ||
                  `Stage ${job.progress_stage} of ${job.progress_total}`}
              </p>
            </div>
          )}
        </>
      )}

      {/* Supported institutions */}
      {institutionsData?.institutions &&
        institutionsData.institutions.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] font-medium text-v2-ink-muted mb-1.5">
              Supported Institutions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {institutionsData.institutions.map((inst) => (
                <span
                  key={inst.key}
                  className="px-2 py-0.5 text-[10px] rounded bg-v2-ring text-v2-ink-muted dark:text-v2-ink-subtle"
                >
                  {inst.name}
                </span>
              ))}
            </div>
          </div>
        )}

      {/* Institution request form */}
      <InstitutionRequestForm />
    </div>
  );
}
