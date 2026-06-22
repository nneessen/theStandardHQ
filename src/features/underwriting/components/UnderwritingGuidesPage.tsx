import { useEffect, useMemo, useState } from "react";
import { AlertCircle, FileText, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { SectionShell, SoftCard, PillButton } from "@/components/v2";
import { Cap, EmptyState, T } from "@/components/board";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import {
  downloadGuidePdf,
  openGuidePdf,
  useDeleteGuide,
  useUnderwritingGuides,
} from "../hooks/guides/useUnderwritingGuides";
import {
  groupGuidesByCarrier,
  type GuideWithCarrier,
} from "./guides-library/groupGuidesByCarrier";
import {
  CATEGORIES,
  carrierAccent,
  enrichGuide,
  fmtDate,
  fmtSize,
  type Category,
  type EnrichedGuide,
} from "./guides-library/guideAttributes";
import { CarrierRail, type Scope } from "./guides-library/CarrierRail";
import { DocumentList } from "./guides-library/DocumentList";
import { GuidePreview } from "./guides-library/GuidePreview";
import { GuideUploadDialog } from "./guides-library/GuideUploadDialog";

// Mirrors the DB `is_imo_admin()` write gate (roles ∩ {admin, imo_admin,
// superadmin}); 'super-admin' covers the hyphenated form seen in user_profiles.
// Purely cosmetic — RLS is the real enforcer of who can upload/delete.
const ADMIN_ROLES = ["admin", "imo_admin", "superadmin", "super-admin"];

export default function UnderwritingGuidesPage() {
  const { user } = useAuth();
  const { effectiveImoId } = useImo();
  // Write controls require a single acting IMO — the carrier picker and the
  // upload are scoped to effectiveImoId. In "All IMOs" mode (null) hide them
  // rather than open an upload dialog with an empty, unselectable carrier list.
  const canManage =
    !!effectiveImoId &&
    ((user?.roles ?? []).some((r) => ADMIN_ROLES.includes(r)) ||
      user?.is_admin === true);

  const { data: guides, isLoading, error } = useUnderwritingGuides();
  const deleteGuide = useDeleteGuide();

  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [presetCarrierId, setPresetCarrierId] = useState<string | null>(null);
  const [guideToDelete, setGuideToDelete] = useState<GuideWithCarrier | null>(
    null,
  );
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Enrich once: attach derived category / product / carrier-accent.
  const enriched: EnrichedGuide[] = useMemo(
    () => (guides ?? []).map(enrichGuide),
    [guides],
  );

  // Carrier groups (alpha-sorted, with counts) drive the rail + header stats.
  const carrierGroups = useMemo(
    () => groupGuidesByCarrier(guides ?? []),
    [guides],
  );
  const railCarriers = useMemo(
    () =>
      carrierGroups.map((g) => ({
        id: g.carrierId,
        name: g.carrierName,
        accent: carrierAccent(g.carrierId),
        count: g.guides.length,
      })),
    [carrierGroups],
  );

  const railCategories = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const g of enriched)
      counts.set(g._category, (counts.get(g._category) ?? 0) + 1);
    return CATEGORIES.filter((c) => counts.has(c)).map((category) => ({
      category,
      count: counts.get(category) ?? 0,
    }));
  }, [enriched]);

  const stats = useMemo(() => {
    const totalSize = enriched.reduce(
      (sum, g) => sum + (g.file_size_bytes ?? 0),
      0,
    );
    let updated = 0;
    for (const g of enriched) {
      const t = Date.parse(g.updated_at ?? g.created_at ?? "");
      if (!Number.isNaN(t) && t > updated) updated = t;
    }
    return {
      guides: enriched.length,
      carriers: railCarriers.length,
      categories: railCategories.length,
      totalSize,
      updated: updated ? new Date(updated).toISOString() : null,
    };
  }, [enriched, railCarriers.length, railCategories.length]);

  // Filter by scope + free-text search, then sort by name.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inScope = enriched.filter((g) => {
      if (scope.kind === "carrier") return g.carrier_id === scope.id;
      if (scope.kind === "category") return g._category === scope.category;
      return true;
    });
    const matched = q
      ? inScope.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            (g.carrier?.name ?? "").toLowerCase().includes(q) ||
            g._category.toLowerCase().includes(q) ||
            g._product.toLowerCase().includes(q),
        )
      : inScope;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...matched].sort(
      (a, b) =>
        dir * a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [enriched, scope, query, sortDir]);

  // Reset to page 1 whenever the result set changes shape.
  useEffect(() => setPage(1), [scope, query, pageSize, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (pageSafe - 1) * pageSize,
    (pageSafe - 1) * pageSize + pageSize,
  );

  // Preview follows the selection; falls back to the first row in scope so the
  // pane is never blank when results exist. The same id drives row highlight.
  const activeGuide =
    filtered.find((g) => g.id === selectedDocId) ?? filtered[0] ?? null;

  const onScope = (next: Scope) => {
    setScope(next);
    setSelectedDocId(null);
  };

  const handleOpen = async (g: EnrichedGuide) => {
    setOpeningId(g.id);
    try {
      await openGuidePdf(g.storage_path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open PDF.");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDownload = async (g: EnrichedGuide) => {
    setDownloadingId(g.id);
    try {
      await downloadGuidePdf(g.storage_path, g.file_name);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not download PDF.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const openAdd = (carrierId: string | null) => {
    setPresetCarrierId(carrierId);
    setUploadOpen(true);
  };

  const confirmDelete = () => {
    if (!guideToDelete) return;
    deleteGuide.mutate(guideToDelete, {
      onSuccess: () => setGuideToDelete(null),
    });
  };

  return (
    <SectionShell fullHeight={false} className="dashboard-canvas">
      <div className="flex flex-col gap-3 p-3 md:h-[calc(100vh-3rem)] md:overflow-hidden lg:p-4">
        {/* Header */}
        <header className="flex flex-shrink-0 flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Cap>Training Library</Cap>
            <h1
              style={{
                font: `800 24px ${T.disp}`,
                color: T.ink,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: 0,
              }}
            >
              Underwriting Guides
            </h1>
            {!isLoading && !error && stats.guides > 0 ? (
              <span
                style={{
                  font: `600 11px ${T.mono}`,
                  color: T.mut2,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "0.02em",
                }}
              >
                {stats.guides} guides · {stats.carriers} carriers ·{" "}
                {stats.categories} categories · {fmtSize(stats.totalSize)}
                {stats.updated ? ` · Updated ${fmtDate(stats.updated)}` : ""}
              </span>
            ) : null}
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-v2-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search document, carrier, category…"
                className="h-8 pl-8 text-[12px]"
              />
            </div>
            {canManage ? (
              <PillButton
                tone="black"
                size="sm"
                onClick={() => openAdd(null)}
                leadingIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add guide
              </PillButton>
            ) : null}
          </div>
        </header>

        {/* Body */}
        {isLoading ? (
          <SoftCard padding="md">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          </SoftCard>
        ) : error ? (
          <SoftCard padding="lg">
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-[12px] text-v2-ink-muted">
                {error instanceof Error
                  ? error.message
                  : "Failed to load underwriting guides."}
              </p>
            </div>
          </SoftCard>
        ) : stats.guides === 0 ? (
          <SoftCard padding="lg">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No underwriting guides yet"
              hint={
                canManage
                  ? "Upload your first carrier underwriting guide PDF to start the library."
                  : "Carrier underwriting guides will appear here once an admin uploads them."
              }
            />
            {canManage ? (
              <div className="flex justify-center pb-4">
                <PillButton
                  tone="black"
                  size="sm"
                  onClick={() => openAdd(null)}
                  leadingIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add guide
                </PillButton>
              </div>
            ) : null}
          </SoftCard>
        ) : (
          <div
            className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl md:grid-cols-[230px_minmax(0,1fr)_312px]"
            style={{ border: `1px solid ${T.line}`, background: T.bg }}
          >
            <div className="flex max-h-[38vh] min-h-0 flex-col md:max-h-none">
              <CarrierRail
                scope={scope}
                onScope={onScope}
                total={stats.guides}
                carriers={railCarriers}
                categories={railCategories}
              />
            </div>

            <div className="flex min-h-0 flex-col border-t border-v2-ring/40 md:border-t-0">
              <DocumentList
                scope={scope}
                rows={pageRows}
                totalFiltered={filtered.length}
                page={pageSafe}
                pageSize={pageSize}
                sortDir={sortDir}
                selectedId={activeGuide?.id ?? null}
                showCarrierCol={scope.kind !== "carrier"}
                onSelect={setSelectedDocId}
                onOpen={handleOpen}
                onPage={setPage}
                onPageSize={setPageSize}
                onToggleSort={() =>
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                }
              />
            </div>

            <div className="hidden min-h-0 flex-col md:flex">
              <GuidePreview
                guide={activeGuide}
                canManage={canManage}
                opening={!!openingId && openingId === activeGuide?.id}
                downloading={
                  !!downloadingId && downloadingId === activeGuide?.id
                }
                onOpen={handleOpen}
                onDownload={handleDownload}
                onDelete={setGuideToDelete}
              />
            </div>
          </div>
        )}
      </div>

      <GuideUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        presetCarrierId={presetCarrierId}
      />

      <AlertDialog
        open={guideToDelete !== null}
        onOpenChange={(o) => {
          if (!o) setGuideToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this guide?</AlertDialogTitle>
            <AlertDialogDescription>
              {guideToDelete
                ? `"${guideToDelete.name}" will be removed for everyone in your IMO. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGuide.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteGuide.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGuide.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}
