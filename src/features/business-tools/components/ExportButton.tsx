// src/features/business-tools/components/ExportButton.tsx
// Workbook download button + review upload dropdown

import { useState, useRef, useEffect } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExportWorkbook } from "../hooks/useBusinessTools";
import { WorkbookReview } from "./WorkbookReview";

export function ExportButton() {
  const exportWorkbook = useExportWorkbook();
  const [showReview, setShowReview] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click-outside to close
  useEffect(() => {
    if (!showReview) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowReview(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showReview]);

  return (
    <div className="relative flex items-center gap-1.5" ref={panelRef}>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px]"
        disabled={exportWorkbook.isPending}
        onClick={() => exportWorkbook.mutate()}
      >
        {exportWorkbook.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Download className="h-3 w-3 mr-1" />
        )}
        Export
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[11px] text-zinc-500"
        onClick={() => setShowReview(!showReview)}
        title="Upload corrected workbook"
      >
        <Upload className="h-3 w-3" />
      </Button>

      {showReview && (
        <div className="absolute right-0 top-9 z-50 w-80 shadow-lg">
          <WorkbookReview />
        </div>
      )}
    </div>
  );
}
