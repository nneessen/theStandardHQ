// src/features/agent-roadmap/components/blocks/ExternalLinkBlockView.tsx
import { ExternalLink, AlertTriangle } from "lucide-react";
import type { ExternalLinkBlock } from "../../types/contentBlocks";
import { isSafeExternalUrl } from "../../services/contentBlocksValidator";

interface ExternalLinkBlockViewProps {
  block: ExternalLinkBlock;
}

export function ExternalLinkBlockView({ block }: ExternalLinkBlockViewProps) {
  const { url, label, description } = block.data;

  // Defense-in-depth: never render an <a href> with a non-http(s) URL, even if
  // one somehow slipped past the validator. This blocks stored javascript:/data:/
  // file: XSS if an older block exists from before the validator was tightened.
  if (url !== "" && !isSafeExternalUrl(url)) {
    return (
      <div className="flex items-start gap-3 rounded-lg border-l-4 border-l-warning border border-border bg-warning/5 px-4 py-3 shadow-sm">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-warning" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {label || "Unsafe link"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            This link uses an unsupported scheme and has been blocked. Ask Nick
            to update it to an http(s) URL.
          </div>
        </div>
      </div>
    );
  }

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-all hover:border-ring hover:bg-accent hover:shadow-md active:shadow-sm"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground transition-colors">
        <ExternalLink className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground group-hover:underline underline-offset-2 truncate">
          {label}
        </div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {description}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground/70 mt-1 truncate font-mono">
          {url}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1 group-hover:text-foreground transition-colors" />
    </a>
  );
}
