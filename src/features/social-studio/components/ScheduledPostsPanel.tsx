// src/features/social-studio/components/ScheduledPostsPanel.tsx
// The agency's queue of scheduled Instagram posts (Social Studio). Live data via
// useScheduledPosts; pending rows can be cancelled (deletes the row + GCs the image).
// Rendered only when an Instagram account is connected.

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useScheduledPosts, useCancelScheduledPost } from "@/hooks/instagram";
import type { ScheduledPostStatus } from "@/types/instagram.types";

const STATUS_LABEL: Record<ScheduledPostStatus, string> = {
  pending: "Scheduled",
  published: "Posted",
  failed: "Failed",
  expired: "Expired",
};

const VIEW_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  aotw: "Agent of the Week",
};

function labelView(v: string | null): string {
  return v ? (VIEW_LABEL[v] ?? v) : "Post";
}

function labelTheme(t: string | null): string {
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScheduledPostsPanel({ imoId }: { imoId: string | null }) {
  const { data: posts = [], isLoading } = useScheduledPosts(imoId ?? undefined);
  const cancel = useCancelScheduledPost(imoId ?? undefined);

  if (!imoId) return null;

  if (isLoading) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Loading scheduled posts…
      </p>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="text-[11px] leading-snug text-muted-foreground">
        Nothing scheduled yet. Use{" "}
        <span className="font-medium text-foreground">Schedule</span> above to
        queue this graphic for later.
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="scheduled-posts-list">
      {posts.map((p) => {
        const bad = p.status === "failed" || p.status === "expired";
        return (
          <li
            key={p.id}
            data-status={p.status}
            className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 p-2"
          >
            <img
              src={p.image_url}
              alt=""
              className="h-12 w-12 flex-none rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-foreground">
                  {formatWhen(p.scheduled_for)}
                </span>
                <span
                  className={`flex-none rounded-full px-1.5 py-0 text-[9px] font-medium ${
                    bad
                      ? "bg-destructive/15 text-destructive"
                      : p.status === "published"
                        ? "bg-success/15 text-success"
                        : "bg-accent/15 text-accent"
                  }`}
                >
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              <p className="truncate text-[10px] text-muted-foreground">
                {labelView(p.view)}
                {p.card_theme ? ` · ${labelTheme(p.card_theme)}` : ""}
                {bad && p.last_error ? ` · ${p.last_error}` : ""}
              </p>
            </div>
            {p.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 flex-none px-2 text-muted-foreground hover:text-destructive"
                disabled={cancel.isPending}
                title="Cancel this scheduled post"
                onClick={() =>
                  cancel.mutate(p.id, {
                    onSuccess: () => toast.success("Scheduled post cancelled"),
                    onError: (e) =>
                      toast.error(
                        e instanceof Error
                          ? e.message
                          : "Couldn't cancel the post.",
                      ),
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
