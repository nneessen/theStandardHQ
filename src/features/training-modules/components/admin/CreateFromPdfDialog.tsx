// src/features/training-modules/components/admin/CreateFromPdfDialog.tsx
import { useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, FileUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
} from "../../types/training-module.types";
import type { ModuleCategory } from "../../types/training-module.types";
import { useCreateModuleFromPdf } from "../../hooks/useCreateModuleFromPdf";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface CreateFromPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFromPdfDialog({
  open,
  onOpenChange,
}: CreateFromPdfDialogProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<ModuleCategory>("carrier_training");
  const [fileError, setFileError] = useState("");
  const { mutation, progress } = useCreateModuleFromPdf();

  const isActive =
    progress.stage === "extracting" ||
    progress.stage === "transforming" ||
    progress.stage === "inserting";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError("");
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Only PDF files are accepted.");
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError("File must be under 50MB.");
      setFile(null);
      return;
    }
    setFile(selected);
  }

  function handleImport() {
    if (!file) return;
    mutation.mutate(
      { file, category },
      {
        onSuccess: (mod) => {
          onOpenChange(false);
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          navigate({
            to: "/my-training/builder/$moduleId",
            params: { moduleId: mod.id },
          });
        },
      },
    );
  }

  function handleClose(nextOpen: boolean) {
    if (isActive) return; // prevent close during import
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setFile(null);
      setFileError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Import Module from PDF</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload a PDF to auto-create a training module with lessons and
            quizzes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* File input */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">
              PDF File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isActive}
              className="block w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-card-tinted file:text-foreground dark:file:bg-muted dark:file:text-muted-foreground hover:file:bg-muted dark:hover:file:bg-muted disabled:opacity-50"
            />
            {fileError && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {fileError}
              </p>
            )}
            {file && !fileError && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} ({formatSize(file.size)})
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ModuleCategory)}
              disabled={isActive}
              className="w-full h-7 text-xs border border-border dark:border-border rounded-md px-2 bg-card disabled:opacity-50"
            >
              {MODULE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {MODULE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Progress */}
          {isActive && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-muted-foreground bg-background dark:bg-card-tinted/50 rounded px-3 py-2">
              <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
              <div>
                <p>{progress.message}</p>
                {progress.lessonProgress &&
                  progress.lessonProgress.current > 0 && (
                    <p className="text-muted-foreground mt-0.5">
                      Lesson {progress.lessonProgress.current} of{" "}
                      {progress.lessonProgress.total}
                    </p>
                  )}
              </div>
            </div>
          )}

          {/* Error */}
          {progress.stage === "error" && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <p>{progress.message}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => handleClose(false)}
            disabled={isActive}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleImport}
            disabled={!file || !!fileError || isActive}
          >
            {isActive ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileUp className="h-3 w-3 mr-1" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
