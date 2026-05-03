// src/features/training-hub/components/DocumentsTab.tsx
/**
 * Documents Tab for Training Hub
 *
 * Displays a shared document library for trainers and contracting managers.
 * Features: upload, view, download, delete, search, and filter by category.
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  MoreHorizontal,
  Download,
  Trash2,
  Loader2,
  FileText,
  ExternalLink,
  GraduationCap,
  FileSearch,
  Shield,
  Megaphone,
  File,
  Table2,
  Image,
  Presentation,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import {
  useTrainingDocuments,
  useDeleteTrainingDocument,
  useUpdateTrainingDocument,
  useTrainingDocumentUrl,
} from "../hooks/useTrainingDocuments";
import {
  TRAINING_CATEGORY_CONFIG,
  TRAINING_CATEGORY_ORDER,
  formatFileSize,
  type TrainingDocument,
  type TrainingDocumentCategory,
} from "../types/training-document.types";
import { UploadTrainingDocumentDialog } from "./UploadTrainingDocumentDialog";
import { toast } from "sonner";

interface DocumentsTabProps {
  searchQuery?: string;
}

// Category icons map
const CATEGORY_ICONS: Record<TrainingDocumentCategory, React.ReactNode> = {
  training: <GraduationCap className="h-3 w-3" />,
  underwriting: <FileSearch className="h-3 w-3" />,
  carrier_form: <FileText className="h-3 w-3" />,
  compliance: <Shield className="h-3 w-3" />,
  marketing: <Megaphone className="h-3 w-3" />,
  other: <File className="h-3 w-3" />,
};

// File type icon helper
function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="h-4 w-4" />;
  if (fileType.includes("pdf"))
    return <FileText className="h-4 w-4 text-destructive" />;
  if (fileType.includes("word") || fileType.includes("document"))
    return <FileText className="h-4 w-4 text-info" />;
  if (fileType.includes("excel") || fileType.includes("spreadsheet"))
    return <Table2 className="h-4 w-4 text-success" />;
  if (fileType.includes("powerpoint") || fileType.includes("presentation"))
    return <Presentation className="h-4 w-4 text-warning" />;
  if (fileType.includes("image"))
    return <Image className="h-4 w-4 text-info" />;
  return <File className="h-4 w-4" />;
}

// Document row component
function DocumentRow({
  document,
  onView,
  onDownload,
  onDelete,
  onRename,
  canDelete,
}: {
  document: TrainingDocument;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRename: () => void;
  canDelete: boolean;
}) {
  return (
    <TableRow className="text-[11px] border-b border-border dark:border-border hover:bg-background dark:hover:bg-card-tinted/50">
      <TableCell className="py-1.5">
        <div className="flex items-center gap-2">
          {getFileIcon(document.fileType)}
          <div className="min-w-0">
            <span className="font-medium text-foreground dark:text-foreground block truncate">
              {document.name}
            </span>
            {document.description && (
              <span className="text-[10px] text-muted-foreground dark:text-muted-foreground block truncate">
                {document.description}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-1.5">
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0 border-border dark:border-border text-muted-foreground dark:text-muted-foreground gap-1"
        >
          {CATEGORY_ICONS[document.category]}
          {TRAINING_CATEGORY_CONFIG[document.category]?.label ||
            document.category}
        </Badge>
      </TableCell>
      <TableCell className="py-1.5 text-muted-foreground dark:text-muted-foreground">
        {formatFileSize(document.fileSize)}
      </TableCell>
      <TableCell className="py-1.5 text-muted-foreground dark:text-muted-foreground">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default">
                {document.uploadedByName || "Unknown"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {document.uploadedByEmail || "No email"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="py-1.5 text-muted-foreground dark:text-muted-foreground">
        {format(new Date(document.createdAt), "MMM d, yyyy")}
      </TableCell>
      <TableCell className="py-1.5 w-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-background"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={onView} className="text-xs">
              <ExternalLink className="h-3 w-3 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload} className="text-xs">
              <Download className="h-3 w-3 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRename} className="text-xs">
              <Pencil className="h-3 w-3 mr-2" />
              Rename
            </DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="text-xs text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Document viewer component (opens signed URL)
function DocumentViewer({
  document,
  onClose,
}: {
  document: TrainingDocument | null;
  onClose: () => void;
}) {
  const { data: url, isLoading } = useTrainingDocumentUrl(
    document?.storagePath || null,
  );

  // Use effect to handle side effect (opening URL) outside of render
  useEffect(() => {
    if (url && document) {
      window.open(url, "_blank");
      onClose();
    }
  }, [url, document, onClose]);

  if (!document) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-4 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Opening document...</span>
        </div>
      </div>
    );
  }

  return null;
}

export function DocumentsTab({ searchQuery }: DocumentsTabProps) {
  const { user } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [viewingDocument, setViewingDocument] =
    useState<TrainingDocument | null>(null);
  const [deletingDocument, setDeletingDocument] =
    useState<TrainingDocument | null>(null);
  const [renamingDocument, setRenamingDocument] =
    useState<TrainingDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Build filters
  const filters = {
    category:
      categoryFilter !== "all"
        ? (categoryFilter as TrainingDocumentCategory)
        : undefined,
    search: searchQuery || undefined,
  };

  const { data: documents, isLoading, error } = useTrainingDocuments(filters);
  const deleteDocument = useDeleteTrainingDocument();
  const updateDocument = useUpdateTrainingDocument();

  const handleRenameOpen = (doc: TrainingDocument) => {
    setRenamingDocument(doc);
    setRenameValue(doc.name);
  };

  const handleRenameSave = async () => {
    if (!renamingDocument || !renameValue.trim()) return;
    try {
      await updateDocument.mutateAsync({
        id: renamingDocument.id,
        name: renameValue.trim(),
      });
      toast.success("Document renamed");
      setRenamingDocument(null);
    } catch {
      toast.error("Failed to rename document");
    }
  };

  const handleView = (doc: TrainingDocument) => {
    setViewingDocument(doc);
  };

  const handleDownload = async (doc: TrainingDocument) => {
    try {
      const { trainingDocumentService } =
        await import("../services/trainingDocumentService");
      const url = await trainingDocumentService.getSignedUrl(doc.storagePath);
      if (url) {
        // Create a temporary link and click it to trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = doc.fileName;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Download started");
      } else {
        toast.error("Failed to get download URL");
      }
    } catch {
      toast.error("Failed to download document");
    }
  };

  const handleDelete = async () => {
    if (!deletingDocument) return;

    try {
      await deleteDocument.mutateAsync(deletingDocument.id);
      toast.success("Document deleted");
      setDeletingDocument(null);
    } catch {
      toast.error("Failed to delete document");
    }
  };

  // Staff who manage the shared library can delete any document
  const canDelete = (doc: TrainingDocument) => {
    if (user?.is_super_admin) return true;
    const roles = (user?.roles as string[] | undefined) ?? [];
    if (
      roles.includes("trainer") ||
      roles.includes("contracting_manager") ||
      roles.includes("admin")
    )
      return true;
    return doc.uploadedBy === user?.id;
  };

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        Failed to load documents. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with filters and upload button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-7 text-[11px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Categories
              </SelectItem>
              {TRAINING_CATEGORY_ORDER.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  <div className="flex items-center gap-1.5">
                    {CATEGORY_ICONS[cat]}
                    {TRAINING_CATEGORY_CONFIG[cat].label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {documents && (
            <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => setShowUploadDialog(true)}
          className="h-7 px-2 text-[11px] gap-1"
        >
          <Plus className="h-3 w-3" />
          Upload
        </Button>
      </div>

      {/* Documents table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="border border-border dark:border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-background dark:bg-card-tinted/50 border-b border-border dark:border-border">
                <TableHead className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground py-1.5">
                  Document
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground py-1.5">
                  Category
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground py-1.5">
                  Size
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground py-1.5">
                  Uploaded By
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground py-1.5">
                  Date
                </TableHead>
                <TableHead className="w-8 py-1.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onView={() => handleView(doc)}
                  onDownload={() => handleDownload(doc)}
                  onDelete={() => setDeletingDocument(doc)}
                  onRename={() => handleRenameOpen(doc)}
                  canDelete={canDelete(doc)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground dark:text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No documents found</p>
          <p className="text-xs mt-1">
            {searchQuery || categoryFilter !== "all"
              ? "Try adjusting your filters"
              : "Upload your first document to get started"}
          </p>
        </div>
      )}

      {/* Upload dialog */}
      <UploadTrainingDocumentDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
      />

      {/* Document viewer */}
      <DocumentViewer
        document={viewingDocument}
        onClose={() => setViewingDocument(null)}
      />

      {/* Rename dialog */}
      <AlertDialog
        open={!!renamingDocument}
        onOpenChange={(open) => !open && setRenamingDocument(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Rename Document
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Enter a new name for "{renamingDocument?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameSave()}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRenameSave}
              className="h-7 text-xs"
              disabled={updateDocument.isPending || !renameValue.trim()}
            >
              {updateDocument.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Save"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingDocument}
        onOpenChange={(open) => !open && setDeletingDocument(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Delete Document
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete "{deletingDocument?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-7 text-xs bg-destructive hover:bg-destructive"
              disabled={deleteDocument.isPending}
            >
              {deleteDocument.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DocumentsTab;
