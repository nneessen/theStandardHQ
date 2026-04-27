// src/features/training-modules/components/admin/AssignModuleDialog.tsx
import { useState, useCallback, useMemo } from "react";
import { Check, Loader2, Search, X, Users, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateTrainingAssignment,
  useTrainingAssignments,
} from "../../hooks/useTrainingAssignments";
import { useImo } from "@/contexts/ImoContext";
import { useMyDownlines } from "@/hooks/hierarchy";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { PRIORITY_LEVELS } from "../../types/training-module.types";
import type {
  TrainingModule,
  PriorityLevel,
} from "../../types/training-module.types";
// eslint-disable-next-line no-restricted-imports
import type { UserSearchResult } from "@/services/users/userSearchService";
import { toast } from "sonner";

// UI-only assignment modes. "downline" creates one individual assignment row
// per downline user (DB type stays "individual"). "agency" and "individual"
// map 1:1 to the DB assignment_type column.
type AssignMode = "individual" | "agency" | "downline";

interface AssignModuleDialogProps {
  module: TrainingModule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignModuleDialog({
  module,
  open,
  onOpenChange,
}: AssignModuleDialogProps) {
  const { agency } = useImo();
  const createAssignment = useCreateTrainingAssignment();
  const { data: existingAssignments = [] } = useTrainingAssignments(module.id);
  const { data: downlines = [], isLoading: downlinesLoading } =
    useMyDownlines();

  const [assignMode, setAssignMode] = useState<AssignMode>("individual");
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("normal");
  const [isMandatory, setIsMandatory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load all approved agents with no limit — filter client-side
  const { data: allAgents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["assign-dialog-agents"],
    queryFn: async (): Promise<UserSearchResult[]> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, roles, agent_status")
        .eq("approval_status", "approved")
        .order("first_name", { ascending: true })
        .order("last_name", { ascending: true });
      if (error) throw error;
      return (data || []) as UserSearchResult[];
    },
    staleTime: 60000,
  });

  // Detect active agency-wide assignment. If present, every agent in that
  // agency is effectively already assigned — prevents creating duplicate
  // individual rows that would point at people the agency row already covers.
  const activeAgencyAssignment = useMemo(
    () =>
      existingAssignments.find(
        (a) =>
          a.assignment_type === "agency" &&
          a.status === "active" &&
          a.assigned_to === null,
      ) ?? null,
    [existingAssignments],
  );

  // Build set of already-assigned user IDs for this module (individual rows).
  const alreadyAssignedIds = useMemo(
    () =>
      new Set(
        existingAssignments
          .filter((a) => a.assigned_to !== null && a.status === "active")
          .map((a) => a.assigned_to as string),
      ),
    [existingAssignments],
  );

  // Filter: exclude already-assigned agents, then apply search term.
  const visibleAgents = useMemo(() => {
    const unassigned = allAgents.filter((u) => !alreadyAssignedIds.has(u.id));
    if (!searchTerm) return unassigned;
    const term = searchTerm.toLowerCase();
    return unassigned.filter(
      (u) =>
        `${u.first_name ?? ""} ${u.last_name ?? ""}`
          .toLowerCase()
          .includes(term) || u.email.toLowerCase().includes(term),
    );
  }, [allAgents, alreadyAssignedIds, searchTerm]);

  // Downline breakdown — how many already assigned vs eligible to assign.
  const downlineStats = useMemo(() => {
    const total = downlines.length;
    const alreadyAssigned = downlines.filter((u) =>
      alreadyAssignedIds.has(u.id),
    ).length;
    const eligible = total - alreadyAssigned;
    return { total, alreadyAssigned, eligible };
  }, [downlines, alreadyAssignedIds]);

  const toggleUser = useCallback((user: UserSearchResult) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      if (exists) return prev.filter((u) => u.id !== user.id);
      return [...prev, user];
    });
  }, []);

  const isSelected = (userId: string) =>
    selectedUsers.some((u) => u.id === userId);

  // Bulk individual create with per-user error tolerance. Used by both
  // "individual" (selectedUsers) and "downline" (auto-selected downline).
  const createIndividualAssignments = async (users: { id: string }[]) => {
    if (!agency) return;
    const results = await Promise.allSettled(
      users.map((user) =>
        createAssignment.mutateAsync({
          input: {
            module_id: module.id,
            agency_id: agency.id,
            assigned_to: user.id,
            assignment_type: "individual",
            due_date: dueDate || undefined,
            priority,
            is_mandatory: isMandatory,
          },
          moduleVersion: module.version,
        }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded > 0 && failed === 0) {
      toast.success(
        `${succeeded} assignment${succeeded !== 1 ? "s" : ""} created`,
      );
    } else if (failed > 0) {
      toast.warning(
        `${succeeded} assignment${succeeded !== 1 ? "s" : ""} created, ${failed} failed (already assigned or blocked)`,
      );
    }
  };

  const handleSubmit = async () => {
    if (!agency) return;

    setIsSubmitting(true);
    try {
      if (assignMode === "agency") {
        if (activeAgencyAssignment) {
          toast.info("This module is already assigned to the entire agency.");
          return;
        }
        await createAssignment.mutateAsync({
          input: {
            module_id: module.id,
            agency_id: agency.id,
            assignment_type: "agency",
            due_date: dueDate || undefined,
            priority,
            is_mandatory: isMandatory,
          },
          moduleVersion: module.version,
        });
        toast.success("Module assigned to entire agency");
      } else if (assignMode === "downline") {
        const eligibleDownlines = downlines.filter(
          (u) => !alreadyAssignedIds.has(u.id),
        );
        if (eligibleDownlines.length === 0) {
          toast.info("All downline agents already have this module assigned.");
          return;
        }
        await createIndividualAssignments(eligibleDownlines);
      } else {
        if (selectedUsers.length === 0) return;
        await createIndividualAssignments(selectedUsers);
      }
      resetAndClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setAssignMode("individual");
    setSelectedUsers([]);
    setSearchTerm("");
    setDueDate("");
    setPriority("normal");
    setIsMandatory(false);
    onOpenChange(false);
  };

  const canSubmit =
    !isSubmitting &&
    !activeAgencyAssignment && // No further assignments needed if whole agency is covered
    (assignMode === "agency" ||
      (assignMode === "individual" && selectedUsers.length > 0) ||
      (assignMode === "downline" && downlineStats.eligible > 0));

  const unassignedCount = allAgents.length - alreadyAssignedIds.size;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetAndClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Assign: {module.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Agency-wide conflict banner — if an active agency assignment
              exists, no further assignments can be created for this module
              because the agency row already covers everyone in the agency. */}
          {activeAgencyAssignment && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <div className="font-medium">
                  Already assigned to the entire agency
                </div>
                <div className="text-amber-800 dark:text-amber-200/80">
                  To change who has this module, revoke the existing agency
                  assignment first.
                </div>
              </div>
            </div>
          )}

          {/* Assignment Mode */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-v2-ink-muted">
              Assignment Type
            </label>
            <Select
              value={assignMode}
              onValueChange={(v) => {
                setAssignMode(v as AssignMode);
                setSelectedUsers([]);
              }}
              disabled={!!activeAgencyAssignment}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual" className="text-xs">
                  Individual Users
                </SelectItem>
                <SelectItem value="downline" className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    My Team (Downline)
                  </div>
                </SelectItem>
                <SelectItem value="agency" className="text-xs">
                  Entire Agency
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Downline summary — shown when "My Team" is selected */}
          {assignMode === "downline" && !activeAgencyAssignment && (
            <div className="rounded-md border border-v2-ring bg-v2-canvas px-3 py-2.5 text-[11px] dark:border-v2-ring-strong dark:bg-v2-card-tinted/50">
              {downlinesLoading ? (
                <div className="flex items-center gap-2 text-v2-ink-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading your downline...
                </div>
              ) : downlineStats.total === 0 ? (
                <div className="text-v2-ink-muted">
                  You don&apos;t have any agents in your downline yet.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-v2-ink-muted dark:text-v2-ink-muted">
                      Total downline
                    </span>
                    <span className="font-medium">{downlineStats.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-v2-ink-muted dark:text-v2-ink-muted">
                      Already assigned
                    </span>
                    <span className="font-medium">
                      {downlineStats.alreadyAssigned}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-v2-ring pt-1 dark:border-v2-ring-strong">
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      Will be assigned
                    </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {downlineStats.eligible}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi-user search (only for individual) */}
          {assignMode === "individual" && !activeAgencyAssignment && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-v2-ink-muted">
                Assign To
                {selectedUsers.length > 0 && (
                  <span className="ml-1 text-v2-ink-subtle">
                    ({selectedUsers.length} selected)
                  </span>
                )}
                {unassignedCount > 0 && selectedUsers.length === 0 && (
                  <span className="ml-1 text-v2-ink-subtle">
                    — {unassignedCount} unassigned
                  </span>
                )}
              </label>

              {/* Selected user chips */}
              {selectedUsers.length > 0 && (
                <div className="max-h-20 overflow-y-auto flex flex-wrap gap-1 p-1.5 border border-v2-ring dark:border-v2-ring-strong rounded-md bg-v2-canvas dark:bg-v2-card-tinted/50">
                  {selectedUsers.map((user) => (
                    <Badge
                      key={user.id}
                      variant="secondary"
                      className="text-[10px] h-5 pl-1.5 pr-1 gap-1"
                    >
                      {`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
                        user.email}
                      <button
                        type="button"
                        onClick={() => toggleUser(user)}
                        className="hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter agents by name or email..."
                  className="h-7 text-xs pl-7"
                />
              </div>

              {/* Results list */}
              <div className="h-52 overflow-y-auto border border-v2-ring dark:border-v2-ring-strong rounded-md">
                {agentsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
                  </div>
                )}
                {!agentsLoading && unassignedCount === 0 && (
                  <div className="py-6 text-center text-[11px] text-v2-ink-muted">
                    All agents have been assigned this module
                  </div>
                )}
                {!agentsLoading &&
                  unassignedCount > 0 &&
                  visibleAgents.length === 0 && (
                    <div className="py-6 text-center text-[11px] text-v2-ink-muted">
                      No agents match your search
                    </div>
                  )}
                {!agentsLoading && visibleAgents.length > 0 && (
                  <div className="divide-y divide-v2-ring dark:divide-v2-ring">
                    {visibleAgents.map((user) => {
                      const selected = isSelected(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleUser(user)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                            selected
                              ? "bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              : "hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
                          }`}
                        >
                          <div
                            className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                              selected
                                ? "bg-blue-600 border-blue-600"
                                : "border-v2-ring-strong dark:border-v2-ring-strong"
                            }`}
                          >
                            {selected && (
                              <Check className="h-2.5 w-2.5 text-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium truncate">
                              {`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
                                user.email}
                            </div>
                            <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                              {user.email}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Due Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-v2-ink-muted">
              Due Date (optional)
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-v2-ink-muted">
              Priority
            </label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as PriorityLevel)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_LEVELS.map((level) => (
                  <SelectItem key={level} value={level} className="text-xs">
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mandatory */}
          <label className="flex items-center gap-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="h-3 w-3 rounded"
            />
            Mandatory assignment
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={resetAndClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            {assignMode === "downline"
              ? `Assign to ${downlineStats.eligible} Team Member${downlineStats.eligible !== 1 ? "s" : ""}`
              : assignMode === "agency"
                ? "Assign to Agency"
                : selectedUsers.length > 1
                  ? `Assign ${selectedUsers.length} Users`
                  : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
