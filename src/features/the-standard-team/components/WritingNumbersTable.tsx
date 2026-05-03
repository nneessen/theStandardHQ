// src/features/the-standard-team/components/WritingNumbersTable.tsx

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TheStandardAgent } from "../hooks/useTheStandardAgents";
import type { Carrier } from "@/types/carrier.types";
import type { Database } from "@/types/database.types";

type AgentWritingNumber =
  Database["public"]["Tables"]["agent_writing_numbers"]["Row"];

interface WritingNumbersTableProps {
  agents: TheStandardAgent[];
  selectedAgentId?: string;
  carriers: Carrier[];
  writingNumbers: AgentWritingNumber[];
  layout?: "carriers-rows" | "agents-rows";
  isLoading?: boolean;
  onUpsertWritingNumber: (params: {
    agentId: string;
    carrierId: string;
    writingNumber: string;
    existingId?: string;
  }) => void;
}

export function WritingNumbersTable({
  agents,
  selectedAgentId,
  carriers,
  writingNumbers,
  layout = "carriers-rows",
  onUpsertWritingNumber,
}: WritingNumbersTableProps) {
  const [editingCell, setEditingCell] = useState<{
    agentId: string;
    carrierId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Build a lookup map for quick access
  const writingNumberMap = useMemo(() => {
    const map = new Map<string, AgentWritingNumber>();
    writingNumbers.forEach((wn) => {
      map.set(`${wn.agent_id}-${wn.carrier_id}`, wn);
    });
    return map;
  }, [writingNumbers]);

  const getWritingNumber = useCallback(
    (agentId: string, carrierId: string) => {
      return writingNumberMap.get(`${agentId}-${carrierId}`);
    },
    [writingNumberMap],
  );

  const handleCellClick = (agentId: string, carrierId: string) => {
    const existing = getWritingNumber(agentId, carrierId);
    setEditingCell({ agentId, carrierId });
    setEditValue(existing?.writing_number || "");
  };

  const handleSave = () => {
    if (!editingCell) return;

    const existing = getWritingNumber(
      editingCell.agentId,
      editingCell.carrierId,
    );
    const trimmedValue = editValue.trim();

    if (trimmedValue) {
      onUpsertWritingNumber({
        agentId: editingCell.agentId,
        carrierId: editingCell.carrierId,
        writingNumber: trimmedValue,
        existingId: existing?.id,
      });
    }

    setEditingCell(null);
    setEditValue("");
  };

  const handleCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const carriersRowsTableWidth = 180 + agents.length * 92;
  const agentsRowsTableWidth = 160 + carriers.length * 110;

  const renderEditingCell = (
    agentId: string,
    carrierId: string,
    widthClass: string,
  ) => {
    const isEditing =
      editingCell?.agentId === agentId && editingCell?.carrierId === carrierId;
    const writingNumber = getWritingNumber(agentId, carrierId);

    return (
      <td
        key={`${agentId}-${carrierId}`}
        className={cn(
          "text-[11px] text-center px-1 py-1 border-b border-v2-ring dark:border-v2-ring align-top",
          widthClass,
          !isEditing &&
            "cursor-pointer hover:bg-v2-card-tinted dark:hover:bg-v2-ring-strong/50",
          agentId === selectedAgentId && "bg-info/10/70 dark:bg-info/10/15",
        )}
        onClick={() => !isEditing && handleCellClick(agentId, carrierId)}
      >
        {isEditing ? (
          <div className="flex items-center gap-1 px-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-6 text-[11px] w-full min-w-[60px]"
              autoFocus
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="p-0.5 rounded hover:bg-success/20 dark:hover:bg-success/50"
            >
              <Check className="h-3.5 w-3.5 text-success" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="p-0.5 rounded hover:bg-destructive/20 dark:hover:bg-destructive/50"
            >
              <X className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        ) : (
          <span
            className={cn(
              writingNumber?.writing_number
                ? "text-v2-ink dark:text-v2-ink"
                : "text-v2-ink-subtle dark:text-v2-ink-muted",
            )}
          >
            {writingNumber?.writing_number || "—"}
          </span>
        )}
      </td>
    );
  };

  if (layout === "agents-rows") {
    return (
      <div className="h-full w-full min-w-0 overflow-auto overscroll-x-contain">
        <div className="inline-block min-w-full align-top">
          <table
            className="w-max min-w-full border-collapse"
            style={{
              width: `${Math.max(agentsRowsTableWidth, 0)}px`,
              minWidth: "100%",
            }}
          >
            <thead className="sticky top-0 z-10">
              <tr className="bg-v2-card-tinted dark:bg-v2-card-tinted">
                <th className="sticky left-0 z-20 bg-v2-card-tinted dark:bg-v2-card-tinted text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wide text-left px-3 py-2 border-b border-v2-ring dark:border-v2-ring-strong min-w-[160px] w-[160px]">
                  Agent
                </th>
                {carriers.map((carrier) => (
                  <th
                    key={carrier.id}
                    className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wide text-center px-2 py-2 border-b border-v2-ring dark:border-v2-ring-strong min-w-[100px] w-[100px] whitespace-nowrap"
                  >
                    {carrier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, idx) => (
                <tr
                  key={agent.id}
                  className={cn(
                    "hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50",
                    idx % 2 === 0
                      ? "bg-v2-card"
                      : "bg-v2-canvas/50 dark:bg-v2-card/50",
                    agent.id === selectedAgentId &&
                      "bg-info/10 hover:bg-info/20/70 dark:hover:bg-info/15",
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 bg-inherit text-[11px] font-medium text-v2-ink dark:text-v2-ink px-3 py-1.5 border-b border-v2-ring dark:border-v2-ring",
                      agent.id === selectedAgentId && "text-info",
                    )}
                  >
                    {agent.first_name} {agent.last_name}
                  </td>
                  {carriers.map((carrier) =>
                    renderEditingCell(
                      agent.id,
                      carrier.id,
                      "min-w-[110px] w-[110px]",
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-w-0 overflow-auto overscroll-x-contain">
      <div className="inline-block min-w-full align-top">
        <table
          className="w-max min-w-full border-collapse"
          style={{
            width: `${Math.max(carriersRowsTableWidth, 0)}px`,
            minWidth: "100%",
          }}
        >
          <thead className="sticky top-0 z-10">
            <tr className="bg-v2-card-tinted dark:bg-v2-card-tinted">
              <th className="sticky left-0 z-20 bg-v2-card-tinted dark:bg-v2-card-tinted text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wide text-left px-3 py-2 border-b border-v2-ring dark:border-v2-ring-strong min-w-[180px] w-[180px]">
                Carrier
              </th>
              {agents.map((agent) => (
                <th
                  key={agent.id}
                  className={cn(
                    "text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wide text-center px-2 py-2 border-b border-v2-ring dark:border-v2-ring-strong min-w-[92px] w-[92px] whitespace-nowrap",
                    agent.id === selectedAgentId &&
                      "bg-info/20/70 dark:bg-info/20 text-info",
                  )}
                  title={`${agent.first_name} ${agent.last_name}`}
                >
                  <div className="truncate max-w-[86px]">
                    {agent.first_name?.[0]}. {agent.last_name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carriers.map((carrier, idx) => (
              <tr
                key={carrier.id}
                className={cn(
                  "hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50",
                  idx % 2 === 0
                    ? "bg-v2-card"
                    : "bg-v2-canvas/50 dark:bg-v2-card/50",
                )}
              >
                <td className="sticky left-0 z-10 bg-inherit text-[11px] font-medium text-v2-ink dark:text-v2-ink px-3 py-1.5 border-b border-v2-ring dark:border-v2-ring">
                  <div className="truncate max-w-[170px]" title={carrier.name}>
                    {carrier.name}
                  </div>
                </td>
                {agents.map((agent) =>
                  renderEditingCell(
                    agent.id,
                    carrier.id,
                    "min-w-[92px] w-[92px]",
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
