import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
} from "lucide-react";
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
  useDeleteGuide,
  useUnderwritingGuides,
} from "../hooks/guides/useUnderwritingGuides";
import {
  groupGuidesByCarrier,
  type GuideWithCarrier,
} from "./guides-library/groupGuidesByCarrier";
import { CarrierGuidesSection } from "./guides-library/CarrierGuidesSection";
import { GuideUploadDialog } from "./guides-library/GuideUploadDialog";

// Mirrors the DB `is_imo_admin()` write gate (roles ∩ {admin, imo_admin,
// superadmin}); 'super-admin' covers the hyphenated form seen in user_profiles.
// Purely cosmetic — RLS is the real enforcer of who can upload/delete.
const ADMIN_ROLES = ["admin", "imo_admin", "superadmin", "super-admin"];
const PAGE_SIZE = 8; // carriers per page

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

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [presetCarrierId, setPresetCarrierId] = useState<string | null>(null);
  const [guideToDelete, setGuideToDelete] = useState<GuideWithCarrier | null>(
    null,
  );

  const totalGuides = guides?.length ?? 0;

  const groups = useMemo(() => {
    const list = (guides ?? []) as GuideWithCarrier[];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (g) =>
            (g.carrier?.name ?? "").toLowerCase().includes(q) ||
            g.name.toLowerCase().includes(q) ||
            (g.file_name ?? "").toLowerCase().includes(q),
        )
      : list;
    return groupGuidesByCarrier(filtered);
  }, [guides, search]);

  // Reset to the first page whenever the search narrows/clears the list.
  useEffect(() => setPage(1), [search]);

  const totalCarriers = groups.length;
  const totalPages = Math.max(1, Math.ceil(totalCarriers / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * PAGE_SIZE;
  const pageGroups = groups.slice(start, start + PAGE_SIZE);

  const openAdd = (carrierId: string | null) => {
    setPresetCarrierId(carrierId);
    setUploadOpen(true);
  };

  const confirmDelete = () => {
    if (!guideToDelete) return;
    // Close only on success; on failure keep the dialog open so the error toast
    // is actionable and the user can retry (the guide is still listed).
    deleteGuide.mutate(guideToDelete, {
      onSuccess: () => setGuideToDelete(null),
    });
  };

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Cap>TRAINING</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Underwriting Guides
              </h1>
              {!isLoading && !error ? (
                <span className="text-[11px] text-v2-ink-muted">
                  <span className="font-semibold tabular-nums text-v2-ink">
                    {totalGuides}
                  </span>{" "}
                  guide{totalGuides === 1 ? "" : "s"} across{" "}
                  <span className="font-semibold tabular-nums text-v2-ink">
                    {totalCarriers}
                  </span>{" "}
                  carrier{totalCarriers === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-v2-ink-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search carrier or guide…"
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

          {isLoading ? (
            <SoftCard padding="md">
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
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
          ) : totalGuides === 0 ? (
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
          ) : pageGroups.length === 0 ? (
            <SoftCard padding="lg">
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No matching guides"
                hint={`Nothing matches "${search.trim()}". Try a different carrier or guide name.`}
              />
            </SoftCard>
          ) : (
            <div className="flex flex-col gap-6">
              {pageGroups.map((group) => (
                <CarrierGuidesSection
                  key={group.carrierId}
                  group={group}
                  canManage={canManage}
                  onAdd={openAdd}
                  onDeleteGuide={setGuideToDelete}
                />
              ))}

              {totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t border-v2-ring/50 pt-3">
                  <span className="text-[11px] tabular-nums text-v2-ink-muted">
                    Carriers {start + 1}–
                    {Math.min(start + PAGE_SIZE, totalCarriers)} of{" "}
                    {totalCarriers}
                  </span>
                  <div className="flex items-center gap-2">
                    <PillButton
                      tone="ghost"
                      size="sm"
                      onClick={() => setPage(Math.max(1, pageSafe - 1))}
                      disabled={pageSafe <= 1}
                      leadingIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                    >
                      Prev
                    </PillButton>
                    <PillButton
                      tone="ghost"
                      size="sm"
                      onClick={() =>
                        setPage(Math.min(totalPages, pageSafe + 1))
                      }
                      disabled={pageSafe >= totalPages}
                      trailingIcon={<ChevronRight className="h-3.5 w-3.5" />}
                    >
                      Next
                    </PillButton>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
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
