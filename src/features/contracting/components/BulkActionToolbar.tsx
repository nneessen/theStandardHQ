// src/features/contracting/components/BulkActionToolbar.tsx
// Floating toolbar for bulk actions on selected contract requests

import { Button } from "@/components/ui/button";
import { FileDown, Trash2, X, RefreshCw } from "lucide-react";

interface BulkActionToolbarProps {
  selectedCount: number;
  onStatusChange: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  onStatusChange,
  onExport,
  onDelete,
  onClear,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 text-foreground shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/85 animate-in slide-in-from-bottom-2">
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
        {selectedCount} selected
      </span>
      <div className="h-4 w-px bg-border" />
      <Button
        size="sm"
        variant="ghost"
        onClick={onStatusChange}
        className="h-7 bg-transparent px-2 text-xs text-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent"
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Change Status
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onExport}
        className="h-7 bg-transparent px-2 text-xs text-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent"
      >
        <FileDown className="h-3 w-3 mr-1" />
        Export
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        className="h-7 bg-transparent px-2 text-xs text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive dark:bg-transparent dark:text-destructive dark:hover:text-destructive"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Delete
      </Button>
      <div className="h-4 w-px bg-border" />
      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        className="h-7 bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
