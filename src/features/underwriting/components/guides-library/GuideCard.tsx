import { useState } from "react";
import { ExternalLink, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/v2";
import { openGuidePdf } from "../../hooks/guides/useUnderwritingGuides";
import type { GuideWithCarrier } from "./groupGuidesByCarrier";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface GuideCardProps {
  guide: GuideWithCarrier;
  canManage: boolean;
  onDelete: (guide: GuideWithCarrier) => void;
}

export function GuideCard({ guide, canManage, onDelete }: GuideCardProps) {
  const [opening, setOpening] = useState(false);
  const dateLabel = formatDate(guide.created_at);

  const handleView = async () => {
    setOpening(true);
    try {
      await openGuidePdf(guide.storage_path);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not open this PDF.",
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-v2-ring bg-v2-card p-3 transition-colors hover:border-v2-ring/70">
      <div className="flex min-w-0 items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-v2-ink-muted" />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[13px] font-semibold text-v2-ink"
            title={guide.name}
          >
            {guide.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-v2-ink-muted">
            {guide.version ? (
              <span className="rounded bg-v2-card-tinted px-1.5 py-0.5 font-mono text-[10px] text-v2-ink">
                {guide.version}
              </span>
            ) : null}
            <span className="tabular-nums">
              {formatBytes(guide.file_size_bytes)}
            </span>
            {dateLabel ? (
              <>
                <span aria-hidden>·</span>
                <span>{dateLabel}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <PillButton
          tone="ghost"
          size="sm"
          onClick={handleView}
          disabled={opening}
          leadingIcon={
            opening ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )
          }
        >
          {opening ? "Opening…" : "View"}
        </PillButton>

        {canManage ? (
          <button
            type="button"
            onClick={() => onDelete(guide)}
            title="Delete guide"
            aria-label={`Delete ${guide.name}`}
            className="rounded p-1.5 text-v2-ink-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
