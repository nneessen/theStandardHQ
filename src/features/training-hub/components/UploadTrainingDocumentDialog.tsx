// src/features/training-hub/components/UploadTrainingDocumentDialog.tsx
/**
 * Upload dialog for training documents
 *
 * Allows trainers and contracting managers to upload documents to the
 * shared document library with category, name, and description metadata.
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Loader2,
  FileText,
  X,
  GraduationCap,
  FileSearch,
  Shield,
  Megaphone,
  File,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUploadTrainingDocument } from "../hooks/useTrainingDocuments";
import {
  TRAINING_CATEGORY_CONFIG,
  TRAINING_CATEGORY_ORDER,
  formatFileSize,
  type TrainingDocumentCategory,
} from "../types/training-document.types";
import { toast } from "sonner";

interface UploadTrainingDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Category icons
const CATEGORY_ICONS: Record<TrainingDocumentCategory, React.ReactNode> = {
  training: <GraduationCap className="h-3.5 w-3.5" />,
  underwriting: <FileSearch className="h-3.5 w-3.5" />,
  carrier_form: <FileText className="h-3.5 w-3.5" />,
  compliance: <Shield className="h-3.5 w-3.5" />,
  marketing: <Megaphone className="h-3.5 w-3.5" />,
  other: <File className="h-3.5 w-3.5" />,
};

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Accepted file types
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
];

export function UploadTrainingDocumentDialog({
  open,
  onOpenChange,
}: UploadTrainingDocumentDialogProps) {
  const { user } = useAuth();
  const [documentName, setDocumentName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TrainingDocumentCategory | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const uploadDocument = useUploadTrainingDocument();

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "File type not supported. Please upload a PDF, Word, Excel, PowerPoint, image, or text file.";
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      setSelectedFile(file);
      // Auto-fill document name from filename if empty
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      setSelectedFile(file);
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    const fileInput = document.getElementById(
      "training-file-upload",
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile || !documentName || !category || !user?.id) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setUploadProgress(10);

      await uploadDocument.mutateAsync({
        file: selectedFile,
        name: documentName,
        description: description || undefined,
        category,
        uploadedBy: user.id,
      });

      setUploadProgress(100);
      toast.success("Document uploaded successfully");

      // Reset form and close
      setTimeout(() => {
        resetForm();
        onOpenChange(false);
      }, 300);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload document");
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setDocumentName("");
    setDescription("");
    setCategory("");
    setSelectedFile(null);
    setUploadProgress(0);
    setDragActive(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const isValid = selectedFile && documentName.trim() && category;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm font-semibold">
            Upload Training Document
          </DialogTitle>
          <DialogDescription className="text-[10px]">
            Upload a document to the shared library
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* File Selection */}
          <div className="space-y-1.5">
            <Label
              htmlFor="training-file-upload"
              className="text-[11px] font-medium"
            >
              File *
            </Label>
            {!selectedFile ? (
              <label
                htmlFor="training-file-upload"
                className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                  dragActive
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                    : "border-v2-ring dark:border-v2-ring-strong hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="h-6 w-6 text-v2-ink-subtle" />
                <div className="text-center">
                  <span className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle">
                    Drop file here or click to browse
                  </span>
                  <p className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted mt-1">
                    PDF, Word, Excel, PowerPoint, Images (max 50MB)
                  </p>
                </div>
                <input
                  id="training-file-upload"
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFileSelect}
                />
              </label>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-v2-canvas dark:bg-v2-card-tinted/50 rounded-md border border-v2-ring dark:border-v2-ring-strong">
                <FileText className="h-5 w-5 text-v2-ink-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-v2-ink dark:text-v2-ink truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={handleRemoveFile}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Document Name */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-name" className="text-[11px] font-medium">
              Document Name *
            </Label>
            <Input
              id="doc-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter document name"
              className="h-8 text-xs"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-category" className="text-[11px] font-medium">
              Category *
            </Label>
            <Select
              value={category}
              onValueChange={(val) =>
                setCategory(val as TrainingDocumentCategory)
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_CATEGORY_ORDER.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    <div className="flex items-center gap-2">
                      {CATEGORY_ICONS[cat]}
                      <div>
                        <span>{TRAINING_CATEGORY_CONFIG[cat].label}</span>
                        <span className="ml-2 text-[10px] text-v2-ink-subtle">
                          {TRAINING_CATEGORY_CONFIG[cat].description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description (optional) */}
          <div className="space-y-1.5">
            <Label
              htmlFor="doc-description"
              className="text-[11px] font-medium"
            >
              Description{" "}
              <span className="font-normal text-v2-ink-subtle">(optional)</span>
            </Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a brief description..."
              className="min-h-[60px] text-xs resize-none"
              rows={2}
            />
          </div>

          {/* Upload Progress */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-1">
              <div className="h-1.5 bg-v2-ring dark:bg-v2-ring-strong rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-v2-ink-muted text-center">
                Uploading...
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="h-7 text-xs"
            disabled={uploadDocument.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            className="h-7 text-xs"
            disabled={!isValid || uploadDocument.isPending}
          >
            {uploadDocument.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadTrainingDocumentDialog;
