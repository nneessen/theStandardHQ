// src/features/the-standard-team/components/WritingNumbersTab.tsx

import { useMemo, useState } from "react";
import { WritingNumbersTable } from "./WritingNumbersTable";
import {
  useAgentWritingNumbers,
  useDeleteWritingNumber,
  useUpsertWritingNumber,
} from "../hooks/useAgentWritingNumbers";
import { useActiveCarriers } from "@/hooks/carriers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, Search, Save, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TheStandardAgent } from "../hooks/useTheStandardAgents";
import type { Carrier } from "@/types/carrier.types";
import type { Database } from "@/types/database.types";

interface WritingNumbersTabProps {
  agents: TheStandardAgent[];
  selectedAgentId?: string;
}

type AgentWritingNumber =
  Database["public"]["Tables"]["agent_writing_numbers"]["Row"];

interface AgentWritingNumbersPanelProps {
  agent: TheStandardAgent;
  carriers: Carrier[];
  writingNumbers: AgentWritingNumber[];
  isSaving: boolean;
  onUpsertWritingNumber: (params: {
    agentId: string;
    carrierId: string;
    writingNumber: string;
    existingId?: string;
  }) => void;
  onDeleteWritingNumber: (id: string) => void;
}

type AgentWritingNumbersFilter = "all" | "missing" | "saved" | "edited";

interface TeamWritingNumbersBoardProps {
  agents: TheStandardAgent[];
  selectedAgent: TheStandardAgent;
  carriers: Carrier[];
  writingNumbers: AgentWritingNumber[];
  isSaving: boolean;
  onUpsertWritingNumber: (params: {
    agentId: string;
    carrierId: string;
    writingNumber: string;
    existingId?: string;
  }) => void;
  onDeleteWritingNumber: (id: string) => void;
}

function AgentWritingNumbersPanel({
  agent,
  carriers,
  writingNumbers,
  isSaving,
  onUpsertWritingNumber,
  onDeleteWritingNumber,
}: AgentWritingNumbersPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filterMode, setFilterMode] =
    useState<AgentWritingNumbersFilter>("all");

  const writingNumberMap = useMemo(() => {
    const map = new Map<string, AgentWritingNumber>();
    for (const row of writingNumbers) {
      map.set(row.carrier_id, row);
    }
    return map;
  }, [writingNumbers]);

  const rows = useMemo(() => {
    return carriers
      .map((carrier) => {
        const existing = writingNumberMap.get(carrier.id);
        const currentValue =
          drafts[carrier.id] ?? existing?.writing_number ?? "";
        const normalizedCurrent = currentValue.trim();
        const normalizedExisting = (existing?.writing_number || "").trim();

        return {
          carrier,
          existing,
          currentValue,
          normalizedCurrent,
          normalizedExisting,
          isDirty: normalizedCurrent !== normalizedExisting,
          hasSavedValue: Boolean(normalizedExisting),
        };
      })
      .sort((a, b) => {
        if (a.hasSavedValue !== b.hasSavedValue) {
          return a.hasSavedValue ? 1 : -1;
        }
        return a.carrier.name.localeCompare(b.carrier.name);
      });
  }, [carriers, drafts, writingNumberMap]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      // Keep rows in their persisted bucket while editing so they don't jump
      // between "Missing" and "Saved" sections on each keystroke.
      if (filterMode === "missing" && row.hasSavedValue) return false;
      if (filterMode === "saved" && !row.hasSavedValue) return false;
      if (filterMode === "edited" && !row.isDirty) return false;

      if (!query) return true;
      return row.carrier.name.toLowerCase().includes(query);
    });
  }, [filterMode, rows, searchQuery]);

  const assignedCount = carriers.filter((carrier) =>
    Boolean(
      (
        drafts[carrier.id] ??
        writingNumberMap.get(carrier.id)?.writing_number ??
        ""
      ).trim(),
    ),
  ).length;
  const editedCount = rows.filter((row) => row.isDirty).length;
  const filteredMissingRows = filteredRows.filter((row) => !row.hasSavedValue);
  const filteredSavedRows = filteredRows.filter((row) => row.hasSavedValue);
  const coveragePercent =
    carriers.length > 0
      ? Math.round((assignedCount / carriers.length) * 100)
      : 0;

  const handleDraftChange = (carrierId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [carrierId]: value }));
  };

  const getCurrentValue = (carrierId: string) =>
    drafts[carrierId] ?? writingNumberMap.get(carrierId)?.writing_number ?? "";

  const handleSave = (carrierId: string) => {
    const existing = writingNumberMap.get(carrierId);
    const nextValue = getCurrentValue(carrierId).trim();

    if (!nextValue) {
      if (existing?.id) {
        onDeleteWritingNumber(existing.id);
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[carrierId];
        return next;
      });
      return;
    }

    onUpsertWritingNumber({
      agentId: agent.id,
      carrierId,
      writingNumber: nextValue,
      existingId: existing?.id,
    });

    setDrafts((prev) => {
      const next = { ...prev };
      delete next[carrierId];
      return next;
    });
  };

  const handleReset = (carrierId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[carrierId];
      return next;
    });
  };

  const handleClear = (carrierId: string) => {
    const existing = writingNumberMap.get(carrierId);
    if (!existing?.id) return;

    onDeleteWritingNumber(existing.id);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[carrierId];
      return next;
    });
  };

  const renderCarrierRow = (row: (typeof rows)[number]) => {
    const isDirty = row.isDirty;
    const hasSavedValue = row.hasSavedValue;

    return (
      <div
        key={row.carrier.id}
        className={cn(
          "rounded-lg border p-2.5",
          hasSavedValue
            ? "border-v2-ring dark:border-v2-ring bg-card"
            : "border-warning/30 dark:border-warning/40 bg-warning/10",
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p
              className="text-[11px] font-medium text-v2-ink dark:text-v2-ink truncate"
              title={row.carrier.name}
            >
              {row.carrier.name}
            </p>
            <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {hasSavedValue
                ? `Saved: #${row.normalizedExisting}`
                : "No writing number saved"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {isDirty && (
              <Badge variant="warning" size="sm">
                Unsaved
              </Badge>
            )}
            <Badge variant={hasSavedValue ? "success" : "outline"} size="sm">
              {hasSavedValue ? "Saved" : "Missing"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
          <Input
            value={row.currentValue}
            onChange={(e) => handleDraftChange(row.carrier.id, e.target.value)}
            placeholder={hasSavedValue ? "Update writing #" : "Enter writing #"}
            className="h-8 text-xs min-w-0"
          />
          <div className="flex items-center gap-2 flex-wrap lg:justify-end">
            <Button
              type="button"
              size="xs"
              onClick={() => handleSave(row.carrier.id)}
              disabled={isSaving || !isDirty}
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => handleReset(row.carrier.id)}
              disabled={!isDirty}
            >
              <Eraser className="h-3 w-3" />
              Reset
            </Button>
            {hasSavedValue && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="text-destructive hover:text-destructive dark:hover:text-destructive"
                onClick={() => handleClear(row.carrier.id)}
                disabled={isSaving}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col">
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-v2-ink dark:text-v2-ink">
              {[agent.first_name, agent.last_name].filter(Boolean).join(" ") ||
                agent.email}
            </p>
            <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Writing # Focus Workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="info" size="sm">
            {assignedCount} assigned
          </Badge>
          <Badge variant="outline" size="sm">
            {Math.max(0, carriers.length - assignedCount)} missing
          </Badge>
          <Badge variant={editedCount > 0 ? "warning" : "outline"} size="sm">
            {editedCount} edited
          </Badge>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-3 space-y-3">
          <div className="rounded-lg border border-v2-ring dark:border-v2-ring bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-v2-ink dark:text-v2-ink">
                  Filters And Coverage
                </p>
                <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Search carriers, filter the list, and track completion while
                  you edit.
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" size="sm">
                  {coveragePercent}% covered
                </Badge>
                <Badge variant="outline" size="sm">
                  {assignedCount}/{carriers.length} saved
                </Badge>
                <Badge
                  variant={editedCount > 0 ? "warning" : "outline"}
                  size="sm"
                >
                  {editedCount} unsaved
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
              <div className="relative min-w-0">
                <Search className="h-3.5 w-3.5 text-v2-ink-subtle absolute left-2 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search carriers"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  type="button"
                  size="xs"
                  variant={filterMode === "all" ? "default" : "ghost"}
                  onClick={() => setFilterMode("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={filterMode === "missing" ? "default" : "ghost"}
                  onClick={() => setFilterMode("missing")}
                >
                  Missing
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={filterMode === "saved" ? "default" : "ghost"}
                  onClick={() => setFilterMode("saved")}
                >
                  Saved
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={filterMode === "edited" ? "default" : "ghost"}
                  onClick={() => setFilterMode("edited")}
                >
                  Edited
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-v2-ring dark:bg-v2-card-tinted overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    coveragePercent >= 80
                      ? "bg-success"
                      : coveragePercent >= 40
                        ? "bg-warning"
                        : "bg-destructive",
                  )}
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
              <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                `Clear` removes the saved writing number for a carrier.
              </p>
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            {filteredRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-v2-ring-strong dark:border-v2-ring-strong py-12 text-center text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                No carriers match the current filters
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 items-start">
                {filteredMissingRows.length > 0 && (
                  <section className="min-w-0 space-y-2 rounded-lg border border-warning/30 dark:border-warning/40 bg-warning/10 p-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Missing Writing Numbers
                      </p>
                      <Badge variant="outline" size="sm">
                        {filteredMissingRows.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {filteredMissingRows.map(renderCarrierRow)}
                    </div>
                  </section>
                )}

                {filteredSavedRows.length > 0 && (
                  <section className="min-w-0 space-y-2 rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-canvas/40 dark:bg-v2-card/20 p-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-muted">
                        Saved Writing Numbers
                      </p>
                      <Badge variant="outline" size="sm">
                        {filteredSavedRows.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {filteredSavedRows.map(renderCarrierRow)}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamWritingNumbersBoard({
  agents,
  selectedAgent,
  carriers,
  writingNumbers,
  isSaving,
  onUpsertWritingNumber,
  onDeleteWritingNumber,
}: TeamWritingNumbersBoardProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const writingNumberLookup = useMemo(() => {
    const map = new Map<string, AgentWritingNumber>();
    for (const row of writingNumbers) {
      map.set(`${row.agent_id}-${row.carrier_id}`, row);
    }
    return map;
  }, [writingNumbers]);

  const selectedAgentLabel =
    [selectedAgent.first_name, selectedAgent.last_name]
      .filter(Boolean)
      .join(" ") || selectedAgent.email;

  const getSelectedRow = (carrierId: string) =>
    writingNumberLookup.get(`${selectedAgent.id}-${carrierId}`);

  const getCurrentValue = (carrierId: string) =>
    drafts[carrierId] ?? getSelectedRow(carrierId)?.writing_number ?? "";

  const handleDraftChange = (carrierId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [carrierId]: value }));
  };

  const handleSave = (carrierId: string) => {
    const existing = getSelectedRow(carrierId);
    const nextValue = getCurrentValue(carrierId).trim();

    if (!nextValue) {
      if (existing?.id) {
        onDeleteWritingNumber(existing.id);
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[carrierId];
        return next;
      });
      return;
    }

    onUpsertWritingNumber({
      agentId: selectedAgent.id,
      carrierId,
      writingNumber: nextValue,
      existingId: existing?.id,
    });

    setDrafts((prev) => {
      const next = { ...prev };
      delete next[carrierId];
      return next;
    });
  };

  const handleReset = (carrierId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[carrierId];
      return next;
    });
  };

  const totalAgentCount = agents.length;

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col">
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
            Coverage Board
          </p>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Edit the selected agent quickly while seeing team coverage and
            missing carriers at a glance.
          </p>
        </div>
        <Badge variant="info" size="sm">
          Editing: {selectedAgentLabel}
        </Badge>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 grid grid-cols-1 2xl:grid-cols-2 gap-2.5">
          {carriers.map((carrier) => {
            const perAgent = agents.map((agent) => {
              const row = writingNumberLookup.get(`${agent.id}-${carrier.id}`);
              return {
                agent,
                row,
                value: row?.writing_number?.trim() || "",
              };
            });

            const assigned = perAgent.filter((entry) => entry.value);
            const missing = perAgent.filter((entry) => !entry.value);
            const coveragePercent =
              totalAgentCount > 0
                ? Math.round((assigned.length / totalAgentCount) * 100)
                : 0;

            const selectedExisting = getSelectedRow(carrier.id);
            const currentValue = getCurrentValue(carrier.id);
            const normalizedCurrent = currentValue.trim();
            const normalizedExisting = (
              selectedExisting?.writing_number || ""
            ).trim();
            const isDirty = normalizedCurrent !== normalizedExisting;

            const missingPreview = missing
              .slice(0, 3)
              .map(
                (entry) =>
                  [entry.agent.first_name, entry.agent.last_name]
                    .filter(Boolean)
                    .join(" ") || entry.agent.email,
              );

            return (
              <div
                key={carrier.id}
                className="rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-canvas/70 dark:bg-v2-card/40 p-3 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink truncate"
                      title={carrier.name}
                    >
                      {carrier.name}
                    </p>
                    <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                      {assigned.length}/{totalAgentCount} agents have a writing
                      #
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <Badge variant="outline" size="sm">
                      {coveragePercent}% covered
                    </Badge>
                    <Badge
                      variant={normalizedExisting ? "success" : "outline"}
                      size="sm"
                    >
                      {normalizedExisting
                        ? "Selected Saved"
                        : "Selected Missing"}
                    </Badge>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-v2-ring dark:bg-v2-card-tinted overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      coveragePercent >= 80
                        ? "bg-success"
                        : coveragePercent >= 40
                          ? "bg-warning"
                          : "bg-destructive",
                    )}
                    style={{ width: `${coveragePercent}%` }}
                  />
                </div>

                <div className="rounded-md border border-v2-ring dark:border-v2-ring bg-card p-2">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-[10px] font-medium text-v2-ink dark:text-v2-ink truncate">
                      Selected Agent Quick Edit
                    </p>
                    <p className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                      {selectedAgentLabel}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={currentValue}
                      onChange={(e) =>
                        handleDraftChange(carrier.id, e.target.value)
                      }
                      placeholder="Enter writing #"
                      className="h-8 text-xs min-w-0"
                    />
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <Button
                        type="button"
                        size="xs"
                        onClick={() => handleSave(carrier.id)}
                        disabled={isSaving || !isDirty}
                      >
                        <Save className="h-3 w-3" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => handleReset(carrier.id)}
                        disabled={!isDirty}
                      >
                        <Eraser className="h-3 w-3" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  {missing.length === 0 ? (
                    <span className="text-success">
                      All visible agents have a writing # for this carrier.
                    </span>
                  ) : (
                    <>
                      Missing ({missing.length}): {missingPreview.join(", ")}
                      {missing.length > missingPreview.length &&
                        ` +${missing.length - missingPreview.length} more`}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WritingNumbersTab({
  agents,
  selectedAgentId,
}: WritingNumbersTabProps) {
  const [carrierSearch, setCarrierSearch] = useState("");
  const [showOnlyMissingForSelected, setShowOnlyMissingForSelected] =
    useState(false);
  const [teamViewMode, setTeamViewMode] = useState<"coverage-board" | "matrix">(
    "coverage-board",
  );
  const [teamLayout, setTeamLayout] = useState<"carriers-rows" | "agents-rows">(
    "carriers-rows",
  );
  const agentsLoading = false;
  const agentsError = null;

  const {
    data: carriers = [],
    isLoading: carriersLoading,
    error: carriersError,
  } = useActiveCarriers();

  const agentIds = useMemo(() => agents.map((a) => a.id), [agents]);

  const {
    data: writingNumbers = [],
    isLoading: writingNumbersLoading,
    error: writingNumbersError,
  } = useAgentWritingNumbers(agentIds);

  const upsertMutation = useUpsertWritingNumber();
  const deleteMutation = useDeleteWritingNumber();

  const writingNumberLookup = useMemo(() => {
    const map = new Map<string, AgentWritingNumber>();
    for (const row of writingNumbers) {
      map.set(`${row.agent_id}-${row.carrier_id}`, row);
    }
    return map;
  }, [writingNumbers]);

  const filteredCarriers = useMemo(() => {
    const query = carrierSearch.trim().toLowerCase();

    return carriers.filter((carrier) => {
      if (showOnlyMissingForSelected && selectedAgentId) {
        const key = `${selectedAgentId}-${carrier.id}`;
        const existing = writingNumberLookup.get(key);
        if (existing?.writing_number?.trim()) return false;
      }

      if (!query) return true;
      return carrier.name.toLowerCase().includes(query);
    });
  }, [
    carriers,
    carrierSearch,
    selectedAgentId,
    showOnlyMissingForSelected,
    writingNumberLookup,
  ]);

  const handleUpsertWritingNumber = (params: {
    agentId: string;
    carrierId: string;
    writingNumber: string;
    existingId?: string;
  }) => {
    upsertMutation.mutate(params, {
      onSuccess: () => {
        toast.success("Writing number saved");
      },
      onError: (error) => {
        toast.error(`Failed to save: ${error.message}`);
      },
    });
  };

  const handleDeleteWritingNumber = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Writing number cleared");
      },
      onError: (error) => {
        toast.error(`Failed to clear: ${error.message}`);
      },
    });
  };

  const isLoading = agentsLoading || carriersLoading || writingNumbersLoading;
  const error = agentsError || carriersError || writingNumbersError;

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="flex items-center gap-2 text-destructive text-[11px]">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load data: {error.message}</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        <Skeleton className="h-8 w-full bg-v2-ring dark:bg-v2-ring-strong" />
        <Skeleton className="h-8 w-full bg-v2-ring dark:bg-v2-ring-strong" />
        <Skeleton className="h-8 w-full bg-v2-ring dark:bg-v2-ring-strong" />
        <Skeleton className="h-8 w-full bg-v2-ring dark:bg-v2-ring-strong" />
        <Skeleton className="h-8 w-full bg-v2-ring dark:bg-v2-ring-strong" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <FileText className="h-8 w-8 text-v2-ink-subtle dark:text-v2-ink-muted mb-2" />
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          No agents found in your hierarchy
        </p>
      </div>
    );
  }

  if (carriers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <FileText className="h-8 w-8 text-v2-ink-subtle dark:text-v2-ink-muted mb-2" />
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          No active carriers found
        </p>
      </div>
    );
  }

  const isAgentFocus = agents.length === 1;
  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) || agents[0];

  if (isAgentFocus && selectedAgent) {
    const singleAgentRows = writingNumbers.filter(
      (row) => row.agent_id === selectedAgent.id,
    );

    return (
      <AgentWritingNumbersPanel
        agent={selectedAgent}
        carriers={carriers}
        writingNumbers={singleAgentRows}
        isSaving={upsertMutation.isPending || deleteMutation.isPending}
        onUpsertWritingNumber={handleUpsertWritingNumber}
        onDeleteWritingNumber={handleDeleteWritingNumber}
      />
    );
  }

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col">
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle min-w-0">
            Coverage Board is the default view for quick selected-agent edits
            and team coverage gaps. Switch to Matrix for bulk grid editing.
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="info" size="sm">
              {agents.length} agents
            </Badge>
            <Badge variant="outline" size="sm">
              {filteredCarriers.length}/{carriers.length} carriers
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-0 xl:flex-row xl:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="h-3.5 w-3.5 text-v2-ink-subtle absolute left-2 top-1/2 -translate-y-1/2" />
            <Input
              value={carrierSearch}
              onChange={(e) => setCarrierSearch(e.target.value)}
              placeholder="Filter carriers in matrix"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              type="button"
              size="xs"
              variant={showOnlyMissingForSelected ? "default" : "ghost"}
              onClick={() => setShowOnlyMissingForSelected((prev) => !prev)}
              disabled={!selectedAgentId}
              title={
                selectedAgentId
                  ? "Show carriers missing a writing number for the selected agent"
                  : "Select an agent first"
              }
            >
              Missing for Selected
            </Button>
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                type="button"
                size="xs"
                variant={
                  teamViewMode === "coverage-board" ? "default" : "ghost"
                }
                onClick={() => setTeamViewMode("coverage-board")}
              >
                Coverage Board
              </Button>
              <Button
                type="button"
                size="xs"
                variant={teamViewMode === "matrix" ? "default" : "ghost"}
                onClick={() => setTeamViewMode("matrix")}
              >
                Matrix
              </Button>
            </div>
            {teamViewMode === "matrix" && (
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  type="button"
                  size="xs"
                  variant={teamLayout === "carriers-rows" ? "default" : "ghost"}
                  onClick={() => setTeamLayout("carriers-rows")}
                  title="Carrier rows (recommended to reduce horizontal scroll)"
                >
                  Carrier Rows
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={teamLayout === "agents-rows" ? "default" : "ghost"}
                  onClick={() => setTeamLayout("agents-rows")}
                  title="Classic agent rows"
                >
                  Agent Rows
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {teamViewMode === "coverage-board" && selectedAgent ? (
        <TeamWritingNumbersBoard
          agents={agents}
          selectedAgent={selectedAgent}
          carriers={filteredCarriers}
          writingNumbers={writingNumbers}
          isSaving={upsertMutation.isPending || deleteMutation.isPending}
          onUpsertWritingNumber={handleUpsertWritingNumber}
          onDeleteWritingNumber={handleDeleteWritingNumber}
        />
      ) : (
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 border-b border-v2-ring dark:border-v2-ring text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Matrix mode supports horizontal scrolling. Use trackpad/touchpad
            horizontal scroll or Shift + mouse wheel.
          </div>
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
            <WritingNumbersTable
              agents={agents}
              selectedAgentId={selectedAgentId}
              carriers={filteredCarriers}
              writingNumbers={writingNumbers}
              layout={teamLayout}
              isLoading={upsertMutation.isPending || deleteMutation.isPending}
              onUpsertWritingNumber={handleUpsertWritingNumber}
            />
          </div>
        </div>
      )}
    </div>
  );
}
