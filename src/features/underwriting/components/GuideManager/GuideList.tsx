// src/features/underwriting/components/GuideManager/GuideList.tsx

import { useState } from "react";
import {
  FileText,
  Download,
  Trash2,
  MoreHorizontal,
  Plus,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  Clock,
  Pencil,
  ScanEye,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useUnderwritingGuides,
  useDeleteGuide,
  useGuideSignedUrl,
  useUpdateGuide,
} from "../../hooks/guides/useUnderwritingGuides";
import { useParseGuide } from "../../hooks/guides/useParseGuide";
import { useCriteriaByGuide } from "../../hooks/criteria/useCriteria";
import { useExtractCriteria } from "../../hooks/criteria/useExtractCriteria";
import { GuideUploader } from "./GuideUploader";
import { ParsedContentPreview } from "./ParsedContentPreview";
import type { UnderwritingGuide } from "../../types/underwriting.types";
import { formatSessionDate } from "../../utils/shared/formatters";

export function GuideList() {
  const { data: guides, isLoading, error } = useUnderwritingGuides();
  const deleteMutation = useDeleteGuide();
  const parseMutation = useParseGuide();
  const extractMutation = useExtractCriteria();
  const updateMutation = useUpdateGuide();

  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [guideToDelete, setGuideToDelete] = useState<UnderwritingGuide | null>(
    null,
  );
  const [viewingGuide, setViewingGuide] = useState<UnderwritingGuide | null>(
    null,
  );
  const [editingGuide, setEditingGuide] = useState<UnderwritingGuide | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editVersion, setEditVersion] = useState("");
  const [parsingGuideId, setParsingGuideId] = useState<string | null>(null);
  const [extractingGuideId, setExtractingGuideId] = useState<string | null>(
    null,
  );
  const [previewGuideId, setPreviewGuideId] = useState<string | null>(null);

  const handleDeleteClick = (guide: UnderwritingGuide) => {
    setGuideToDelete(guide);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!guideToDelete) return;
    try {
      await deleteMutation.mutateAsync(guideToDelete);
      setDeleteConfirmOpen(false);
      setGuideToDelete(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleParseClick = async (guide: UnderwritingGuide, useOcr = false) => {
    setParsingGuideId(guide.id);
    try {
      await parseMutation.mutateAsync({
        guideId: guide.id,
        storagePath: guide.storage_path,
        useOcr,
      });
    } finally {
      setParsingGuideId(null);
    }
  };

  const handleExtractClick = async (guide: UnderwritingGuide) => {
    setExtractingGuideId(guide.id);
    try {
      await extractMutation.mutateAsync({ guideId: guide.id });
    } finally {
      setExtractingGuideId(null);
    }
  };

  const handleEditClick = (guide: UnderwritingGuide) => {
    setEditingGuide(guide);
    setEditName(guide.name);
    setEditVersion(guide.version || "");
  };

  const handleEditSave = async () => {
    if (!editingGuide) return;
    try {
      await updateMutation.mutateAsync({
        id: editingGuide.id,
        name: editName,
        version: editVersion || undefined,
      });
      setEditingGuide(null);
    } catch {
      // Error handled by mutation
    }
  };

  const isGuideBeingParsed = (guideId: string) => {
    return (
      parsingGuideId === guideId ||
      guides?.find((g) => g.id === guideId)?.parsing_status === "processing"
    );
  };

  const isGuideBeingExtracted = (guideId: string) => {
    return extractingGuideId === guideId;
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getParsingStatusBadge = (guide: UnderwritingGuide) => {
    const status = guide.parsing_status;
    const isParsing = isGuideBeingParsed(guide.id);

    if (isParsing) {
      return (
        <Badge className="bg-info/20 text-info dark:bg-info/30 dark:text-info text-[9px] px-1.5 py-0">
          <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
          Parsing
        </Badge>
      );
    }

    switch (status) {
      case "completed":
        return (
          <Badge className="bg-success/20 text-success dark:bg-success/15 dark:text-success text-[9px] px-1.5 py-0">
            Parsed
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-info/20 text-info dark:bg-info/30 dark:text-info text-[9px] px-1.5 py-0">
            <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
            Parsing
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning text-[9px] px-1.5 py-0">
            Pending
          </Badge>
        );
      case "failed":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive text-[9px] px-1.5 py-0 cursor-help">
                  <AlertCircle className="h-2.5 w-2.5 mr-1" />
                  Failed
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-[10px]">
                {guide.parsing_error ||
                  "Parsing failed. Click 'Parse' to retry."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            —
          </Badge>
        );
    }
  };

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-[11px]">
        Failed to load guides: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-medium text-foreground dark:text-foreground">
            Underwriting Guides
          </h3>
          <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Upload and manage carrier underwriting guide PDFs
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setUploaderOpen(true)}
          className="h-6 px-2 text-[10px]"
        >
          <Plus className="h-3 w-3 mr-1" />
          Upload Guide
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border dark:border-border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-background dark:bg-card-tinted/50">
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground">
                Name
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground">
                Carrier
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground text-center">
                Size
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground text-center">
                Parse
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground text-center">
                Criteria
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground">
                Uploaded
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground w-[80px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Skeleton className="h-5 w-14 mx-auto" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Skeleton className="h-5 w-14 mx-auto" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-6 w-6" />
                  </TableCell>
                </TableRow>
              ))
            ) : guides && guides.length > 0 ? (
              guides.map((guide) => (
                <TableRow
                  key={guide.id}
                  className="hover:bg-background dark:hover:bg-card-tinted/30"
                >
                  <TableCell className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <div>
                        <div className="text-[11px] text-foreground dark:text-foreground font-medium">
                          {guide.name}
                        </div>
                        <div className="text-[9px] text-muted-foreground dark:text-muted-foreground">
                          {guide.file_name}
                          {guide.version && ` • v${guide.version}`}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[11px] text-foreground dark:text-muted-foreground">
                    {(guide as unknown as { carrier?: { name: string } })
                      .carrier?.name || "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[10px] text-muted-foreground dark:text-muted-foreground text-center">
                    {formatFileSize(guide.file_size_bytes)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    {getParsingStatusBadge(guide)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <CriteriaStatusCell
                      guide={guide}
                      isExtracting={isGuideBeingExtracted(guide.id)}
                      onExtract={() => handleExtractClick(guide)}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[10px] text-muted-foreground dark:text-muted-foreground">
                    {formatSessionDate(guide.created_at)}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => setViewingGuide(guide)}
                          className="text-[11px]"
                        >
                          <ExternalLink className="h-3 w-3 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEditClick(guide)}
                          className="text-[11px]"
                        >
                          <Pencil className="h-3 w-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleParseClick(guide, true)}
                          disabled={isGuideBeingParsed(guide.id)}
                          className="text-[11px]"
                        >
                          {isGuideBeingParsed(guide.id) ? (
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          ) : (
                            <ScanEye className="h-3 w-3 mr-2" />
                          )}
                          {guide.parsing_status === "completed"
                            ? "Re-parse"
                            : "Parse"}
                        </DropdownMenuItem>
                        {guide.parsing_status === "completed" && (
                          <DropdownMenuItem
                            onClick={() => setPreviewGuideId(guide.id)}
                            className="text-[11px]"
                          >
                            <Eye className="h-3 w-3 mr-2" />
                            Preview Parsed
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(guide)}
                          className="text-[11px] text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="px-3 py-8 text-center text-[11px] text-muted-foreground dark:text-muted-foreground"
                >
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No guides uploaded yet. Upload your first carrier underwriting
                  guide.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Upload Dialog */}
      <GuideUploader open={uploaderOpen} onOpenChange={setUploaderOpen} />

      {/* View Guide Dialog */}
      {viewingGuide && (
        <GuideViewerDialog
          guide={viewingGuide}
          open={!!viewingGuide}
          onOpenChange={(open) => !open && setViewingGuide(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Delete Guide
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              Are you sure you want to delete "{guideToDelete?.name}"? This will
              permanently remove the file and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-[11px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="h-7 text-[11px] bg-destructive hover:bg-destructive"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Parsed Content Preview */}
      {previewGuideId && (
        <ParsedContentPreview
          guideId={previewGuideId}
          open={!!previewGuideId}
          onOpenChange={(open) => !open && setPreviewGuideId(null)}
        />
      )}

      {/* Edit Guide Dialog */}
      <Dialog
        open={!!editingGuide}
        onOpenChange={(open) => !open && setEditingGuide(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Guide</DialogTitle>
            <DialogDescription className="text-[11px]">
              Update the guide name and version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-name" className="text-[11px]">
                Name
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-[11px]"
                placeholder="Guide name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-version" className="text-[11px]">
                Version (optional)
              </Label>
              <Input
                id="edit-version"
                value={editVersion}
                onChange={(e) => setEditVersion(e.target.value)}
                className="h-8 text-[11px]"
                placeholder="e.g., 2024.1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingGuide(null)}
              className="h-7 text-[11px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!editName.trim() || updateMutation.isPending}
              className="h-7 text-[11px]"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simple viewer dialog to open the PDF
function GuideViewerDialog({
  guide,
  open,
  onOpenChange,
}: {
  guide: UnderwritingGuide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: signedUrl, isLoading } = useGuideSignedUrl(guide.storage_path);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">{guide.name}</AlertDialogTitle>
          <AlertDialogDescription className="text-[11px]">
            {guide.file_name}
            {guide.version && ` • Version ${guide.version}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground dark:border-border" />
            </div>
          ) : signedUrl ? (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-8 text-[11px]"
                onClick={() => window.open(signedUrl, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Open PDF in New Tab
              </Button>
              <Button
                variant="outline"
                className="w-full h-8 text-[11px]"
                asChild
              >
                <a href={signedUrl} download={guide.file_name}>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Download PDF
                </a>
              </Button>
            </div>
          ) : (
            <p className="text-[11px] text-destructive text-center">
              Failed to load file URL
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-7 text-[11px]">
            Close
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Component to show criteria extraction status and trigger extraction
function CriteriaStatusCell({
  guide,
  isExtracting,
  onExtract,
}: {
  guide: UnderwritingGuide;
  isExtracting: boolean;
  onExtract: () => void;
}) {
  const { data: criteria, isLoading } = useCriteriaByGuide(guide.id);

  // Can only extract if guide is parsed
  const canExtract = guide.parsing_status === "completed";

  if (isLoading) {
    return <Skeleton className="h-5 w-14 mx-auto" />;
  }

  // Show extracting state
  if (isExtracting || criteria?.extraction_status === "processing") {
    return (
      <Badge className="bg-info/20 text-info dark:bg-info/30 dark:text-info text-[9px] px-1.5 py-0">
        <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
        Extracting
      </Badge>
    );
  }

  // Show completed status with re-extract option
  if (criteria?.extraction_status === "completed") {
    const confidence = criteria.extraction_confidence
      ? `${(criteria.extraction_confidence * 100).toFixed(0)}%`
      : "";
    return (
      <div className="flex items-center gap-1 justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-success/20 text-success dark:bg-success/15 dark:text-success text-[9px] px-1.5 py-0 cursor-help">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                {confidence || "Done"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              <p>Criteria extracted with {confidence} confidence</p>
              <p className="text-muted-foreground">
                Review: {criteria.review_status || "pending"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 text-muted-foreground hover:text-info"
                onClick={onExtract}
                disabled={!canExtract}
              >
                <RefreshCw className="h-2.5 w-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              Re-extract criteria
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // Show failed status with retry
  if (criteria?.extraction_status === "failed") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[9px] text-destructive"
              onClick={onExtract}
              disabled={!canExtract}
            >
              <AlertCircle className="h-2.5 w-2.5 mr-1" />
              Retry
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-[10px]">
            {criteria.extraction_error || "Extraction failed. Click to retry."}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show pending/extract button
  if (criteria?.extraction_status === "pending") {
    return (
      <Badge className="bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning text-[9px] px-1.5 py-0">
        <Clock className="h-2.5 w-2.5 mr-1" />
        Pending
      </Badge>
    );
  }

  // No criteria yet - show extract button
  if (!canExtract) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[9px]"
                disabled
              >
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                Extract
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">
            Parse the guide first before extracting criteria
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 px-1.5 text-[9px] text-info hover:text-info dark:hover:text-info"
      onClick={onExtract}
    >
      <Sparkles className="h-2.5 w-2.5 mr-1" />
      Extract
    </Button>
  );
}
