// src/features/agent-roadmap/components/blocks/ImageBlockEditor.tsx
import { useRef, useState, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDebouncedField } from "@/features/training-modules";
import { roadmapStorage } from "../../services/roadmapStorage";
import type { ImageBlock } from "../../types/contentBlocks";

interface ImageBlockEditorProps {
  block: ImageBlock;
  onChange: (updated: ImageBlock) => void;
  /** Context for storage path: {agencyId}/{roadmapId}/{itemId}/... */
  agencyId: string;
  roadmapId: string;
  itemId: string;
}

export function ImageBlockEditor({
  block,
  onChange,
  agencyId,
  roadmapId,
  itemId,
}: ImageBlockEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const commitAlt = useCallback(
    (alt: string) => {
      onChange({ ...block, data: { ...block.data, alt } });
    },
    [block, onChange],
  );
  const commitCaption = useCallback(
    (caption: string) => {
      onChange({
        ...block,
        data: { ...block.data, caption: caption || undefined },
      });
    },
    [block, onChange],
  );

  const [altLocal, setAltLocal] = useDebouncedField(block.data.alt, commitAlt);
  const [captionLocal, setCaptionLocal] = useDebouncedField(
    block.data.caption ?? "",
    commitCaption,
  );

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    try {
      // If replacing an existing image, delete the old one first (best effort)
      if (block.data.storagePath) {
        await roadmapStorage.deleteImage(block.data.storagePath);
      }

      const { url, storagePath } = await roadmapStorage.uploadImage({
        file,
        agencyId,
        roadmapId,
        itemId,
      });

      onChange({
        ...block,
        data: {
          ...block.data,
          url,
          storagePath,
          alt: block.data.alt || file.name.replace(/\.[^.]+$/, ""),
        },
      });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (block.data.storagePath) {
      await roadmapStorage.deleteImage(block.data.storagePath);
    }
    onChange({
      ...block,
      data: { ...block.data, url: "", storagePath: "", alt: "" },
    });
  }

  const hasImage = !!block.data.url;

  return (
    <div className="space-y-3">
      {hasImage ? (
        <div className="relative inline-block">
          <img
            src={block.data.url}
            alt={block.data.alt}
            className="max-w-full max-h-64 rounded-md border border-zinc-200 dark:border-zinc-800"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemove}
            className="absolute top-2 right-2 h-6 w-6 p-0"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-md hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 mb-2 animate-spin" />
              <span className="text-sm">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 mb-2" />
              <span className="text-sm">Click to upload an image</span>
              <span className="text-xs mt-0.5">
                PNG, JPG, GIF, WEBP up to 10MB
              </span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {hasImage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`alt-${block.id}`} className="text-xs">
              Alt text (required)
            </Label>
            <Input
              id={`alt-${block.id}`}
              value={altLocal}
              onChange={(e) => setAltLocal(e.target.value)}
              placeholder="Describe the image for screen readers"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`caption-${block.id}`} className="text-xs">
              Caption (optional)
            </Label>
            <Input
              id={`caption-${block.id}`}
              value={captionLocal}
              onChange={(e) => setCaptionLocal(e.target.value)}
              placeholder="Shown below the image"
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
