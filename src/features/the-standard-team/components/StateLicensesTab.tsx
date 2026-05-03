// src/features/the-standard-team/components/StateLicensesTab.tsx

import { useState, useMemo } from "react";
import { StateLicensesTable } from "./StateLicensesTable";
import { StateClassificationDialog } from "./StateClassificationDialog";
import {
  useAgentStateLicenses,
  useToggleStateLicense,
} from "../hooks/useAgentStateLicenses";
import {
  useStateClassifications,
  useUpdateStateClassification,
  type StateClassificationType,
} from "../hooks/useStateClassifications";
import { US_STATES } from "@/constants/states";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import type { TheStandardAgent } from "../hooks/useTheStandardAgents";
import type { AgentStateLicense } from "../hooks/useAgentStateLicenses";
import type { StateClassification } from "../hooks/useStateClassifications";

interface StateLicensesTabProps {
  agents: TheStandardAgent[];
  classificationAgencyId?: string;
  selectedAgentId?: string;
  canEditClassifications?: boolean;
}

type LicenseFilter = "all" | "licensed" | "unlicensed";
type ClassificationFilter = "all" | StateClassificationType;

const classificationDotClass = (classification: StateClassificationType) => {
  switch (classification) {
    case "green":
      return "bg-success border-success";
    case "yellow":
      return "bg-warning border-warning";
    case "red":
      return "bg-destructive border-destructive";
    default:
      return "bg-muted border-input dark:bg-v2-ring-strong dark:border-input";
  }
};

const classificationBadgeVariant = (
  classification: StateClassificationType,
) => {
  switch (classification) {
    case "green":
      return "success" as const;
    case "yellow":
      return "warning" as const;
    case "red":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

interface AgentStateLicensesPanelProps {
  agent: TheStandardAgent;
  licenses: AgentStateLicense[];
  classifications: StateClassification[];
  isSaving: boolean;
  canEditClassifications: boolean;
  onToggleLicense: (params: {
    agentId: string;
    stateCode: string;
    isLicensed: boolean;
    existingId?: string;
  }) => void;
  onEditClassification: (stateCode: string, stateName: string) => void;
}

function AgentStateLicensesPanel({
  agent,
  licenses,
  classifications,
  isSaving,
  canEditClassifications,
  onToggleLicense,
  onEditClassification,
}: AgentStateLicensesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [licenseFilter, setLicenseFilter] = useState<LicenseFilter>("all");
  const [classificationFilter, setClassificationFilter] =
    useState<ClassificationFilter>("all");

  const licenseMap = useMemo(() => {
    const map = new Map<string, AgentStateLicense>();
    for (const row of licenses) map.set(row.state_code, row);
    return map;
  }, [licenses]);

  const classificationMap = useMemo(() => {
    const map = new Map<string, StateClassificationType>();
    for (const row of classifications)
      map.set(row.state_code, row.classification);
    return map;
  }, [classifications]);

  const visibleStates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return US_STATES.filter((state) => {
      const license = licenseMap.get(state.value);
      const isLicensed = license?.is_licensed ?? false;
      const classification =
        classificationMap.get(state.value) ??
        ("neutral" as StateClassificationType);

      if (licenseFilter === "licensed" && !isLicensed) return false;
      if (licenseFilter === "unlicensed" && isLicensed) return false;
      if (
        classificationFilter !== "all" &&
        classification !== classificationFilter
      ) {
        return false;
      }
      if (!query) return true;

      return (
        state.label.toLowerCase().includes(query) ||
        state.value.toLowerCase().includes(query)
      );
    });
  }, [
    classificationFilter,
    classificationMap,
    licenseFilter,
    licenseMap,
    searchQuery,
  ]);

  const licensedCount = useMemo(
    () =>
      US_STATES.filter((state) => licenseMap.get(state.value)?.is_licensed)
        .length,
    [licenseMap],
  );
  const unlicensedCount = US_STATES.length - licensedCount;
  const coveragePercent =
    US_STATES.length > 0
      ? Math.round((licensedCount / US_STATES.length) * 100)
      : 0;
  const visibleLicensedStates = visibleStates.filter(
    (state) => licenseMap.get(state.value)?.is_licensed,
  );
  const visibleUnlicensedStates = visibleStates.filter(
    (state) => !licenseMap.get(state.value)?.is_licensed,
  );

  const classificationCounts = useMemo(() => {
    const counts = {
      green: 0,
      yellow: 0,
      red: 0,
      neutral: 0,
    } as Record<StateClassificationType, number>;

    for (const state of US_STATES) {
      const color =
        classificationMap.get(state.value) ??
        ("neutral" as StateClassificationType);
      counts[color] += 1;
    }

    return counts;
  }, [classificationMap]);

  const renderStateRow = (state: (typeof US_STATES)[number]) => {
    const license = licenseMap.get(state.value);
    const isLicensed = license?.is_licensed ?? false;
    const classification =
      classificationMap.get(state.value) ??
      ("neutral" as StateClassificationType);

    return (
      <div
        key={state.value}
        className={cn(
          "px-3 py-2 transition-colors",
          isLicensed
            ? "bg-success/10/40 dark:bg-success/10/10"
            : "bg-transparent",
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                {state.label}
              </p>
              <Badge variant="outline" size="sm">
                {state.value}
              </Badge>
              <Badge
                variant={classificationBadgeVariant(classification)}
                size="sm"
              >
                {classification}
              </Badge>
            </div>
            <p className="mt-0.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {isLicensed ? "Licensed" : "Missing license"}
            </p>
          </div>

          <div className="flex items-center gap-2 justify-between md:justify-end">
            <button
              type="button"
              onClick={() => {
                if (!canEditClassifications) return;
                onEditClassification(state.value, state.label);
              }}
              disabled={!canEditClassifications}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-v2-ink-muted hover:bg-v2-card-tinted dark:text-v2-ink-muted dark:hover:bg-v2-card-tinted disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
              title={
                canEditClassifications
                  ? `Edit ${state.label} color classification`
                  : "You can only edit color classifications for your own agency (unless admin)"
              }
            >
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-full border",
                  classificationDotClass(classification),
                )}
              />
              Color
            </button>

            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-muted">
                Licensed
              </span>
              <Checkbox
                checked={isLicensed}
                onCheckedChange={(checked) =>
                  onToggleLicense({
                    agentId: agent.id,
                    stateCode: state.value,
                    isLicensed: !!checked,
                    existingId: license?.id,
                  })
                }
                disabled={isSaving}
                className="h-4 w-4"
              />
            </label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col">
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-v2-ink dark:text-v2-ink">
            {[agent.first_name, agent.last_name].filter(Boolean).join(" ") ||
              agent.email}
          </p>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            State License Focus Workspace
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="info" size="sm">
            {licensedCount} licensed
          </Badge>
          <Badge variant="outline" size="sm">
            {unlicensedCount} missing
          </Badge>
          <Badge variant="outline" size="sm">
            {coveragePercent}% coverage
          </Badge>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-3 space-y-3">
          <div className="rounded-lg border border-v2-ring dark:border-v2-ring bg-white dark:bg-v2-canvas/20 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-v2-ink dark:text-v2-ink">
                  Filters And Coverage
                </p>
                <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Search states, filter licensed status, and compare color
                  classifications while editing.
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" size="sm">
                  {coveragePercent}% coverage
                </Badge>
                <Badge variant="outline" size="sm">
                  {licensedCount}/{US_STATES.length} licensed
                </Badge>
                <Badge variant="outline" size="sm">
                  {visibleStates.length} visible
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
              <div className="relative min-w-0">
                <Search className="h-3.5 w-3.5 text-v2-ink-subtle absolute left-2 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search states"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  type="button"
                  size="xs"
                  variant={licenseFilter === "all" ? "default" : "ghost"}
                  onClick={() => setLicenseFilter("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={licenseFilter === "licensed" ? "default" : "ghost"}
                  onClick={() => setLicenseFilter("licensed")}
                >
                  Licensed
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={licenseFilter === "unlicensed" ? "default" : "ghost"}
                  onClick={() => setLicenseFilter("unlicensed")}
                >
                  Missing
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <Button
                type="button"
                size="xs"
                variant={classificationFilter === "all" ? "ghost" : "muted"}
                onClick={() => setClassificationFilter("all")}
              >
                All Colors
              </Button>
              {(
                [
                  "green",
                  "yellow",
                  "red",
                  "neutral",
                ] as StateClassificationType[]
              ).map((color) => (
                <Button
                  key={color}
                  type="button"
                  size="xs"
                  variant={classificationFilter === color ? "default" : "ghost"}
                  onClick={() => setClassificationFilter(color)}
                >
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 rounded-full border",
                      classificationDotClass(color),
                    )}
                  />
                  {color}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
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
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                <div className="rounded-md border border-v2-ring dark:border-v2-ring p-2 text-center">
                  <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Licensed
                  </p>
                  <p className="text-xs font-semibold text-v2-ink dark:text-v2-ink">
                    {licensedCount}
                  </p>
                </div>
                <div className="rounded-md border border-v2-ring dark:border-v2-ring p-2 text-center">
                  <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Missing
                  </p>
                  <p className="text-xs font-semibold text-v2-ink dark:text-v2-ink">
                    {unlicensedCount}
                  </p>
                </div>
                {(
                  [
                    "green",
                    "yellow",
                    "red",
                    "neutral",
                  ] as StateClassificationType[]
                ).map((color) => (
                  <div
                    key={color}
                    className="rounded-md border border-v2-ring dark:border-v2-ring p-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full border shrink-0",
                          classificationDotClass(color),
                        )}
                      />
                      <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-muted capitalize truncate">
                        {color}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-v2-ink dark:text-v2-ink">
                      {classificationCounts[color]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                Color tags help compare licensing strategy across uplines and
                downlines.
              </p>
            </div>
          </div>

          <div className="min-w-0">
            {visibleStates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-v2-ring-strong dark:border-v2-ring-strong py-12 text-center text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                No states match the current filters
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 items-start">
                {visibleUnlicensedStates.length > 0 && (
                  <section className="min-w-0 space-y-2 rounded-lg border border-warning/30 dark:border-warning/40 bg-warning/10/40 dark:bg-warning/10/10 p-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Missing Licenses
                      </p>
                      <Badge variant="outline" size="sm">
                        {visibleUnlicensedStates.length}
                      </Badge>
                    </div>
                    <div className="rounded-md border border-warning/30/80 dark:border-warning/40 overflow-hidden divide-y divide-amber-200/60 dark:divide-amber-900/30 bg-white/70 dark:bg-v2-canvas/10">
                      {visibleUnlicensedStates.map(renderStateRow)}
                    </div>
                  </section>
                )}

                {visibleLicensedStates.length > 0 && (
                  <section className="min-w-0 space-y-2 rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-canvas/40 dark:bg-v2-card/20 p-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-muted">
                        Licensed States
                      </p>
                      <Badge variant="outline" size="sm">
                        {visibleLicensedStates.length}
                      </Badge>
                    </div>
                    <div className="rounded-md border border-v2-ring dark:border-v2-ring overflow-hidden divide-y divide-v2-ring/80 dark:divide-v2-ring bg-white/70 dark:bg-v2-canvas/10">
                      {visibleLicensedStates.map(renderStateRow)}
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

export function StateLicensesTab({
  agents,
  classificationAgencyId,
  selectedAgentId,
  canEditClassifications = false,
}: StateLicensesTabProps) {
  const [stateSearch, setStateSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState<LicenseFilter>("all");
  const [editingState, setEditingState] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const agentsLoading = false;
  const agentsError = null;

  const agentIds = useMemo(() => agents.map((a) => a.id), [agents]);

  const {
    data: licenses = [],
    isLoading: licensesLoading,
    error: licensesError,
  } = useAgentStateLicenses(agentIds);

  const {
    data: classifications = [],
    isLoading: classificationsLoading,
    error: classificationsError,
  } = useStateClassifications(classificationAgencyId, {
    enabled: !!classificationAgencyId,
  });

  const toggleMutation = useToggleStateLicense();
  const updateClassificationMutation = useUpdateStateClassification();

  const selectedAgentLicenseMap = useMemo(() => {
    if (!selectedAgentId) return new Map<string, AgentStateLicense>();

    const map = new Map<string, AgentStateLicense>();
    for (const row of licenses) {
      if (row.agent_id === selectedAgentId) {
        map.set(row.state_code, row);
      }
    }
    return map;
  }, [licenses, selectedAgentId]);

  const visibleStates = useMemo(() => {
    const query = stateSearch.trim().toLowerCase();

    return US_STATES.filter((state) => {
      const selectedAgentLicense = selectedAgentId
        ? selectedAgentLicenseMap.get(state.value)
        : undefined;
      const isLicensed = selectedAgentLicense?.is_licensed ?? false;

      if (licenseFilter === "licensed" && !isLicensed) return false;
      if (licenseFilter === "unlicensed" && isLicensed) return false;

      if (!query) return true;
      return (
        state.label.toLowerCase().includes(query) ||
        state.value.toLowerCase().includes(query)
      );
    });
  }, [licenseFilter, selectedAgentId, selectedAgentLicenseMap, stateSearch]);

  const handleToggleLicense = (params: {
    agentId: string;
    stateCode: string;
    isLicensed: boolean;
    existingId?: string;
  }) => {
    toggleMutation.mutate(params, {
      onError: (error) => {
        toast.error(`Failed to update license: ${error.message}`);
      },
    });
  };

  const handleEditClassification = (stateCode: string, stateName: string) => {
    if (!canEditClassifications) {
      toast.error(
        "You can only edit state color classifications for your own agency (unless admin)",
      );
      return;
    }
    if (!classificationAgencyId) {
      toast.error(
        "Select an agent with an agency before editing classifications",
      );
      return;
    }
    setEditingState({ code: stateCode, name: stateName });
  };

  const handleSaveClassification = (
    classification: StateClassificationType,
  ) => {
    if (!editingState || !classificationAgencyId) return;

    const existing = classifications.find(
      (c) => c.state_code === editingState.code,
    );

    updateClassificationMutation.mutate(
      {
        agencyId: classificationAgencyId,
        stateCode: editingState.code,
        classification,
        existingId: existing?.id,
      },
      {
        onSuccess: () => {
          toast.success(`${editingState.name} classification updated`);
          setEditingState(null);
        },
        onError: (error) => {
          toast.error(`Failed to update: ${error.message}`);
        },
      },
    );
  };

  const isLoading = agentsLoading || licensesLoading || classificationsLoading;
  const error = agentsError || licensesError || classificationsError;

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
        <MapPin className="h-8 w-8 text-v2-ink-subtle dark:text-v2-ink-muted mb-2" />
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          No agents found in your hierarchy
        </p>
      </div>
    );
  }

  const isAgentFocus = agents.length === 1;
  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) || agents[0];

  const currentClassification = editingState
    ? classifications.find((c) => c.state_code === editingState.code)
        ?.classification || "neutral"
    : "neutral";

  if (isAgentFocus && selectedAgent) {
    const singleAgentLicenses = licenses.filter(
      (l) => l.agent_id === selectedAgent.id,
    );

    return (
      <>
        <AgentStateLicensesPanel
          agent={selectedAgent}
          licenses={singleAgentLicenses}
          classifications={classifications}
          isSaving={toggleMutation.isPending}
          canEditClassifications={canEditClassifications}
          onToggleLicense={handleToggleLicense}
          onEditClassification={handleEditClassification}
        />

        {editingState && (
          <StateClassificationDialog
            open={!!editingState}
            onOpenChange={(open) => !open && setEditingState(null)}
            stateName={editingState.name}
            stateCode={editingState.code}
            currentClassification={currentClassification}
            onSave={handleSaveClassification}
            isSaving={updateClassificationMutation.isPending}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col">
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle min-w-0">
            Team matrix view. Check boxes for licensed states. Click color dot
            to set state classification.
            {!classificationAgencyId &&
              " No agency selected for classifications."}
            {!canEditClassifications &&
              " Color classifications are view-only outside your agency (unless admin)."}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="info" size="sm">
              {agents.length} agents
            </Badge>
            <Badge variant="outline" size="sm">
              {visibleStates.length}/{US_STATES.length} states
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-0 xl:flex-row xl:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="h-3.5 w-3.5 text-v2-ink-subtle absolute left-2 top-1/2 -translate-y-1/2" />
            <Input
              value={stateSearch}
              onChange={(e) => setStateSearch(e.target.value)}
              placeholder="Filter states in matrix"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap shrink-0">
            <Button
              type="button"
              size="xs"
              variant={licenseFilter === "all" ? "default" : "ghost"}
              onClick={() => setLicenseFilter("all")}
            >
              All
            </Button>
            <Button
              type="button"
              size="xs"
              variant={licenseFilter === "licensed" ? "default" : "ghost"}
              onClick={() => setLicenseFilter("licensed")}
              disabled={!selectedAgentId}
              title={
                selectedAgentId
                  ? "Filter by selected agent license states"
                  : "Select an agent first"
              }
            >
              Selected Licensed
            </Button>
            <Button
              type="button"
              size="xs"
              variant={licenseFilter === "unlicensed" ? "default" : "ghost"}
              onClick={() => setLicenseFilter("unlicensed")}
              disabled={!selectedAgentId}
              title={
                selectedAgentId
                  ? "Filter by selected agent missing license states"
                  : "Select an agent first"
              }
            >
              Selected Missing
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <StateLicensesTable
          agents={agents}
          selectedAgentId={selectedAgentId}
          visibleStates={visibleStates}
          licenses={licenses}
          classifications={classifications}
          canEditClassifications={canEditClassifications}
          isLoading={toggleMutation.isPending}
          onToggleLicense={handleToggleLicense}
          onEditClassification={handleEditClassification}
        />
      </div>

      {editingState && (
        <StateClassificationDialog
          open={!!editingState}
          onOpenChange={(open) => !open && setEditingState(null)}
          stateName={editingState.name}
          stateCode={editingState.code}
          currentClassification={currentClassification}
          onSave={handleSaveClassification}
          isSaving={updateClassificationMutation.isPending}
        />
      )}
    </div>
  );
}
