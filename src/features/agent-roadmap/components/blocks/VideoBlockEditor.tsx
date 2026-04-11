// src/features/agent-roadmap/components/blocks/VideoBlockEditor.tsx
import { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedField } from "@/features/training-modules";
import { parseVideoUrl } from "../../services/videoUrlParser";
import type { VideoBlock } from "../../types/contentBlocks";
import { VideoBlockView } from "./VideoBlockView";

interface VideoBlockEditorProps {
  block: VideoBlock;
  onChange: (updated: VideoBlock) => void;
}

export function VideoBlockEditor({ block, onChange }: VideoBlockEditorProps) {
  const commitUrl = useCallback(
    (url: string) => {
      const parsed = parseVideoUrl(url);
      onChange({
        ...block,
        data: {
          ...block.data,
          url,
          platform: parsed.platform,
        },
      });
    },
    [block, onChange],
  );

  const commitTitle = useCallback(
    (title: string) => {
      onChange({
        ...block,
        data: { ...block.data, title: title || undefined },
      });
    },
    [block, onChange],
  );

  const [urlLocal, setUrlLocal] = useDebouncedField(block.data.url, commitUrl);
  const [titleLocal, setTitleLocal] = useDebouncedField(
    block.data.title ?? "",
    commitTitle,
  );

  const detectedPlatform = useMemo(
    () => parseVideoUrl(urlLocal).platform,
    [urlLocal],
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor={`url-${block.id}`} className="text-xs">
            Video URL
          </Label>
          {detectedPlatform !== "other" && urlLocal && (
            <Badge variant="secondary" className="text-[10px] capitalize">
              {detectedPlatform}
            </Badge>
          )}
        </div>
        <Input
          id={`url-${block.id}`}
          value={urlLocal}
          onChange={(e) => setUrlLocal(e.target.value)}
          placeholder="Paste YouTube, Vimeo, or Loom URL"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`title-${block.id}`} className="text-xs">
          Title (optional)
        </Label>
        <Input
          id={`title-${block.id}`}
          value={titleLocal}
          onChange={(e) => setTitleLocal(e.target.value)}
          placeholder="e.g. 'How to set up Close CRM'"
          className="h-8 text-sm"
        />
      </div>

      {block.data.url && <VideoBlockView block={block} />}
    </div>
  );
}
