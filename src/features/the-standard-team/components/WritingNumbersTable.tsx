// src/features/the-standard-team/components/WritingNumbersTable.tsx

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/components/board";
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

// Charcoal "Board" table tokens.
const HEADER_BG = T.panel2;
const ROW_EVEN = T.panel;
const ROW_ODD = "#141415";
const CELL_BORDER = `1px solid ${T.line}`;
const SELECTED_BG = "rgba(91,155,255,0.12)";

const headerCellStyle: React.CSSProperties = {
  font: `700 10px ${T.mono}`,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: T.mut2,
  padding: "8px 10px",
  borderBottom: CELL_BORDER,
  whiteSpace: "nowrap",
};

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
    const isSelectedCol = agentId === selectedAgentId;

    return (
      <td
        key={`${agentId}-${carrierId}`}
        className={cn(
          "text-center align-top",
          widthClass,
          !isEditing && "cursor-pointer hover:bg-white/[0.05]",
        )}
        style={{
          font: `600 11px ${T.mono}`,
          padding: "5px 4px",
          borderBottom: CELL_BORDER,
          background: isSelectedCol ? SELECTED_BG : undefined,
        }}
        onClick={() => !isEditing && handleCellClick(agentId, carrierId)}
      >
        {isEditing ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "0 4px",
            }}
          >
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-6 text-[11px] w-full min-w-[60px]"
              autoFocus
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="p-0.5 rounded hover:bg-white/10"
            >
              <Check className="h-3.5 w-3.5" style={{ color: T.green }} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="p-0.5 rounded hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" style={{ color: T.red }} />
            </button>
          </div>
        ) : (
          <span
            style={{
              color: writingNumber?.writing_number ? T.cream : T.mut2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {writingNumber?.writing_number || "—"}
          </span>
        )}
      </td>
    );
  };

  if (layout === "agents-rows") {
    return (
      <div
        className="h-full w-full min-w-0 overflow-auto overscroll-x-contain"
        style={{ background: T.panel }}
      >
        <div className="inline-block min-w-full align-top">
          <table
            className="w-max min-w-full border-collapse"
            style={{
              width: `${Math.max(agentsRowsTableWidth, 0)}px`,
              minWidth: "100%",
            }}
          >
            <thead className="sticky top-0 z-10">
              <tr style={{ background: HEADER_BG }}>
                <th
                  className="sticky left-0 z-20 text-left min-w-[160px] w-[160px]"
                  style={{ ...headerCellStyle, background: HEADER_BG }}
                >
                  Agent
                </th>
                {carriers.map((carrier) => (
                  <th
                    key={carrier.id}
                    className="text-center min-w-[100px] w-[100px]"
                    style={headerCellStyle}
                  >
                    {carrier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, idx) => {
                const rowBg =
                  agent.id === selectedAgentId
                    ? SELECTED_BG
                    : idx % 2 === 0
                      ? ROW_EVEN
                      : ROW_ODD;
                return (
                  <tr key={agent.id} style={{ background: rowBg }}>
                    <td
                      className="sticky left-0 z-10"
                      style={{
                        background: rowBg,
                        font: `600 11px ${T.data}`,
                        color: agent.id === selectedAgentId ? T.blue : T.ink,
                        padding: "6px 12px",
                        borderBottom: CELL_BORDER,
                        whiteSpace: "nowrap",
                      }}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full min-w-0 overflow-auto overscroll-x-contain"
      style={{ background: T.panel }}
    >
      <div className="inline-block min-w-full align-top">
        <table
          className="w-max min-w-full border-collapse"
          style={{
            width: `${Math.max(carriersRowsTableWidth, 0)}px`,
            minWidth: "100%",
          }}
        >
          <thead className="sticky top-0 z-10">
            <tr style={{ background: HEADER_BG }}>
              <th
                className="sticky left-0 z-20 text-left min-w-[180px] w-[180px]"
                style={{ ...headerCellStyle, background: HEADER_BG }}
              >
                Carrier
              </th>
              {agents.map((agent) => (
                <th
                  key={agent.id}
                  className="text-center min-w-[92px] w-[92px]"
                  style={{
                    ...headerCellStyle,
                    background:
                      agent.id === selectedAgentId ? SELECTED_BG : undefined,
                    color: agent.id === selectedAgentId ? T.blue : T.mut2,
                  }}
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
            {carriers.map((carrier, idx) => {
              const rowBg = idx % 2 === 0 ? ROW_EVEN : ROW_ODD;
              return (
                <tr key={carrier.id} style={{ background: rowBg }}>
                  <td
                    className="sticky left-0 z-10"
                    style={{
                      background: rowBg,
                      font: `600 11px ${T.data}`,
                      color: T.ink,
                      padding: "6px 12px",
                      borderBottom: CELL_BORDER,
                    }}
                  >
                    <div
                      className="truncate max-w-[170px]"
                      title={carrier.name}
                    >
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
