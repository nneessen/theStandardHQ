// src/features/agent-roadmap/components/blocks/VideoBlockView.tsx
import { ExternalLink, AlertTriangle } from "lucide-react";
import type { VideoBlock } from "../../types/contentBlocks";
import { isSafeExternalUrl } from "../../services/contentBlocksValidator";
import { parseVideoUrl } from "../../services/videoUrlParser";

interface VideoBlockViewProps {
  block: VideoBlock;
}

export function VideoBlockView({ block }: VideoBlockViewProps) {
  const { url, platform, title } = block.data;

  // B-1 fix: defense-in-depth scheme check on ALL <a href> paths,
  // matching the pattern in ExternalLinkBlockView. Blocks javascript:,
  // data:, file: URLs even if they somehow slipped past the validator.
  if (url && !isSafeExternalUrl(url)) {
    return (
      <div className="flex items-start gap-2 rounded-lg border-l-4 border-l-amber-400 border border-zinc-200 dark:border-zinc-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Unsafe video link
          </div>
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
            This link uses an unsupported scheme and has been blocked. Ask your
            manager to update it to an http(s) URL.
          </div>
        </div>
      </div>
    );
  }

  // "other" platform falls back to an external link card
  if (platform === "other") {
    return (
      <a
        href={url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
      >
        <ExternalLink className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        {title || "Watch video"}
      </a>
    );
  }

  const parsed = parseVideoUrl(url);
  const embedUrl = parsed.embedUrl;

  if (!embedUrl) {
    return (
      <div className="rounded-lg border-l-4 border-l-amber-400 border border-zinc-200 dark:border-zinc-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
        Unable to embed video.{" "}
        <a
          href={url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80"
        >
          Open externally
        </a>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
        <iframe
          src={embedUrl}
          title={title || "Embedded video"}
          className="absolute inset-0 h-full w-full"
          sandbox="allow-scripts allow-same-origin allow-popups"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {title && (
        <div className="px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800">
          {title}
        </div>
      )}
    </div>
  );
}
