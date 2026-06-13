// src/features/hierarchy/components/DownlinePerformance.tsx

import { useMemo, useState, type ReactNode } from "react";
import { Edit, Shield, Trash2, Users } from "lucide-react";
import { SectionShell } from "@/components/v2";
import { Board, Cap, FlapTile, Pill, EmptyState, T } from "@/components/board";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/format";
import {
  useAllDownlinePerformance,
  useMyDownlines,
  useUpdateAgentHierarchy,
  useCurrentUserProfile,
} from "@/hooks";

import { useDeleteUser } from "@/hooks/admin";
import { toast } from "sonner";
import type {
  UserProfile,
  HierarchyChangeRequest,
} from "@/types/hierarchy.types";

interface DownlinePerformanceProps {
  className?: string;
}

/** Charcoal "Board" page shell + departure header shared by every render state. */
function DownlineShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className={`flex flex-col gap-4 ${className ?? ""}`}>
          <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Cap>AGENCY HIERARCHY</Cap>
            <h1
              style={{
                font: `800 26px ${T.disp}`,
                color: T.ink,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: 0,
              }}
            >
              Downline Performance
            </h1>
          </header>
          {children}
        </div>
      </div>
    </SectionShell>
  );
}

/**
 * Dialog for editing agent hierarchy assignment (admin only)
 */
function EditHierarchyDialog({
  agent,
  allAgents,
  open,
  onOpenChange,
  onSave,
}: {
  agent: UserProfile | null;
  allAgents: UserProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (request: HierarchyChangeRequest) => Promise<void>;
}) {
  const [selectedUplineId, setSelectedUplineId] = useState<string | null>(
    agent?.upline_id || null,
  );
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!agent) return;

    setIsSaving(true);
    try {
      await onSave({
        agent_id: agent.id,
        new_upline_id: selectedUplineId,
        reason: reason || "Hierarchy adjustment",
      });
      toast.success("Hierarchy updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update hierarchy");
      console.error("Error updating hierarchy:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out the agent itself and its downlines to prevent circular references
  const availableUplines = allAgents.filter(
    (a) =>
      a.id !== agent?.id && !(a.hierarchy_path || "").includes(agent?.id || ""),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Hierarchy Assignment</DialogTitle>
          <DialogDescription>
            Assign {agent?.email} to a new upline or make them a root agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="upline">Upline Agent</Label>
            <select
              id="upline"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedUplineId || ""}
              onChange={(e) => setSelectedUplineId(e.target.value || null)}
            >
              <option value="">No Upline (Root Agent)</option>
              {availableUplines.map((upline) => (
                <option key={upline.id} value={upline.id}>
                  {upline.email} (Level {upline.hierarchy_depth})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <textarea
              id="reason"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              placeholder="e.g., Agent transfer, organizational restructure"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Changing hierarchy will affect override calculations for all
              policies going forward. Existing overrides will not be
              recalculated.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * DownlinePerformance - Combined view of downline performance metrics and hierarchy management
 * Shows KPI metrics for all agents with admin actions for hierarchy editing
 */
export function DownlinePerformance({ className }: DownlinePerformanceProps) {
  const { data: performanceData, isLoading } = useAllDownlinePerformance();
  const { data: downlines } = useMyDownlines();
  const updateHierarchy = useUpdateAgentHierarchy();
  const { data: profile } = useCurrentUserProfile();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<UserProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteAgent, setDeleteAgent] = useState<UserProfile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const itemsPerPage = 50;

  // Check admin status from database profile
  const isAdmin = profile?.is_admin === true;

  // An upline can delete a direct downline whose role is 'recruit' or 'agent'.
  // Server enforces the same rule via RLS + admin_deleteuser RPC.
  const canDeleteDownline = (target: UserProfile | undefined): boolean => {
    if (!target || !profile?.id) return false;
    if (isAdmin) return true;
    const isDirectUpline =
      target.upline_id === profile.id || target.recruiter_id === profile.id;
    const targetRoles = target.roles ?? [];
    const isDeletableRole =
      targetRoles.includes("recruit") || targetRoles.includes("agent");
    return isDirectUpline && isDeletableRole;
  };

  // Filter by search term
  const filteredData =
    performanceData?.filter((d) =>
      d.agent_email.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || [];

  // Whole-downline aggregates for the summary band (not affected by search).
  const totals = useMemo(() => {
    const rows = performanceData ?? [];
    const sum = (fn: (d: (typeof rows)[number]) => number) =>
      rows.reduce((acc, d) => acc + (fn(d) || 0), 0);
    const persistencyVals = rows
      .map((d) => d.persistency_rate)
      .filter((v) => Number.isFinite(v));
    return {
      agents: rows.length,
      premium: sum((d) => d.total_premium),
      policies: sum((d) => d.policies_written),
      active: sum((d) => d.policies_active),
      overrides: sum((d) => d.total_overrides_generated),
      persistency: persistencyVals.length
        ? persistencyVals.reduce((a, b) => a + b, 0) / persistencyVals.length
        : 0,
    };
  }, [performanceData]);

  // Paginate
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleEditAgent = (agentEmail: string) => {
    const agent = downlines?.find((d) => d.email === agentEmail);
    if (agent) {
      setSelectedAgent(agent);
      setDialogOpen(true);
    }
  };

  const handleDeleteAgent = (agentEmail: string) => {
    const agent = downlines?.find((d) => d.email === agentEmail);
    if (agent) {
      setDeleteAgent(agent);
      setDeleteDialogOpen(true);
    }
  };

  const handleSaveHierarchy = async (request: HierarchyChangeRequest) => {
    await updateHierarchy.mutateAsync(request);
  };

  if (isLoading) {
    return (
      <DownlineShell className={className}>
        <Board pad={40}>
          <div className="text-center text-sm text-v2-ink-muted">
            Loading downline data…
          </div>
        </Board>
      </DownlineShell>
    );
  }

  if (!performanceData || performanceData.length === 0) {
    return (
      <DownlineShell className={className}>
        <Board pad={20}>
          <EmptyState
            icon={<Users size={20} />}
            title="No downline agents yet"
            hint="When agents are assigned to your downline, their performance metrics will appear here."
            pad={48}
          />
        </Board>
      </DownlineShell>
    );
  }

  return (
    <DownlineShell className={className}>
      {/* Summary band — whole-downline aggregates */}
      <Board pad={18}>
        <Cap style={{ marginBottom: 14 }}>Downline Totals</Cap>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
            gap: 10,
          }}
        >
          <FlapTile label="Agents" value={totals.agents.toLocaleString()} />
          <FlapTile
            label="Total Premium"
            value={formatCurrency(totals.premium)}
            tone="blue"
          />
          <FlapTile label="Policies" value={totals.policies.toLocaleString()} />
          <FlapTile label="Active" value={totals.active.toLocaleString()} />
          <FlapTile
            label="Overrides Gen."
            value={formatCurrency(totals.overrides)}
            tone="green"
          />
          <FlapTile
            label="Avg Persistency"
            value={
              totals.policies > 0 ? `${totals.persistency.toFixed(1)}%` : "—"
            }
            tone={
              totals.policies === 0
                ? "default"
                : totals.persistency >= 90
                  ? "green"
                  : totals.persistency >= 80
                    ? "amber"
                    : "red"
            }
          />
        </div>
      </Board>

      {/* Performance table */}
      <Board pad={0} style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            padding: "16px 18px 12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Cap>Performance & Hierarchy</Cap>
            {isAdmin && <Pill tone="blue">Admin Mode</Pill>}
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search by email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 max-w-[260px] text-[12px]"
            />
            <div className="text-[11px] text-v2-ink-muted whitespace-nowrap">
              {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of{" "}
              {filteredData.length}
            </div>
          </div>
        </div>
        <div className="px-2 pb-3">
          <div className="rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Policies</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead className="text-right">Avg Premium</TableHead>
                  <TableHead className="text-right">Persistency</TableHead>
                  <TableHead className="text-right">Override Gen.</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground"
                    >
                      No agents found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((agent) => (
                    <TableRow key={agent.agent_id}>
                      <TableCell className="font-medium">
                        {agent.agent_email}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          L{agent.hierarchy_depth}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.policies_written}
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.policies_active}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(agent.total_premium)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(agent.avg_premium)}
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.persistency_rate.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(agent.total_overrides_generated)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAgent(agent.agent_email)}
                              aria-label="Edit hierarchy"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteDownline(
                            downlines?.find(
                              (d) => d.email === agent.agent_email,
                            ),
                          ) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteAgent(agent.agent_email)
                              }
                              aria-label="Delete agent"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 px-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-1.5 text-[12px] rounded-md transition-colors disabled:opacity-50"
                style={{
                  background: T.tile,
                  border: `1px solid ${T.line2}`,
                  color: T.ink,
                }}
              >
                Previous
              </button>
              <div className="text-[11px] text-v2-ink-muted">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-4 py-1.5 text-[12px] rounded-md transition-colors disabled:opacity-50"
                style={{
                  background: T.tile,
                  border: `1px solid ${T.line2}`,
                  color: T.ink,
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </Board>

      {/* Edit Hierarchy Dialog (Admin Only) */}
      {isAdmin && (
        <EditHierarchyDialog
          agent={selectedAgent}
          allAgents={downlines || []}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSaveHierarchy}
        />
      )}

      <DeleteAgentDialog
        agent={deleteAgent}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </DownlineShell>
  );
}

interface DeleteAgentDialogProps {
  agent: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DeleteAgentDialog({
  agent,
  open,
  onOpenChange,
}: DeleteAgentDialogProps) {
  const deleteUser = useDeleteUser();

  const handleDelete = async () => {
    if (!agent) return;
    try {
      await deleteUser.mutateAsync(agent.id);
      const name =
        [agent.first_name, agent.last_name].filter(Boolean).join(" ") ||
        agent.email;
      toast.success(`${name} has been removed from your team.`);
      onOpenChange(false);
    } catch (error) {
      console.error("[DownlinePerformance] Delete agent failed:", error);
      const message =
        error instanceof Error ? error.message : "Please try again.";
      toast.error(`Failed to delete agent: ${message}`);
    }
  };

  const displayName =
    agent &&
    ([agent.first_name, agent.last_name].filter(Boolean).join(" ") ||
      agent.email);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete agent?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes{" "}
            <span className="font-semibold">{displayName}</span> and all of
            their commissions, policies, training progress, and account access.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteUser.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive text-destructive-foreground"
            onClick={handleDelete}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
