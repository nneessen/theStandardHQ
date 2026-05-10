import { useMemo, useState } from "react";
import {
  Library,
  ExternalLink,
  Loader2,
  Search,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SoftCard, PillButton } from "@/components/v2";
import { toast } from "sonner";
import {
  useUwGuideModules,
  openUwGuidePdf,
  type UwGuideModuleRow,
} from "../hooks/guides/useUwGuideModules";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCategory(category: string | null): string {
  if (!category) return "Other";
  return category
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function UnderwritingGuidesPage() {
  const { data: rows, isLoading, error } = useUwGuideModules();
  const [search, setSearch] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.moduleTitle.toLowerCase().includes(q) ||
        r.fileName.toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleOpen = async (row: UwGuideModuleRow) => {
    setOpeningId(row.contentId);
    try {
      await openUwGuidePdf(row.storagePath);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not open the PDF",
      );
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Library className="h-4 w-4 text-v2-ink" />
            <h1 className="text-base font-semibold tracking-tight text-v2-ink">
              UW Guides
            </h1>
          </div>
          {rows && !isLoading && (
            <span className="text-[11px] text-v2-ink-muted">
              <span className="text-v2-ink font-semibold tabular-nums">
                {rows.length}
              </span>{" "}
              guide{rows.length === 1 ? "" : "s"} · click any row to open the
              PDF
            </span>
          )}
        </div>
        <div className="relative flex-shrink-0 w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-v2-ink-muted pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by carrier, file, category…"
            className="h-8 pl-8 text-[12px]"
          />
        </div>
      </header>

      <SoftCard padding="none" className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-2" />
            <p className="text-[12px] text-v2-ink-muted">
              {error instanceof Error
                ? error.message
                : "Failed to load UW guides"}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <FileText className="h-5 w-5 text-v2-ink-muted mx-auto mb-2" />
            <p className="text-[12px] text-v2-ink-muted">
              {search
                ? `No guides match "${search}".`
                : "No PDF guides uploaded yet. Add a PDF content block to a training module to see it here."}
            </p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-v2-card-tinted/40 border-b border-v2-ring">
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] font-semibold text-v2-ink-muted">
                <th className="px-4 py-2">Guide</th>
                <th className="px-3 py-2 hidden md:table-cell">Category</th>
                <th className="px-3 py-2 hidden lg:table-cell">File</th>
                <th className="px-3 py-2 text-right hidden md:table-cell">
                  Size
                </th>
                <th className="px-3 py-2 w-[1%]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const isOpening = openingId === row.contentId;
                return (
                  <tr
                    key={row.contentId}
                    onClick={() => handleOpen(row)}
                    className="border-b border-v2-ring/60 last:border-0 hover:bg-v2-accent-soft/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-v2-ink-muted flex-shrink-0" />
                        <span className="font-medium text-v2-ink truncate">
                          {row.moduleTitle}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-v2-ink-muted">
                      {formatCategory(row.category)}
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell text-v2-ink-muted font-mono text-[11px] truncate max-w-[24ch]">
                      {row.fileName}
                    </td>
                    <td className="px-3 py-2 text-right hidden md:table-cell text-v2-ink-muted tabular-nums">
                      {formatBytes(row.fileSize)}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PillButton
                        tone="ghost"
                        size="sm"
                        onClick={() => handleOpen(row)}
                        disabled={isOpening}
                        leadingIcon={
                          isOpening ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        {isOpening ? "Opening…" : "Open"}
                      </PillButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SoftCard>
    </div>
  );
}
