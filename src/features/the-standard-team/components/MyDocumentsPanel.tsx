// src/features/the-standard-team/components/MyDocumentsPanel.tsx
// Body-only panel for the Licensing hub "My Documents" tab. Self-service vault
// for an agent's own license PDFs and carrier contracts. Reuses the existing
// user-documents infrastructure (storage bucket, RLS, dialogs, hooks) pointed at
// the current user.

import { useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Download,
  Trash2,
  Eye,
  FileText,
  FolderOpen,
  Lock,
  Loader2,
} from "lucide-react";
import { Board, Cap, EmptyState, Pill, T } from "@/components/board";
import { Button } from "@/components/ui/button";
import { useCurrentUserProfile } from "@/hooks/admin";
import {
  useRecruitDocuments,
  useDeleteDocument,
  UploadDocumentDialog,
  DocumentViewerDialog,
} from "@/features/recruiting";
// eslint-disable-next-line no-restricted-imports
import { recruitingService } from "@/services/recruiting";
import type { UserDocument } from "@/types/recruiting.types";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Compliance docs an upline uploaded/approved must not be deletable by the agent.
function isLocked(doc: UserDocument): boolean {
  return doc.required || doc.status === "approved";
}

export function MyDocumentsPanel() {
  const { data: profile } = useCurrentUserProfile();
  const userId = profile?.id;

  const documentsQuery = useRecruitDocuments(userId);
  const deleteDocument = useDeleteDocument();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selected, setSelected] = useState<UserDocument | null>(null);

  const documents = documentsQuery.data ?? [];

  const handleDownload = async (doc: UserDocument) => {
    try {
      const blob = await recruitingService.downloadDocument(doc.storage_path);
      const url = window.URL.createObjectURL(blob);
      const a = globalThis.document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      globalThis.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      globalThis.document.body.removeChild(a);
    } catch {
      toast.error("Failed to download document");
    }
  };

  const handleDelete = async (doc: UserDocument) => {
    if (!userId) return;
    if (isLocked(doc)) return;
    if (!confirm(`Delete "${doc.document_name}"?`)) return;
    try {
      await deleteDocument.mutateAsync({
        id: doc.id,
        storagePath: doc.storage_path,
        recruitId: userId,
      });
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleView = (doc: UserDocument) => {
    setSelected(doc);
    setViewerOpen(true);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: 16 }}>
      <Board pad={14}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <FileText size={14} style={{ color: T.blue, marginTop: 1 }} />
            <div>
              <Cap>My licensing documents</Cap>
              <p
                style={{
                  font: `500 11px ${T.data}`,
                  color: T.mut,
                  margin: "4px 0 0",
                }}
              >
                Store your state licenses and carrier contracts. Only you can
                see these.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setUploadOpen(true)}
            disabled={!userId}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Upload
          </Button>
        </div>

        <div style={{ marginTop: 12 }}>
          {documentsQuery.isLoading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                font: `500 11px ${T.data}`,
                color: T.mut,
                padding: "8px 0",
              }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
              documents…
            </div>
          ) : documentsQuery.error ? (
            <EmptyState
              icon={<FolderOpen size={18} />}
              title="Failed to load documents"
              hint={documentsQuery.error.message}
              pad={24}
            />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={18} />}
              title="No documents yet"
              hint='Click "Upload" to add a license or carrier contract.'
              pad={24}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: T.tile,
                    border: `1px solid ${T.line}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          font: `700 12px ${T.data}`,
                          color: T.ink,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {doc.document_name}
                      </span>
                      {doc.required && <Pill tone="amber">Required</Pill>}
                      {doc.status === "approved" && (
                        <Pill tone="green">Approved</Pill>
                      )}
                    </div>
                    <div
                      style={{
                        font: `500 10px ${T.mono}`,
                        color: T.mut,
                        marginTop: 2,
                      }}
                    >
                      {doc.document_type.replace(/_/g, " ")} ·{" "}
                      {formatFileSize(doc.file_size)} ·{" "}
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                      {doc.expires_at &&
                        ` · exp ${new Date(doc.expires_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleView(doc)}
                    aria-label="View document"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(doc)}
                    aria-label="Download document"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {isLocked(doc) ? (
                    <span
                      title="Compliance documents added by your upline can't be deleted here."
                      style={{
                        display: "inline-flex",
                        width: 28,
                        height: 28,
                        alignItems: "center",
                        justifyContent: "center",
                        color: T.mut2,
                      }}
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => handleDelete(doc)}
                      aria-label="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Board>

      {userId && (
        <UploadDocumentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          userId={userId}
          uploadedBy={userId}
        />
      )}
      {selected && (
        <DocumentViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          document={selected}
        />
      )}
    </div>
  );
}
