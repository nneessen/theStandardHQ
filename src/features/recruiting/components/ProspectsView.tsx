// src/features/recruiting/components/ProspectsView.tsx
// "Prospects" tab — a lightweight follow-up list of people the agent has talked
// to but who haven't committed to joining. No account, no email (unlike recruits).
// A Convert action promotes a prospect into a real recruit via the Add Recruit dialog.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { SectionShell, PillButton, PillNav } from "@/components/v2";
import { Board, Cap, Num, FlapTile, EmptyState, T } from "@/components/board";
import { Input } from "@/components/ui/input";
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
import { AddProspectDialog } from "./AddProspectDialog";
import { ProspectListTable } from "./ProspectListTable";
import { AddRecruitDialog } from "./AddRecruitDialog";
import { useProspects } from "../hooks/useProspects";
import {
  useUpdateProspect,
  useDeleteProspect,
} from "../hooks/useProspectMutations";
import {
  PROSPECT_STATUS_LABELS,
  PROSPECT_STATUSES,
  type Prospect,
  type ProspectStatus,
} from "@/types/prospect.types";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  ...PROSPECT_STATUSES.map((s) => ({
    value: s,
    label: PROSPECT_STATUS_LABELS[s],
  })),
];

export function ProspectsView() {
  const { data: prospects = [], isLoading } = useProspects();
  const updateProspect = useUpdateProspect();
  const deleteProspect = useDeleteProspect();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editProspect, setEditProspect] = useState<Prospect | null>(null);
  const [convertProspect, setConvertProspect] = useState<Prospect | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prospect | null>(null);

  const stats = useMemo(() => {
    const now = Date.now();
    let following = 0;
    let overdue = 0;
    let converted = 0;
    for (const p of prospects) {
      const status = (p.status as ProspectStatus) ?? "new";
      if (status === "following_up") following += 1;
      if (status === "converted") converted += 1;
      const open = status !== "converted" && status !== "not_interested";
      if (
        open &&
        p.next_follow_up_at &&
        new Date(p.next_follow_up_at).getTime() < now
      )
        overdue += 1;
    }
    return { total: prospects.length, following, overdue, converted };
  }, [prospects]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return prospects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!term) return true;
      const haystack =
        `${p.first_name} ${p.last_name ?? ""} ${p.email ?? ""} ${p.phone ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [prospects, statusFilter, search]);

  const handleStatusChange = (prospect: Prospect, status: ProspectStatus) => {
    updateProspect.mutate({
      id: prospect.id,
      patch: {
        status,
        last_contacted_at:
          status !== prospect.status && status !== "converted"
            ? new Date().toISOString()
            : prospect.last_contacted_at,
      },
    });
  };

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>PROSPECTS</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Prospects
              </h1>
            </div>
            <PillButton
              tone="black"
              size="sm"
              onClick={() => setAddOpen(true)}
              leadingIcon={<Users className="h-3.5 w-3.5" />}
            >
              Add prospect
            </PillButton>
          </header>

          {/* Tab nav — Pipeline / Your Page / Prospects */}
          <div className="flex items-center gap-1.5">
            <Link to="/recruiting">
              <PillButton tone="ghost" size="sm">
                Pipeline
              </PillButton>
            </Link>
            <Link to="/recruiting/your-page">
              <PillButton tone="ghost" size="sm">
                Your Page
              </PillButton>
            </Link>
            <PillButton tone="black" size="sm">
              Prospects
            </PillButton>
          </div>

          {/* Stats band */}
          <Board
            pad={20}
            rivets
            style={{
              background: `radial-gradient(130% 180% at 0% 0%, rgba(107,151,255,0.12), rgba(107,151,255,0.01)), ${T.panelGradient}`,
              border: "1px solid rgba(107,151,255,0.28)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div style={{ flexShrink: 0 }}>
                <Cap>TRACKED</Cap>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <Num text={String(stats.total)} size="xl" lit />
                  <span style={{ font: `500 12px ${T.data}`, color: T.mut }}>
                    {stats.total === 1 ? "prospect" : "prospects"}
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
                  gap: 10,
                  flex: 1,
                  minWidth: 240,
                }}
              >
                <FlapTile
                  label="Following up"
                  value={String(stats.following)}
                  tone="blue"
                />
                <FlapTile
                  label="Overdue"
                  value={String(stats.overdue)}
                  tone={stats.overdue > 0 ? "red" : "default"}
                />
                <FlapTile
                  label="Converted"
                  value={String(stats.converted)}
                  tone="green"
                />
              </div>
            </div>
          </Board>

          {/* Filter row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <PillNav
              size="sm"
              activeValue={statusFilter}
              onChange={setStatusFilter}
              items={STATUS_FILTERS}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              className="h-7 text-[11px] w-[220px]"
            />
          </div>

          {/* Table / empty states */}
          <Board pad={0} rivets>
            {isLoading ? (
              <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                Loading prospects…
              </div>
            ) : prospects.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No prospects yet"
                hint="Add people you've talked to so you can keep in touch and follow up — no account or email is created."
                pad={36}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No matching prospects"
                hint="Try a different status filter or search term."
                pad={36}
              />
            ) : (
              <div className="p-2">
                <ProspectListTable
                  prospects={filtered}
                  onEdit={setEditProspect}
                  onConvert={setConvertProspect}
                  onDelete={setDeleteTarget}
                  onStatusChange={handleStatusChange}
                />
              </div>
            )}
          </Board>
        </div>
      </div>

      {/* Add / Edit dialog */}
      <AddProspectDialog open={addOpen} onOpenChange={setAddOpen} />
      <AddProspectDialog
        open={!!editProspect}
        onOpenChange={(o) => !o && setEditProspect(null)}
        prospect={editProspect}
      />

      {/* Convert → recruit: opens Add Recruit prefilled with the prospect's info.
          Remounts per prospect (key) so the form seeds fresh from initialValues.
          On success the prospect is stamped converted. */}
      {convertProspect && (
        <AddRecruitDialog
          key={convertProspect.id}
          open
          onOpenChange={(o) => !o && setConvertProspect(null)}
          initialValues={{
            first_name: convertProspect.first_name,
            last_name: convertProspect.last_name ?? "",
            email: convertProspect.email ?? "",
            phone: convertProspect.phone ?? "",
            state: convertProspect.state ?? "",
            resident_state: convertProspect.state ?? "",
          }}
          onSuccess={(recruitId) => {
            updateProspect.mutate({
              id: convertProspect.id,
              patch: {
                status: "converted",
                converted_recruit_id: recruitId,
                converted_at: new Date().toISOString(),
              },
            });
            setConvertProspect(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Remove prospect?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              This permanently removes{" "}
              <span className="font-medium">
                {deleteTarget?.first_name} {deleteTarget?.last_name}
              </span>{" "}
              from your prospects. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-[11px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 text-[11px] bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteProspect.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}
