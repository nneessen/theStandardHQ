// src/features/recruiting/admin/VideoItemConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { PlayCircle, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  VideoEmbedMetadata,
  VideoPlatform,
} from "@/types/recruiting.types";
import {
  VIDEO_PLATFORM_LABELS,
  VIDEO_PLATFORM_PLACEHOLDERS,
} from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { videoEmbedService } from "@/services/recruiting/videoEmbedService";
import { createVideoMetadata } from "@/types/checklist-metadata.types";

interface VideoItemConfigProps {
  metadata: VideoEmbedMetadata | null;
  onChange: (metadata: VideoEmbedMetadata & { _type: "video_embed" }) => void;
}

export function VideoItemConfig({ metadata, onChange }: VideoItemConfigProps) {
  const [platform, setPlatform] = useState<VideoPlatform>(
    metadata?.platform ?? "youtube",
  );
  const [videoUrl, setVideoUrl] = useState(metadata?.video_url ?? "");
  const [title, setTitle] = useState(metadata?.title ?? "");
  const [requireFullWatch, setRequireFullWatch] = useState(
    metadata?.require_full_watch ?? false,
  );
  const [autoComplete, setAutoComplete] = useState(
    metadata?.auto_complete ?? false,
  );
  const [urlError, setUrlError] = useState<string | null>(null);

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    // Validate and extract video ID
    const validation = videoEmbedService.validateVideoUrl(videoUrl);

    if (!videoUrl) {
      // Empty URL is OK during initial setup
      return;
    }

    if (!validation.valid) {
      setUrlError(validation.error || "Invalid video URL");
      return;
    }

    // Auto-detect platform if URL is valid
    const detectedPlatform = videoEmbedService.detectPlatform(videoUrl);
    if (detectedPlatform && detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }

    const videoId = videoEmbedService.extractVideoId(
      videoUrl,
      detectedPlatform || platform,
    );

    if (!videoId) {
      setUrlError("Could not extract video ID from URL");
      return;
    }

    setUrlError(null);

    const videoData: VideoEmbedMetadata = {
      platform: detectedPlatform || platform,
      video_url: videoUrl,
      video_id: videoId,
      title: title || undefined,
      require_full_watch: requireFullWatch,
      auto_complete: autoComplete,
    };

    const newMetadata = createVideoMetadata(videoData);

    const metadataString = JSON.stringify(newMetadata);
    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [platform, videoUrl, title, requireFullWatch, autoComplete]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
    // Auto-detect platform
    if (url) {
      const detected = videoEmbedService.detectPlatform(url);
      if (detected) {
        setPlatform(detected);
      }
    }
  };

  return (
    <div className="space-y-3 p-2.5 bg-background rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Video Configuration
        </span>
      </div>

      {/* Platform Selector */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Platform
        </Label>
        <Select
          value={platform}
          onValueChange={(value: VideoPlatform) => setPlatform(value)}
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="youtube" className="text-[11px]">
              {VIDEO_PLATFORM_LABELS.youtube}
            </SelectItem>
            <SelectItem value="vimeo" className="text-[11px]">
              {VIDEO_PLATFORM_LABELS.vimeo}
            </SelectItem>
            <SelectItem value="loom" className="text-[11px]">
              {VIDEO_PLATFORM_LABELS.loom}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Video URL */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Video URL
        </Label>
        <Input
          type="url"
          value={videoUrl}
          onChange={(e) => handleVideoUrlChange(e.target.value)}
          placeholder={VIDEO_PLATFORM_PLACEHOLDERS[platform]}
          className="h-7 text-[11px]"
        />
        {urlError && (
          <div className="flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            {urlError}
          </div>
        )}
        <p className="text-[9px] text-muted-foreground">
          Platform will be auto-detected from URL
        </p>
      </div>

      {/* Optional Title */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Video Title (Optional)
        </Label>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Product Training Module 1"
          className="h-7 text-[11px]"
        />
      </div>

      {/* Require Full Watch */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Require Full Watch
          </Label>
          <p className="text-[9px] text-muted-foreground">
            Track progress and require 95%+ completion
          </p>
        </div>
        <Switch
          checked={requireFullWatch}
          onCheckedChange={setRequireFullWatch}
          className="scale-75"
        />
      </div>

      {/* Auto Complete */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Auto-Complete on Finish
          </Label>
          <p className="text-[9px] text-muted-foreground">
            Automatically mark item as complete when video ends
          </p>
        </div>
        <Switch
          checked={autoComplete}
          onCheckedChange={setAutoComplete}
          className="scale-75"
        />
      </div>

      {/* Note about platforms */}
      <div className="p-2 bg-info/10 rounded border border-info/30">
        <p className="text-[9px] text-info">
          <strong>Note:</strong> YouTube and Vimeo support progress tracking.
          Loom requires manual completion.
        </p>
      </div>
    </div>
  );
}
