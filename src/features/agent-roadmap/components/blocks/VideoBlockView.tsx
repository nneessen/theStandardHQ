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
      <div className="flex items-start gap-2 rounded-lg border-l-4 border-l-amber-400 border border-v2-ring dark:border-v2-ring bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Unsafe video link
          </div>
          <div className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle mt-0.5">
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
        className="inline-flex items-center gap-2 rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-card px-4 py-2.5 text-sm font-medium text-v2-ink dark:text-v2-ink hover:border-v2-ring-strong dark:hover:border-v2-ring-strong transition-colors"
      >
        <ExternalLink className="h-4 w-4 text-v2-ink-muted dark:text-v2-ink-subtle" />
        {title || "Watch video"}
      </a>
    );
  }

  const parsed = parseVideoUrl(url);
  const embedUrl = parsed.embedUrl;

  if (!embedUrl) {
    return (
      <div className="rounded-lg border-l-4 border-l-amber-400 border border-v2-ring dark:border-v2-ring bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-v2-ink dark:text-v2-ink">
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
    <div className="my-2 rounded-lg overflow-hidden border border-v2-ring dark:border-v2-ring bg-v2-card">
      <div className="relative aspect-video bg-v2-card-tinted dark:bg-v2-card-tinted">
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
        <div className="px-4 py-2.5 text-sm font-medium text-v2-ink dark:text-v2-ink bg-v2-canvas dark:bg-v2-card-tinted/50 border-t border-v2-ring dark:border-v2-ring">
          {title}
        </div>
      )}
    </div>
  );
}
