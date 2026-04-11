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
        className="inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {title || "Watch video"}
      </a>
    );
  }

  // Recompute embed URL on render in case the source URL changed
  const parsed = parseVideoUrl(url);
  const embedUrl = parsed.embedUrl;

  if (!embedUrl) {
    return (
      <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
        Unable to embed video.{" "}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Open externally
        </a>
      </div>
    );
  }

  return (
    <div className="my-1 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800">
      <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-900">
        <iframe
          src={embedUrl}
          title={title || "Embedded video"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {title && (
        <div className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800">
          {title}
        </div>
      )}
    </div>
  );
}
