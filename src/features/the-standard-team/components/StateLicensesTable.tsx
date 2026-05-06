// src/features/the-standard-team/components/StateLicensesTable.tsx

import { useMemo, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/constants/states";
import type { TheStandardAgent } from "../hooks/useTheStandardAgents";
import type { AgentStateLicense } from "../hooks/useAgentStateLicenses";
import type {
  StateClassification,
  StateClassificationType,
} from "../hooks/useStateClassifications";

interface StateLicensesTableProps {
  agents: TheStandardAgent[];
  selectedAgentId?: string;
  visibleStates?: ReadonlyArray<(typeof US_STATES)[number]>;
  licenses: AgentStateLicense[];
  classifications: StateClassification[];
  canEditClassifications?: boolean;
  isLoading?: boolean;
  onToggleLicense: (params: {
    agentId: string;
    stateCode: string;
    isLicensed: boolean;
    existingId?: string;
  }) => void;
  onEditClassification: (stateCode: string, stateName: string) => void;
}

const getClassificationBgClass = (
  classification: StateClassificationType | undefined,
): string => {
  switch (classification) {
    case "green":
      return "bg-success/10";
    case "yellow":
      return "bg-warning/10";
    case "red":
      return "bg-destructive/10";
    default:
      return "";
  }
};

export function StateLicensesTable({
  agents,
  selectedAgentId,
  visibleStates,
  licenses,
  classifications,
  canEditClassifications = false,
  onToggleLicense,
  onEditClassification,
}: StateLicensesTableProps) {
  const states = visibleStates ?? US_STATES;
  const stateLabelColWidth = 120;
  const colorColWidth = 40;
  const agentColWidth = 80;

  // Build lookup maps
  const licenseMap = useMemo(() => {
    const map = new Map<string, AgentStateLicense>();
    licenses.forEach((lic) => {
      map.set(`${lic.agent_id}-${lic.state_code}`, lic);
    });
    return map;
  }, [licenses]);

  const classificationMap = useMemo(() => {
    const map = new Map<string, StateClassification>();
    classifications.forEach((cls) => {
      map.set(cls.state_code, cls);
    });
    return map;
  }, [classifications]);

  const getLicense = useCallback(
    (agentId: string, stateCode: string) => {
      return licenseMap.get(`${agentId}-${stateCode}`);
    },
    [licenseMap],
  );

  const getClassification = useCallback(
    (stateCode: string) => {
      return classificationMap.get(stateCode)?.classification;
    },
    [classificationMap],
  );

  const handleCheckboxChange = (
    agentId: string,
    stateCode: string,
    checked: boolean,
  ) => {
    const existing = getLicense(agentId, stateCode);
    onToggleLicense({
      agentId,
      stateCode,
      isLicensed: checked,
      existingId: existing?.id,
    });
  };

  const tableWidth =
    stateLabelColWidth + colorColWidth + agents.length * agentColWidth;

  return (
    <div className="h-full w-full min-w-0 overflow-auto overscroll-x-contain">
      <div className="inline-block min-w-full align-top">
        <table
          className="w-max min-w-full border-collapse"
          style={{
            width: `${Math.max(tableWidth, 0)}px`,
            minWidth: "100%",
          }}
        >
          <thead className="sticky top-0 z-10">
            <tr className="bg-v2-card-tinted dark:bg-v2-card-tinted">
              <th className="sticky left-0 z-20 bg-v2-card-tinted dark:bg-v2-card-tinted text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wide text-left px-3 py-2 border-b border-v2-ring dark:border-v2-ring-strong min-w-[120px] w-[120px]">
                State
              </th>
              <th className="sticky left-[120px] z-20 bg-v2-card-tinted dark:bg-v2-card-tinted text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wide text-center px-2 py-2 border-b border-v2-ring dark:border-v2-ring-strong w-[40px] min-w-[40px]">
                Color
              </th>
              {agents.map((agent) => (
                <th
                  key={agent.id}
                  className={cn(
                    "text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wide text-center px-2 py-2 border-b border-v2-ring dark:border-v2-ring-strong min-w-[80px] w-[80px]",
                    agent.id === selectedAgentId && "bg-info/20 text-info",
                  )}
                  title={`${agent.first_name} ${agent.last_name}`}
                >
                  <div className="truncate max-w-[75px]">
                    {agent.first_name?.[0]}. {agent.last_name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.map((state, idx) => {
              const classification = getClassification(state.value);
              const bgClass = getClassificationBgClass(classification);

              return (
                <tr
                  key={state.value}
                  className={cn(
                    "hover:bg-v2-canvas/50 dark:hover:bg-v2-card-tinted/30",
                    bgClass ||
                      (idx % 2 === 0
                        ? "bg-v2-card"
                        : "bg-v2-canvas/50 dark:bg-v2-card/50"),
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 text-[11px] font-medium text-v2-ink dark:text-v2-ink px-3 py-1.5 border-b border-v2-ring dark:border-v2-ring",
                      bgClass ||
                        (idx % 2 === 0
                          ? "bg-v2-card"
                          : "bg-v2-canvas/50 dark:bg-v2-card/50"),
                    )}
                  >
                    {state.label}
                  </td>
                  <td
                    className={cn(
                      "sticky left-[120px] z-10 text-center py-1.5 border-b border-v2-ring dark:border-v2-ring",
                      bgClass ||
                        (idx % 2 === 0
                          ? "bg-v2-card"
                          : "bg-v2-canvas/50 dark:bg-v2-card/50"),
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEditClassifications) return;
                        onEditClassification(state.value, state.label);
                      }}
                      disabled={!canEditClassifications}
                      className="p-1 rounded hover:bg-v2-ring/50 dark:hover:bg-v2-ring-strong/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                      title={
                        canEditClassifications
                          ? `Set ${state.label} classification (current: ${classification || "neutral"})`
                          : "You can only edit color classifications for your own agency (unless admin)"
                      }
                    >
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full border",
                          classification === "green" &&
                            "bg-success border-success",
                          classification === "yellow" &&
                            "bg-warning border-warning",
                          classification === "red" &&
                            "bg-destructive border-destructive",
                          (!classification || classification === "neutral") &&
                            "bg-muted border-input dark:bg-v2-ring-strong dark:border-input",
                        )}
                      />
                    </button>
                  </td>
                  {agents.map((agent) => {
                    const license = getLicense(agent.id, state.value);
                    const isLicensed = license?.is_licensed ?? false;

                    return (
                      <td
                        key={agent.id}
                        className={cn(
                          "text-center py-1 px-2 border-b border-v2-ring dark:border-v2-ring",
                          bgClass,
                          agent.id === selectedAgentId && "bg-info/10",
                        )}
                      >
                        <Checkbox
                          checked={isLicensed}
                          onCheckedChange={(checked) =>
                            handleCheckboxChange(
                              agent.id,
                              state.value,
                              !!checked,
                            )
                          }
                          className="h-4 w-4"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
