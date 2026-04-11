// src/features/agent-roadmap/components/blocks/ExternalLinkBlockView.tsx
import { ExternalLink } from "lucide-react";
import type { ExternalLinkBlock } from "../../types/contentBlocks";

interface ExternalLinkBlockViewProps {
  block: ExternalLinkBlock;
}

export function ExternalLinkBlockView({ block }: ExternalLinkBlockViewProps) {
  const { url, label, description, favicon } = block.data;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
    >
      {favicon ? (
        <img
          src={favicon}
          alt=""
          className="h-4 w-4 mt-0.5 rounded-sm"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <ExternalLink className="h-4 w-4 mt-0.5 text-zinc-500 dark:text-zinc-400" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:underline truncate">
          {label}
        </div>
        {description && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
            {description}
          </div>
        )}
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
          {url}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0 mt-1 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
    </a>
  );
}
