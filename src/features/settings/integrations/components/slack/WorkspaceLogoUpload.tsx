// src/features/settings/integrations/components/slack/WorkspaceLogoUpload.tsx
// Workspace logo upload component for Slack integrations

import { useRef } from "react";
import { Upload, Trash2, Loader2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
// eslint-disable-next-line no-restricted-imports
import {
  useWorkspaceLogoOperations,
  WORKSPACE_LOGO_SIZE,
} from "@/hooks/integrations/useSlackWorkspaceLogo";

interface WorkspaceLogoUploadProps {
  integrationId: string;
  currentLogoUrl: string | null;
  disabled?: boolean;
}

export function WorkspaceLogoUpload({
  integrationId,
  currentLogoUrl,
  disabled = false,
}: WorkspaceLogoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadLogo, isUploading, deleteLogo, isDeleting } =
    useWorkspaceLogoOperations();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadLogo({ integrationId, file });
    } finally {
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!currentLogoUrl) return;
    if (!confirm("Are you sure you want to remove the workspace logo?")) {
      return;
    }
    await deleteLogo({ integrationId, logoUrl: currentLogoUrl });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const isLoading = isUploading || isDeleting;

  return (
    <div className="space-y-2">
      <Label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
        Workspace Logo
      </Label>
      <p className="text-[8px] text-v2-ink-subtle">
        {WORKSPACE_LOGO_SIZE}x{WORKSPACE_LOGO_SIZE} recommended. PNG, JPG, WebP,
        or SVG.
      </p>

      <div className="flex items-center gap-3">
        {currentLogoUrl ? (
          <>
            {/* Logo Preview */}
            <div className="relative w-12 h-12 rounded-lg border border-v2-ring bg-v2-ring overflow-hidden flex-shrink-0">
              <img
                src={currentLogoUrl}
                alt="Workspace logo"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[9px]"
                onClick={handleUploadClick}
                disabled={disabled || isLoading}
              >
                {isUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Upload className="h-3 w-3 mr-1" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-v2-ink-subtle hover:text-red-500"
                onClick={handleDelete}
                disabled={disabled || isLoading}
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Empty State */}
            <div
              className={`w-12 h-12 rounded-lg border-2 border-dashed flex items-center justify-center flex-shrink-0 transition-colors ${
                disabled
                  ? "border-v2-ring bg-v2-canvas"
                  : "border-v2-ring dark:border-v2-ring bg-v2-canvas hover:border-purple-400 dark:hover:border-purple-600 cursor-pointer"
              }`}
              onClick={disabled ? undefined : handleUploadClick}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
              ) : (
                <Image className="h-4 w-4 text-v2-ink-subtle" />
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[9px]"
              onClick={handleUploadClick}
              disabled={disabled || isLoading}
            >
              {isUploading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Upload className="h-3 w-3 mr-1" />
              )}
              Upload Logo
            </Button>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isLoading}
      />
    </div>
  );
}

export default WorkspaceLogoUpload;
