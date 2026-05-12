// src/features/recruiting/components/DocumentManager.tsx
// Document management with compact styling

import React, { useState } from "react";
import { UserDocument } from "@/types/recruiting.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Upload,
  Eye,
  FolderOpen,
} from "lucide-react";
import {
  useUploadDocument,
  useDeleteDocument,
  useUpdateDocumentStatus,
} from "../hooks/useRecruitDocuments";
// eslint-disable-next-line no-restricted-imports
import { recruitingService } from "@/services/recruiting";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { DocumentViewerDialog } from "./DocumentViewerDialog";

interface DocumentManagerProps {
  userId: string;
  documents?: UserDocument[];
  isUpline?: boolean;
  currentUserId?: string;
}

const DOCUMENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  received: "bg-info/10 text-info border-info/30",
  approved: "bg-success/10 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
};

export function DocumentManager({
  userId,
  documents,
  isUpline = false,
  currentUserId,
}: DocumentManagerProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<UserDocument | null>(
    null,
  );
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const _uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const updateDocumentStatus = useUpdateDocumentStatus();

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
    } catch (error) {
      console.error("Failed to download document:", error);
      alert("Failed to download document");
    }
  };

  const handleDelete = async (doc: UserDocument) => {
    if (!confirm(`Are you sure you want to delete "${doc.document_name}"?`))
      return;

    try {
      await deleteDocument.mutateAsync({
        id: doc.id,
        storagePath: doc.storage_path,
        recruitId: userId,
      });
    } catch (error) {
      console.error("Failed to delete document:", error);
      alert("Failed to delete document");
    }
  };

  const handleApprove = async (doc: UserDocument) => {
    try {
      await updateDocumentStatus.mutateAsync({
        id: doc.id,
        status: "approved",
        approvalNotes: "Approved by upline",
        recruitId: userId,
      });
    } catch (error) {
      console.error("Failed to approve document:", error);
      alert("Failed to approve document");
    }
  };

  const handleReject = async (doc: UserDocument) => {
    const reason = prompt("Please enter the reason for rejection:");
    if (!reason) return;

    try {
      await updateDocumentStatus.mutateAsync({
        id: doc.id,
        status: "rejected",
        approvalNotes: reason,
        recruitId: userId,
      });
    } catch (error) {
      console.error("Failed to reject document:", error);
      alert("Failed to reject document");
    }
  };

  const handleView = (doc: UserDocument) => {
    setSelectedDocument(doc);
    setIsViewerOpen(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {documents && documents.length > 0
            ? `${documents.length} document${documents.length > 1 ? "s" : ""}`
            : "No documents"}
        </p>
        <Button
          size="sm"
          onClick={() => setIsUploadDialogOpen(true)}
          className="h-6 px-2 text-[10px]"
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </Button>
      </div>

      {/* Document List */}
      {documents && documents.length > 0 ? (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-2 rounded-md border border-border bg-card hover:border-border  transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className="p-1.5 rounded bg-muted">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground -subtle" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="text-[11px] font-medium text-foreground truncate">
                        {doc.document_name}
                      </h4>
                      {doc.required && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-3.5 px-1 border-border text-muted-foreground  -subtle"
                        >
                          Required
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span className="capitalize">
                        {doc.document_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span>{formatFileSize(doc.file_size || 0)}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </span>
                      {doc.expires_at && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span
                            className={
                              new Date(doc.expires_at) < new Date()
                                ? "text-destructive font-medium"
                                : ""
                            }
                          >
                            Exp {new Date(doc.expires_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[9px] h-4 px-1 capitalize ${DOCUMENT_STATUS_STYLES[doc.status]}`}
                  >
                    {doc.status}
                  </Badge>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-[11px]">
                      <DropdownMenuItem
                        onClick={() => handleView(doc)}
                        className="text-[11px]"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDownload(doc)}
                        className="text-[11px]"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download
                      </DropdownMenuItem>
                      {isUpline && doc.status === "pending" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleApprove(doc)}
                            className="text-[11px]"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-success" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleReject(doc)}
                            className="text-[11px]"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5 text-destructive" />
                            Reject
                          </DropdownMenuItem>
                        </>
                      )}
                      {isUpline && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(doc)}
                          variant="destructive"
                          className="text-[11px]"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {doc.notes && (
                <p className="text-[10px] text-muted-foreground mt-1.5 italic ml-7">
                  {doc.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground -subtle mb-0.5">
            No documents uploaded yet
          </p>
          <p className="text-[10px] text-muted-foreground -muted">
            Click "Upload" to add documents
          </p>
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDocumentDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        userId={userId}
        uploadedBy={currentUserId || ""}
      />

      {/* Document Viewer */}
      {selectedDocument && (
        <DocumentViewerDialog
          open={isViewerOpen}
          onOpenChange={setIsViewerOpen}
          document={selectedDocument}
        />
      )}
    </div>
  );
}
