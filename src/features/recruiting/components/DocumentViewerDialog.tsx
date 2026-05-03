// src/features/recruiting/components/DocumentViewerDialog.tsx

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { UserDocument } from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { recruitingService } from "@/services/recruiting";

interface DocumentViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: UserDocument;
}

export function DocumentViewerDialog({
  open,
  onOpenChange,
  document: userDocument,
}: DocumentViewerDialogProps) {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let currentUrl: string | null = null;

    const loadDocument = async () => {
      setIsLoading(true);
      try {
        const blob = await recruitingService.downloadDocument(
          userDocument.storage_path,
        );
        const url = URL.createObjectURL(blob);
        currentUrl = url;
        setDocumentUrl(url);
      } catch (error) {
        console.error("Failed to load document:", error);
        alert("Failed to load document");
      } finally {
        setIsLoading(false);
      }
    };

    if (open && userDocument) {
      loadDocument();
    }

    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [open, userDocument]);

  const handleDownload = () => {
    if (!documentUrl) return;

    const a = globalThis.document.createElement("a");
    a.href = documentUrl;
    a.download = userDocument.file_name;
    globalThis.document.body.appendChild(a);
    a.click();
    globalThis.document.body.removeChild(a);
  };

  const handleOpenInNewTab = () => {
    if (!documentUrl) return;
    window.open(documentUrl, "_blank", "noopener,noreferrer");
  };

  const isImage = userDocument.file_type?.startsWith("image/");
  const isPdf = userDocument.file_type === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 w-[95vw] sm:max-w-6xl h-[90vh] max-h-[90vh] overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0 space-y-1">
          <DialogTitle className="pr-8 truncate">
            {userDocument.document_name}
          </DialogTitle>
          <DialogDescription className="truncate">
            {userDocument.document_type.replace(/_/g, " ")} •{" "}
            {userDocument.file_name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto bg-muted dark:bg-muted">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documentUrl ? (
            <>
              {isImage && (
                <div className="flex items-center justify-center min-h-full p-4">
                  <img
                    src={documentUrl}
                    alt={userDocument.document_name}
                    className="max-w-full max-h-full object-contain rounded-lg border border-border bg-white dark:bg-card"
                  />
                </div>
              )}

              {isPdf && (
                <iframe
                  src={documentUrl}
                  title={userDocument.document_name}
                  className="block w-full h-full border-0"
                />
              )}

              {!isImage && !isPdf && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p>Preview not available for this file type</p>
                  <p className="text-sm mt-1">
                    Click "Download" to view the file
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-center py-12 text-muted-foreground">
              <p>Failed to load document</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-3 border-t border-border shrink-0">
          <Button
            variant="outline"
            onClick={handleOpenInNewTab}
            disabled={!documentUrl}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in new tab
          </Button>
          <Button onClick={handleDownload} disabled={!documentUrl}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
