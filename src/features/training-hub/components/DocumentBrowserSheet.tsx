// src/features/training-hub/components/DocumentBrowserSheet.tsx
/**
 * Document browser sheet for selecting documents to attach to emails
 *
 * Allows users to browse and select training documents from the shared library
 * to attach when composing emails.
 */

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Loader2,
  FileText,
  GraduationCap,
  FileSearch,
  Shield,
  Megaphone,
  File,
  Table2,
  Image,
  Presentation,
  Paperclip,
} from "lucide-react";
import { useTrainingDocuments } from "../hooks/useTrainingDocuments";
import {
  TRAINING_CATEGORY_CONFIG,
  TRAINING_CATEGORY_ORDER,
  formatFileSize,
  type TrainingDocument,
  type TrainingDocumentCategory,
} from "../types/training-document.types";

interface DocumentBrowserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDocuments: (documents: TrainingDocument[]) => void;
  selectedDocuments: TrainingDocument[];
  maxAttachments?: number;
}

// Category icons
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
  if (!fileType) return <File className="h-4 w-4 text-v2-ink-subtle" />;
  if (fileType.includes("pdf"))
    return <FileText className="h-4 w-4 text-red-500" />;
  if (fileType.includes("word") || fileType.includes("document"))
    return <FileText className="h-4 w-4 text-blue-500" />;
  if (fileType.includes("excel") || fileType.includes("spreadsheet"))
    return <Table2 className="h-4 w-4 text-green-500" />;
  if (fileType.includes("powerpoint") || fileType.includes("presentation"))
    return <Presentation className="h-4 w-4 text-orange-500" />;
  if (fileType.includes("image"))
    return <Image className="h-4 w-4 text-purple-500" />;
  return <File className="h-4 w-4 text-v2-ink-subtle" />;
}

export function DocumentBrowserSheet({
  open,
  onOpenChange,
  onSelectDocuments,
  selectedDocuments,
  maxAttachments = 10,
}: DocumentBrowserSheetProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [localSelection, setLocalSelection] = useState<TrainingDocument[]>([]);

  // Sync local selection when sheet opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalSelection(selectedDocuments);
    }
    onOpenChange(newOpen);
  };

  // Build filters
  const filters = {
    category:
      categoryFilter !== "all"
        ? (categoryFilter as TrainingDocumentCategory)
        : undefined,
    search: search || undefined,
  };

  const { data: documents, isLoading } = useTrainingDocuments(filters);

  const isSelected = useCallback(
    (doc: TrainingDocument) => {
      return localSelection.some((d) => d.id === doc.id);
    },
    [localSelection],
  );

  const toggleSelection = useCallback(
    (doc: TrainingDocument) => {
      setLocalSelection((prev) => {
        if (prev.some((d) => d.id === doc.id)) {
          return prev.filter((d) => d.id !== doc.id);
        }
        if (prev.length >= maxAttachments) {
          return prev; // Max reached
        }
        return [...prev, doc];
      });
    },
    [maxAttachments],
  );

  const handleConfirm = () => {
    onSelectDocuments(localSelection);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalSelection([]);
  };

  // Calculate total size of selected documents
  const totalSize = localSelection.reduce(
    (acc, doc) => acc + (doc.fileSize || 0),
    0,
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-v2-ring dark:border-v2-ring">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Attach Documents
          </SheetTitle>
        </SheetHeader>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-v2-ring dark:border-v2-ring space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-v2-ink-subtle" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs">
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
        </div>

        {/* Selection summary */}
        {localSelection.length > 0 && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-medium text-blue-700 dark:text-blue-300">
                {localSelection.length}
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                {" "}
                selected ({formatFileSize(totalSize)})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              Clear
            </Button>
          </div>
        )}

        {/* Document list */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="divide-y divide-v2-ring dark:divide-v2-ring">
              {documents.map((doc) => {
                const selected = isSelected(doc);
                const disabled =
                  !selected && localSelection.length >= maxAttachments;

                return (
                  <div
                    key={doc.id}
                    onClick={() => !disabled && toggleSelection(doc)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      selected
                        ? "bg-blue-50 dark:bg-blue-950/30"
                        : disabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50"
                    }`}
                  >
                    <Checkbox
                      checked={selected}
                      disabled={disabled}
                      className="h-4 w-4"
                    />
                    {getFileIcon(doc.fileType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-v2-ink dark:text-v2-ink truncate">
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-4"
                        >
                          {TRAINING_CATEGORY_CONFIG[doc.category]?.label}
                        </Badge>
                        <span className="text-[10px] text-v2-ink-subtle">
                          {formatFileSize(doc.fileSize)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-v2-ink-subtle">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs">No documents found</p>
              {(search || categoryFilter !== "all") && (
                <p className="text-[10px] mt-1">Try adjusting your filters</p>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <SheetFooter className="px-4 py-3 border-t border-v2-ring dark:border-v2-ring gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={localSelection.length === 0}
            className="h-8 text-xs"
          >
            <Paperclip className="h-3 w-3 mr-1" />
            Attach {localSelection.length > 0 && `(${localSelection.length})`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default DocumentBrowserSheet;
