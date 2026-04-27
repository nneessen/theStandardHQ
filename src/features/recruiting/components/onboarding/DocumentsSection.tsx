import { FileText } from "lucide-react";
import { DocumentManager } from "../DocumentManager";
import type { UserDocument } from "@/types/recruiting.types";
import { EditorialSection } from "../editorial";

interface DocumentsSectionProps {
  userId: string;
  documents?: UserDocument[];
  isUpline?: boolean;
  currentUserId: string;
}

export function DocumentsSection({
  userId,
  documents,
  isUpline = false,
  currentUserId,
}: DocumentsSectionProps) {
  const uploadedCount =
    documents?.filter((d) => d.storage_path || d.status === "approved")
      ?.length || 0;
  const totalCount = documents?.length || 0;

  const allUploaded = totalCount > 0 && uploadedCount === totalCount;
  const rightSlot =
    totalCount > 0 ? (
      <span
        className={
          allUploaded
            ? "inline-flex items-center font-mono tabular-nums text-[11px] uppercase tracking-[0.16em] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900 rounded-full px-2.5 py-1"
            : "inline-flex items-center font-mono tabular-nums text-[11px] uppercase tracking-[0.16em] font-bold text-v2-ink dark:text-v2-ink-subtle bg-v2-ring dark:bg-v2-ring ring-1 ring-v2-ring  rounded-full px-2.5 py-1"
        }
      >
        {uploadedCount} / {totalCount} uploaded
      </span>
    ) : null;

  return (
    <EditorialSection
      icon={FileText}
      iconTone="brand"
      eyebrow="Documents"
      title="What we need from you"
      caption="Upload the items below as you receive them. Your recruiter is notified each time something lands."
      rightSlot={rightSlot}
    >
      {(!documents || documents.length === 0) && (
        <p className="text-[13px] text-v2-ink-muted dark:text-v2-ink-subtle">
          No documents required yet — they will appear here once your recruiter
          adds them to your phase.
        </p>
      )}

      {documents && documents.length > 0 && (
        <DocumentManager
          userId={userId}
          documents={documents}
          isUpline={isUpline}
          currentUserId={currentUserId}
        />
      )}
    </EditorialSection>
  );
}
