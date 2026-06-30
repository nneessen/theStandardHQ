// src/features/social-studio/components/ReelsPanel.tsx
// Self-contained Reels view: paste a YouTube URL, generate clips, preview + download.

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Board, Cap } from "@/components/board";
import {
  useReelJobs,
  useReelClips,
  useCreateReelJob,
  useDownloadReelClip,
} from "@/hooks/social-studio";
import { ReelClipCard } from "./ReelClipCard";
import type { ReelJob, ReelClip } from "@/types/reel.types";

// ─── Sub-component: renders the clips grid for a ready job ───────────────────

interface JobClipsRowProps {
  job: ReelJob;
  onDownload: (clip: ReelClip) => void;
  downloadingIds: Set<string>;
}

function JobClipsRow({ job, onDownload, downloadingIds }: JobClipsRowProps) {
  const { data: clips = [], isLoading } = useReelClips(
    job.id,
    job.status === "ready",
  );

  if (isLoading) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground">Loading clips…</p>
    );
  }

  if (clips.length === 0) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground">
        No clips found for this job.
      </p>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <ReelClipCard
          key={clip.id}
          clip={clip}
          onDownload={onDownload}
          downloading={downloadingIds.has(clip.id)}
        />
      ))}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

interface ReelsPanelProps {
  imoId?: string;
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateUrl(url: string, max = 60): string {
  try {
    const u = new URL(url);
    const display = u.hostname + u.pathname + u.search;
    return display.length > max ? display.slice(0, max) + "…" : display;
  } catch {
    return url.length > max ? url.slice(0, max) + "…" : url;
  }
}

export function ReelsPanel({ imoId }: ReelsPanelProps) {
  const [url, setUrl] = useState("");
  const [maxClips, setMaxClips] = useState(6);

  const { data: jobs = [], isLoading: jobsLoading } = useReelJobs(imoId);
  const createJob = useCreateReelJob(imoId);
  const { download, downloadingIds } = useDownloadReelClip();

  const isBusy = createJob.isPending;
  const canSubmit = !!url.trim() && !isBusy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await createJob.mutateAsync({ url: url.trim(), maxClipNumber: maxClips });
      setUrl("");
      toast.success(
        "Finding highlights — this can take a few minutes. We'll update the list when they're ready.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't start the reel job.",
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* Generator form */}
      <Board pad={16}>
        <Cap style={{ marginBottom: 10 }}>YouTube → Highlights</Cap>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="reel-url"
                className="mb-1 block text-[11px] font-medium text-foreground"
              >
                YouTube URL
              </label>
              <input
                id="reel-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                disabled={isBusy}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              />
            </div>
            <div className="flex-none">
              <label
                htmlFor="reel-max-clips"
                className="mb-1 block text-[11px] font-medium text-foreground"
              >
                Clips
              </label>
              <select
                id="reel-max-clips"
                value={maxClips}
                onChange={(e) => setMaxClips(Number(e.target.value))}
                disabled={isBusy}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:opacity-50"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              className="flex-none"
            >
              {isBusy ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Starting…
                </>
              ) : (
                "Find highlights"
              )}
            </Button>
          </div>
        </form>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Paste a YouTube link to your own video. We&apos;ll find the best
          vertical clips with captions. Live streams aren&apos;t supported.
          Generated clip links expire after ~7 days — download anything you want
          to keep.
        </p>
      </Board>

      {/* Jobs list */}
      <Board pad={16}>
        <Cap style={{ marginBottom: 10 }}>Your clips</Cap>

        {jobsLoading && (
          <p className="text-[11px] text-muted-foreground">Loading jobs…</p>
        )}

        {!jobsLoading && jobs.length === 0 && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Paste a YouTube link above and click{" "}
            <span className="font-medium text-foreground">Find highlights</span>{" "}
            to get started.
          </p>
        )}

        {jobs.length > 0 && (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-md border border-border bg-card/50 p-3"
              >
                {/* Job header row */}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={job.source_url}
                    className="flex items-center gap-1 truncate text-[11px] font-medium text-accent hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 flex-none" />
                    {truncateUrl(job.source_url)}
                  </a>
                  <StatusPill status={job.status} />
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {formatCreatedAt(job.created_at)}
                  </span>
                  {job.status === "ready" && job.clip_count > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {job.clip_count} clip{job.clip_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Error detail */}
                {job.status === "failed" && job.error && (
                  <p className="mt-1 text-[10px] text-destructive">
                    {job.error}
                  </p>
                )}

                {/* Processing hint */}
                {job.status === "processing" && (
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Finding highlights… this can take a few minutes.
                  </p>
                )}

                {/* Clips grid — only when ready */}
                {job.status === "ready" && (
                  <JobClipsRow
                    job={job}
                    onDownload={download}
                    downloadingIds={downloadingIds}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Board>
    </div>
  );
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "ready"
      ? "bg-success/15 text-success"
      : status === "failed"
        ? "bg-destructive/15 text-destructive"
        : "bg-accent/15 text-accent";
  const label =
    status === "ready"
      ? "Ready"
      : status === "failed"
        ? "Failed"
        : "Processing";
  return (
    <span className={`rounded-full px-1.5 py-0 text-[9px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
