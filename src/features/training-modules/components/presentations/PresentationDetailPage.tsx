// src/features/training-modules/components/presentations/PresentationDetailPage.tsx
import { useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  FileVideo,
  FileAudio,
  Calendar,
  Clock,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  usePresentationSubmission,
  useDeletePresentation,
} from "../../hooks/usePresentationSubmissions";
import { useCanManageTraining } from "../../hooks/useCanManageTraining";
import { usePresentationMarkers } from "../../hooks/usePresentationMarkers";
import {
  PresentationMediaPlayer,
  type MediaPlayerHandle,
} from "./PresentationMediaPlayer";
import { PresentationMarkersPanel } from "./PresentationMarkersPanel";
import { PresentationStatusBadge } from "./PresentationStatusBadge";
import { PresentationReviewPanel } from "./PresentationReviewPanel";
import { toast } from "sonner";

export default function PresentationDetailPage() {
  const { submissionId } = useParams({ strict: false }) as {
    submissionId: string;
  };
  const navigate = useNavigate();
  const { data: submission, isLoading } =
    usePresentationSubmission(submissionId);
  const { data: markers = [], isLoading: markersLoading } =
    usePresentationMarkers(submissionId);
  const canManage = useCanManageTraining();
  const deleteMutation = useDeletePresentation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<MediaPlayerHandle>(null);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-zinc-50/40 dark:bg-zinc-950">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-2 bg-zinc-50/40 dark:bg-zinc-950">
        <p className="text-xs text-zinc-500">Submission not found</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => navigate({ to: "/my-training" })}
        >
          Back to My Training
        </Button>
      </div>
    );
  }

  const handleDelete = () => {
    deleteMutation.mutate(submission.id, {
      onSuccess: () => {
        toast.success("Submission deleted");
        navigate({ to: "/my-training" });
      },
      onError: (err) => {
        toast.error(`Failed to delete: ${err.message}`);
      },
    });
  };

  const submitterName = submission.submitter
    ? `${submission.submitter.first_name} ${submission.submitter.last_name}`
    : "Unknown";

  const isAudio = submission.mime_type?.startsWith("audio/");
  const FileIcon = isAudio ? FileAudio : FileVideo;
  const fileIconColor = isAudio
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-blue-500 dark:text-blue-400";

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-zinc-50/60 dark:bg-zinc-950">
      {/* Header (raised white card) */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigate({ to: "/my-training" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className={`p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 ${fileIconColor}`}
          >
            <FileIcon className="h-3.5 w-3.5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
              {submission.title}
            </h1>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              by {submitterName} &middot; Week of{" "}
              {new Date(submission.week_start + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" },
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PresentationStatusBadge status={submission.status} />
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-400 hover:text-red-500"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content (subtle off-white page bg) */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Left column: player + description + metadata + review */}
          <div className="space-y-4 min-w-0">
            <PresentationMediaPlayer
              ref={playerRef}
              storagePath={submission.storage_path}
              mimeType={submission.mime_type}
              markers={markers}
              onTimeUpdate={setCurrentTime}
            />

            {submission.description && (
              <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                <header className="px-3 py-2 bg-zinc-50/80 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                    Description
                  </h3>
                </header>
                <p className="px-3 py-2.5 text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {submission.description}
                </p>
              </section>
            )}

            {/* Metadata strip */}
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-100 dark:divide-zinc-800/50">
                <MetaCell
                  icon={<FileIcon className={`h-3 w-3 ${fileIconColor}`} />}
                  label="Type"
                  value={
                    submission.recording_type === "browser_recording"
                      ? "Recorded"
                      : "Uploaded"
                  }
                />
                <MetaCell
                  icon={<HardDrive className="h-3 w-3 text-zinc-400" />}
                  label="Size"
                  value={`${(submission.file_size / (1024 * 1024)).toFixed(1)} MB`}
                />
                {submission.duration_seconds ? (
                  <MetaCell
                    icon={<Clock className="h-3 w-3 text-zinc-400" />}
                    label="Duration"
                    value={`${Math.floor(submission.duration_seconds / 60)}:${(submission.duration_seconds % 60).toString().padStart(2, "0")}`}
                  />
                ) : (
                  <MetaCell
                    icon={<Clock className="h-3 w-3 text-zinc-400" />}
                    label="Duration"
                    value="—"
                  />
                )}
                <MetaCell
                  icon={<Calendar className="h-3 w-3 text-zinc-400" />}
                  label="Submitted"
                  value={new Date(submission.created_at).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                    },
                  )}
                />
              </div>
            </section>

            {(canManage || submission.status !== "pending") && (
              <PresentationReviewPanel
                submission={submission}
                onReviewed={() => navigate({ to: "/my-training" })}
              />
            )}
          </div>

          {/* Right column: markers panel (sticky on desktop) */}
          <aside className="lg:sticky lg:top-0 self-start">
            <PresentationMarkersPanel
              submissionId={submissionId}
              markers={markers}
              isLoading={markersLoading}
              currentTime={currentTime}
              onSeek={(t) => playerRef.current?.seek(t)}
              getCurrentTime={() => playerRef.current?.getCurrentTime() ?? 0}
              pause={() => playerRef.current?.pause()}
            />
          </aside>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Presentation</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this presentation submission? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface MetaCellProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetaCell({ icon, label, value }: MetaCellProps) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
        {value}
      </p>
    </div>
  );
}
