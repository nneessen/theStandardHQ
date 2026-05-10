import { useRef, useState } from "react";
import { Upload, FileText, X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadGuide, useParseGuide } from "./useUnderwritingAdmin";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface UploadDropZoneProps {
  carrierId: string;
}

export function UploadDropZone({ carrierId }: UploadDropZoneProps) {
  const upload = useUploadGuide();
  const parse = useParseGuide();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const reset = () => {
    setFile(null);
    setName("");
    setVersion("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = (f: File): string | null => {
    if (f.type !== "application/pdf") return "Only PDF files are allowed";
    if (f.size > MAX_FILE_SIZE)
      return `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
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

  const submit = async () => {
    if (!file || !name) {
      setError("Pick a file and enter a name.");
      return;
    }
    try {
      const guide = await upload.mutateAsync({
        carrierId,
        name,
        file,
        version: version || undefined,
      });
      // fire-and-forget parse so the user doesn't have to click again
      parse.mutate({ guideId: guide.id, storagePath: guide.storage_path });
      reset();
    } catch {
      // error toast handled by mutation
    }
  };

  const isWorking = upload.isPending;

  return (
    <div className="border border-dashed border-v2-ring rounded-md p-3 bg-v2-card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold text-v2-ink">
          Upload UW guide
        </div>
        <div className="text-[10px] text-v2-ink-muted">PDF · max 50MB</div>
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
          className={`cursor-pointer rounded-md border-2 border-dashed px-3 py-6 text-center text-[11px] ${
            drag
              ? "border-info bg-info/10 text-v2-ink"
              : "border-v2-ring/60 text-v2-ink-muted hover:border-v2-ring hover:text-v2-ink"
          }`}
        >
          <Upload className="h-4 w-4 mx-auto mb-1" />
          Drop PDF here or click to browse
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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-v2-card-tinted text-[11px]">
            <div className="flex items-center gap-1.5 truncate">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="text-v2-ink-muted shrink-0">
                · {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            <button
              type="button"
              className="text-v2-ink-muted hover:text-v2-ink"
              onClick={reset}
              disabled={isWorking}
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Name</Label>
              <Input
                className="h-7 text-[11px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Term Made Simple v2024"
              />
            </div>
            <div>
              <Label className="text-[10px]">Version (optional)</Label>
              <Input
                className="h-7 text-[11px]"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="2024.01"
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-1 text-[10px] text-destructive">
              <AlertCircle className="h-3 w-3" /> {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={submit}
              disabled={isWorking || !name}
              className="h-7 text-[11px]"
            >
              {isWorking ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading
                </>
              ) : (
                "Upload + parse"
              )}
            </Button>
          </div>
        </div>
      )}

      {!file && error ? (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-destructive">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      ) : null}
    </div>
  );
}
