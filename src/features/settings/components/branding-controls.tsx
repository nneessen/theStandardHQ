// Shared recruiting-branding controls.
// Logic-heavy inputs reused by the guided recruiting-page wizard (and anywhere
// else branding is edited): a validated color picker with presets, and an
// image upload/preview/delete field. Extracted so callers reuse the behavior
// (native color input, hex validation, upload flow) rather than re-implementing
// it. Layout density around these stays the caller's concern.

import { Loader2, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { COLOR_PRESETS } from "@/types/recruiting-theme.types";
import { isValidHexColor } from "@/lib/recruiting-validation";

/**
 * Color picker with preset swatches, a native color input, and hex validation.
 */
export function ColorPicker({
  label,
  value,
  onChange,
  presets,
  error,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  presets: typeof COLOR_PRESETS.primary;
  error?: string;
}) {
  const isValid = isValidHexColor(value);

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <div
          className={`h-10 w-10 cursor-pointer rounded-md border ${
            isValid ? "border-border" : "border-destructive"
          }`}
          style={{ backgroundColor: isValid ? value : "#ccc" }}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "color";
            input.value = isValid ? value : "#000000";
            input.onchange = (e) =>
              onChange((e.target as HTMLInputElement).value);
            input.click();
          }}
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className={`h-10 w-28 font-mono text-sm ${
            !isValid ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
        />
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className="h-6 w-6 rounded border border-border ring-ring transition-all hover:ring-2"
            style={{ backgroundColor: preset.value }}
            title={preset.name}
            onClick={() => onChange(preset.value)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Image upload field with preview + delete. Caller owns the upload/delete
 * side effects (service calls); this only renders state.
 */
export function ImageUpload({
  label,
  description,
  value,
  onUpload,
  onDelete,
  isUploading,
  accept = "image/*",
}: {
  label: string;
  description: string;
  value: string | null;
  onUpload: (file: File) => void;
  onDelete: () => void;
  isUploading: boolean;
  accept?: string;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <p className="text-[11px] text-muted-foreground">{description}</p>

      {value ? (
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-muted">
            <img
              src={value}
              alt={label}
              className="h-full w-full object-contain"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-9 text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Remove
          </Button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer">
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 transition-colors hover:border-primary">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {isUploading ? "Uploading…" : "Upload image"}
            </span>
          </div>
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  );
}
