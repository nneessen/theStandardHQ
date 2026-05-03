import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "@/lib/pdf-setup";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface SlidesPresentationProps {
  url: string;
}

interface SlideNavigatorProps {
  currentPage: number;
  numPages: number | null;
  onPageChange: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Seekable slider + prev/next navigator used at both top and bottom of the
 * PDF container so the user can navigate quickly without scrolling below
 * the fold. The slider supports drag-to-jump through any number of pages.
 */
function SlideNavigator({
  currentPage,
  numPages,
  onPageChange,
  onPrev,
  onNext,
}: SlideNavigatorProps) {
  const disabled = !numPages;
  const max = numPages ?? 1;
  return (
    <div className="flex items-center gap-2 px-1">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={onPrev}
        disabled={disabled || currentPage <= 1}
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <div className="flex-1 min-w-0">
        <Slider
          min={1}
          max={max}
          step={1}
          value={[currentPage]}
          onValueChange={([v]) => onPageChange(v)}
          disabled={disabled}
          aria-label="Slide navigator"
        />
      </div>
      <span className="text-[11px] text-v2-ink-muted min-w-[56px] text-right tabular-nums flex-shrink-0">
        {numPages ? `${currentPage} / ${numPages}` : `${currentPage}`}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={onNext}
        disabled={disabled || currentPage >= max}
        aria-label="Next slide"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function SlidesPresentation({ url }: SlidesPresentationProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => setNumPages(n),
    [],
  );

  const goNext = useCallback(
    () => setCurrentPage((p) => Math.min(p + 1, numPages ?? p)),
    [numPages],
  );
  const goPrev = useCallback(
    () => setCurrentPage((p) => Math.max(1, p - 1)),
    [],
  );
  const goToPage = useCallback(
    (page: number) => {
      if (!numPages) return;
      setCurrentPage(Math.max(1, Math.min(page, numPages)));
    },
    [numPages],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  return (
    <div className="space-y-2">
      {/* Top navigator — always visible on initial render */}
      <SlideNavigator
        currentPage={currentPage}
        numPages={numPages}
        onPageChange={goToPage}
        onPrev={goPrev}
        onNext={goNext}
      />

      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden border border-v2-ring dark:border-v2-ring-strong bg-muted flex items-center justify-center"
        style={{ minHeight: 400 }}
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center gap-2 py-20 text-v2-ink-subtle">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading slides...</span>
            </div>
          }
          error={
            <p className="text-xs text-destructive py-20">
              Failed to load slides
            </p>
          }
        >
          <Page
            pageNumber={currentPage}
            width={containerWidth - 32}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={
              <div className="flex items-center gap-2 py-20 text-v2-ink-subtle">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            }
          />
        </Document>
      </div>

      {/* Bottom navigator — mirrors the top so users don't have to scroll up */}
      <SlideNavigator
        currentPage={currentPage}
        numPages={numPages}
        onPageChange={goToPage}
        onPrev={goPrev}
        onNext={goNext}
      />
    </div>
  );
}
