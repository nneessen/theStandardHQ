// src/features/underwriting/components/GuideManager/ParsedContentPreview.tsx

import { useState } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useParsedContent } from "../../hooks/guides/useParsedContent";

interface ParsedContentPreviewProps {
  guideId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ParsedContentPreview({
  guideId,
  open,
  onOpenChange,
}: ParsedContentPreviewProps) {
  const { data, isLoading } = useParsedContent(open ? guideId : null);
  const [currentPage, setCurrentPage] = useState(0);

  if (!open) return null;

  const content = data?.content;
  const stats = data?.stats;
  const sections = content?.sections || [];
  const section = sections[currentPage];

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Parsed Content — {data?.guideName || "Guide"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900 dark:border-zinc-100" />
          </div>
        ) : !content ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <FileText className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-[11px]">No parsed content available</p>
            <p className="text-[10px] mt-1">
              Parse the guide first to preview content.
            </p>
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            {stats && (
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  <span>{formatNumber(stats.totalWords)} words</span>
                </div>
                <span>{formatNumber(stats.totalChars)} chars</span>
                <span>{stats.pageCount} pages</span>
                <span>~{stats.avgWordsPerPage} words/page avg</span>
                {stats.lowDensityPages.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[8px] px-1 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    {stats.lowDensityPages.length} low-density pages
                  </Badge>
                )}
              </div>
            )}

            <Separator />

            {/* Page Navigator */}
            <div className="flex items-center justify-between px-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                Prev
              </Button>
              <span className="text-[10px] text-zinc-500">
                Page {section?.pageNumber ?? currentPage + 1} of{" "}
                {sections.length}
                {stats?.lowDensityPages.includes(section?.pageNumber) && (
                  <Badge
                    variant="secondary"
                    className="text-[8px] px-1 py-0 ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    Low density
                  </Badge>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={currentPage >= sections.length - 1}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {/* Page Content */}
            <ScrollArea className="flex-1 min-h-0 border border-zinc-200 dark:border-zinc-700 rounded-md">
              <div className="p-4">
                {section ? (
                  <pre className="text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {section.content}
                  </pre>
                ) : (
                  <p className="text-[11px] text-zinc-400 text-center py-8">
                    No content for this page
                  </p>
                )}
              </div>
            </ScrollArea>

            {/* Tables indicator */}
            {content.metadata?.tables && content.metadata.tables.length > 0 && (
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                  {content.metadata.tables.length} tables detected (OCR)
                </Badge>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
