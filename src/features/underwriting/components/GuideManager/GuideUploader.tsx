// src/features/underwriting/components/GuideManager/GuideUploader.tsx

import { useState, useRef } from "react";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUploadGuide } from "../../hooks/guides/useUnderwritingGuides";
import { useCarriersWithProducts } from "../../hooks/coverage/useCarriersWithProducts";

interface GuideUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function GuideUploader({ open, onOpenChange }: GuideUploaderProps) {
  const uploadMutation = useUploadGuide();
  const { data: carriers, isLoading: carriersLoading } =
    useCarriersWithProducts();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [carrierId, setCarrierId] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const resetForm = () => {
    setSelectedFile(null);
    setCarrierId("");
    setName("");
    setVersion("");
    setEffectiveDate("");
    setExpirationDate("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validateFile = (file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Only PDF files are allowed";
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSelectedFile(file);
    // Auto-fill name from filename if empty
    if (!name) {
      const baseName = file.name.replace(/\.pdf$/i, "");
      setName(baseName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !carrierId || !name) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        carrierId,
        name,
        file: selectedFile,
        version: version || undefined,
        effectiveDate: effectiveDate || undefined,
        expirationDate: expirationDate || undefined,
      });
      handleClose();
    } catch {
      // Error handled by mutation
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Upload Underwriting Guide
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? "border-info bg-info/10"
                : selectedFile
                  ? "border-success bg-success/10"
                  : "border-border dark:border-border hover:border-border dark:hover:border-border"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-destructive" />
                <div className="text-left">
                  <p className="text-[11px] font-medium text-foreground dark:text-foreground">
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground dark:text-muted-foreground mb-1">
                  Drag and drop a PDF file here, or
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse Files
                </Button>
                <p className="text-[9px] text-muted-foreground dark:text-muted-foreground mt-2">
                  PDF only, max {MAX_FILE_SIZE / (1024 * 1024)}MB
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-[11px] text-destructive bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Carrier Selection */}
          <div className="space-y-1.5">
            <Label className="text-[11px]">
              Carrier <span className="text-destructive">*</span>
            </Label>
            <Select value={carrierId} onValueChange={setCarrierId}>
              <SelectTrigger className="h-8 text-[11px]">
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                {carriersLoading ? (
                  <SelectItem value="_loading" disabled>
                    Loading...
                  </SelectItem>
                ) : carriers && carriers.length > 0 ? (
                  carriers.map((carrier) => (
                    <SelectItem
                      key={carrier.id}
                      value={carrier.id}
                      className="text-[11px]"
                    >
                      {carrier.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="_none" disabled>
                    No carriers available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Guide Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px]">
              Guide Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Prudential Term Life Underwriting Guide 2024"
              className="h-8 text-[11px]"
            />
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Version
              </Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g., 2024.1"
                className="h-7 text-[10px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Effective Date
              </Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="h-7 text-[10px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Expiration Date
              </Label>
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="h-7 text-[10px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="h-7 text-[11px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedFile || !carrierId || !name || uploadMutation.isPending
            }
            className="h-7 text-[11px]"
          >
            {uploadMutation.isPending ? "Uploading..." : "Upload Guide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
