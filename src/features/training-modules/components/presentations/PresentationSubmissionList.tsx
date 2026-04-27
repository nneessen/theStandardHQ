// src/features/training-modules/components/presentations/PresentationSubmissionList.tsx
import { useNavigate } from "@tanstack/react-router";
import { Video, Loader2 } from "lucide-react";
import { usePresentationSubmissions } from "../../hooks/usePresentationSubmissions";
import { PresentationStatusBadge } from "./PresentationStatusBadge";
import type {
  PresentationSubmissionFilters,
  PresentationSubmission,
} from "../../types/training-module.types";

interface PresentationSubmissionListProps {
  filters?: PresentationSubmissionFilters;
  showSubmitter?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PresentationSubmissionList({
  filters,
  showSubmitter,
}: PresentationSubmissionListProps) {
  const {
    data: submissions = [],
    isLoading,
    error,
  } = usePresentationSubmissions(filters);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-red-500">Failed to load submissions</p>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8">
        <Video className="h-5 w-5 mx-auto mb-2 text-v2-ink-subtle dark:text-v2-ink-muted" />
        <p className="text-xs text-v2-ink-subtle">
          No presentations submitted yet
        </p>
      </div>
    );
  }

  return (
    <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-v2-canvas dark:bg-v2-card-tinted/50 border-b border-v2-ring dark:border-v2-ring-strong">
            <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
              Title
            </th>
            {showSubmitter && (
              <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
                Agent
              </th>
            )}
            <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
              Week
            </th>
            <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
              Type
            </th>
            <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
              Size
            </th>
            <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
              Status
            </th>
            <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
              Submitted
            </th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((sub: PresentationSubmission) => (
            <tr
              key={sub.id}
              onClick={() =>
                navigate({
                  to: "/my-training/presentations/$submissionId",
                  params: { submissionId: sub.id },
                })
              }
              className="border-b border-v2-ring dark:border-v2-ring hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30 cursor-pointer transition-colors"
            >
              <td className="px-3 py-2 font-medium text-v2-ink dark:text-v2-ink">
                {sub.title}
              </td>
              {showSubmitter && (
                <td className="px-3 py-2 text-v2-ink-muted dark:text-v2-ink-subtle">
                  {sub.submitter
                    ? `${sub.submitter.first_name} ${sub.submitter.last_name}`
                    : "Unknown"}
                </td>
              )}
              <td className="px-3 py-2 text-v2-ink-muted">
                {formatDate(sub.week_start)}
              </td>
              <td className="px-3 py-2 text-v2-ink-muted capitalize">
                {sub.recording_type === "browser_recording"
                  ? "Recording"
                  : "Upload"}
              </td>
              <td className="px-3 py-2 text-v2-ink-muted">
                {formatSize(sub.file_size)}
              </td>
              <td className="px-3 py-2">
                <PresentationStatusBadge status={sub.status} />
              </td>
              <td className="px-3 py-2 text-v2-ink-muted">
                {formatDate(sub.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
