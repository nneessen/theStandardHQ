// src/features/training-modules/components/presentations/PresentationUploader.tsx
import { useCallback, useRef, useState } from "react";
import { Upload, X, FileVideo, FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";

const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
];
const VIDEO_TYPES = ["video/webm", "video/mp4", "video/quicktime"];
const ALLOWED_TYPES = [...AUDIO_TYPES, ...VIDEO_TYPES];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

interface PresentationUploaderProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PresentationUploader({
  onFileSelected,
  selectedFile,
  onClear,
}: PresentationUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((file: File): boolean => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Unsupported file type. Use MP3, WAV, MP4, WebM, or MOV.");
      return false;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(
        `File too large. Maximum size is ${formatSize(MAX_SIZE_BYTES)}.`,
      );
      return false;
    }
    return true;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (validate(file)) {
        onFileSelected(file);
      }
    },
    [validate, onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (selectedFile) {
    const isAudio = AUDIO_TYPES.includes(selectedFile.type);
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-v2-ring dark:border-v2-ring-strong bg-v2-canvas dark:bg-v2-card-tinted/50">
        {isAudio ? (
          <FileAudio className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        ) : (
          <FileVideo className="h-4 w-4 text-blue-500 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{selectedFile.name}</p>
          <p className="text-[10px] text-v2-ink-muted">
            {formatSize(selectedFile.size)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClear}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
            : "border-v2-ring-strong dark:border-v2-ring-strong hover:border-v2-ring-strong dark:hover:border-v2-ring-strong"
        }`}
      >
        <Upload className="h-5 w-5 mx-auto mb-2 text-v2-ink-subtle" />
        <p className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle">
          Drop an audio or video file here or click to browse
        </p>
        <p className="text-[10px] text-v2-ink-subtle mt-1">
          MP3, WAV, OGG &middot; MP4, WebM, MOV &middot; Max 500MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
