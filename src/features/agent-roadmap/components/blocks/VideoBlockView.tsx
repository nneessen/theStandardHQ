// src/features/agent-roadmap/components/blocks/VideoBlockView.tsx
import { ExternalLink } from "lucide-react";
import type { VideoBlock } from "../../types/contentBlocks";
import { parseVideoUrl } from "../../services/videoUrlParser";

interface VideoBlockViewProps {
  block: VideoBlock;
}

export function VideoBlockView({ block }: VideoBlockViewProps) {
  const { url, platform, title } = block.data;

  // "other" platform falls back to an external link card rather than attempting
  // to embed a random URL (security + UX)
  if (platform === "other") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-ring hover:bg-accent hover:shadow-md active:shadow-sm"
      >
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
        {title || "Watch video"}
      </a>
    );
  }

  // Recompute embed URL on render in case the source URL changed
  const parsed = parseVideoUrl(url);
  const embedUrl = parsed.embedUrl;

  if (!embedUrl) {
    return (
      <div className="rounded-md border-l-4 border-l-warning border border-border bg-warning/5 px-4 py-3 text-sm text-foreground shadow-sm">
        Unable to embed video.{" "}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-info underline underline-offset-2 hover:opacity-80"
        >
          Open externally
        </a>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border bg-card shadow-sm">
      <div className="relative aspect-video bg-muted">
        <iframe
          src={embedUrl}
          title={title || "Embedded video"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {title && (
        <div className="px-4 py-2.5 text-sm font-medium text-foreground bg-muted/50 border-t border-border">
          {title}
        </div>
      )}
    </div>
  );
}
