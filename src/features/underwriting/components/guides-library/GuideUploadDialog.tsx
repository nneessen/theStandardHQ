import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCarriers } from "@/hooks/carriers";
import { useUploadGuide } from "../../hooks/guides/useUnderwritingGuides";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface GuideUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected carrier when opened from a carrier section's "Add" button. */
  presetCarrierId?: string | null;
}

export function GuideUploadDialog({
  open,
  onOpenChange,
  presetCarrierId,
}: GuideUploadDialogProps) {
  const { data: carriers, isLoading: carriersLoading } = useCarriers();
  const upload = useUploadGuide();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [carrierId, setCarrierId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  // Reset the form whenever the dialog opens, seeding the carrier if provided.
  useEffect(() => {
    if (!open) return;
    setCarrierId(presetCarrierId ?? "");
    setFile(null);
    setName("");
    setVersion("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, presetCarrierId]);

  const sortedCarriers = useMemo(
    () =>
      [...(carriers ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [carriers],
  );

  const validate = (f: File): string | null => {
    if (f.type !== "application/pdf") return "Only PDF files are allowed.";
    if (f.size > MAX_FILE_SIZE)
      return `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
    return null;
  };

  const accept = (f: File) => {
    const v = validate(f);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setFile(f);
    if (!name) setName(f.name.replace(/\.pdf$/i, ""));
  };

  const isWorking = upload.isPending;
  const canSubmit = !!carrierId && !!file && !!name.trim() && !isWorking;

  const submit = async () => {
    if (!carrierId) {
      setError("Pick a carrier.");
      return;
    }
    if (!file || !name.trim()) {
      setError("Pick a PDF and enter a name.");
      return;
    }
    try {
      await upload.mutateAsync({
        carrierId,
        name: name.trim(),
        file,
        version: version.trim() || undefined,
      });
      onOpenChange(false);
    } catch {
      // Failure toast is surfaced by the mutation's onError.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isWorking) onOpenChange(o);
      }}
    >
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Add underwriting guide</DialogTitle>
          <DialogDescription>
            Upload a carrier underwriting guide PDF (max 50MB). It becomes
            visible to everyone in your IMO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Carrier</Label>
            <Select
              value={carrierId}
              onValueChange={setCarrierId}
              disabled={isWorking || carriersLoading}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue
                  placeholder={
                    carriersLoading ? "Loading carriers…" : "Select a carrier"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {sortedCarriers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) accept(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-md border-2 border-dashed px-3 py-8 text-center text-xs transition-colors ${
                drag
                  ? "border-info bg-info/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <Upload className="mx-auto mb-1.5 h-5 w-5" />
              Drop a PDF here or click to browse
              <Input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) accept(f);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-2 text-xs">
              <div className="flex min-w-0 items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  · {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isWorking}
                aria-label="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                className="h-8 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Term UW Guide 2026"
                disabled={isWorking}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Version (optional)</Label>
              <Input
                className="h-8 text-sm"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. v2 / 2026.01"
                disabled={isWorking}
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isWorking}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {isWorking ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
