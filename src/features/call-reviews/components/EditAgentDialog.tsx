// src/features/call-reviews/components/EditAgentDialog.tsx
// Shared "Reassign call" dialog: attribute an existing recording to a different
// agent. Used by both the library table (per-row pencil) and the call detail
// header. Mirrors the upload-time picker — a roster agent sets agent_id (and
// clears any off-system name), while "Other agent" keeps agent_id and records
// the typed name in metadata.external_agent_name. Only rendered for a
// super-admin; the recording UPDATE RLS still enforces the write.

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useUpdateCallAgent,
  type AgentName,
  type CallLibraryRow,
} from "../hooks/useCallLibrary";

// Sentinel select value for "this call belongs to someone not in the roster".
export const OTHER_AGENT = "__other__";

// A super-admin can attribute a recording to an off-system agent by typing a
// name; it's persisted in metadata.external_agent_name (agent_id stays put).
// Prefer that label over the agent_id → name lookup wherever an owner is shown.
export function externalAgentName(r: CallLibraryRow): string | null {
  const m = r.metadata;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const v = (m as Record<string, unknown>).external_agent_name;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

interface EditAgentDialogProps {
  row: CallLibraryRow;
  agents: AgentName[];
  agentNames: Record<string, string>;
  currentUserId: string | null;
  onClose: () => void;
}

export function EditAgentDialog({
  row,
  agents,
  agentNames,
  currentUserId,
  onClose,
}: EditAgentDialogProps) {
  const updateMutation = useUpdateCallAgent();
  const existingExternal = externalAgentName(row);
  const [assignTo, setAssignTo] = useState<string>(
    existingExternal ? OTHER_AGENT : row.agent_id,
  );
  const [externalName, setExternalName] = useState(existingExternal ?? "");

  const isOther = assignTo === OTHER_AGENT;
  const trimmedExternal = externalName.trim();
  const canSave =
    (!isOther || trimmedExternal.length > 0) && !updateMutation.isPending;

  const save = () => {
    // Merge into existing metadata so consent acks etc. are preserved. A roster
    // agent removes any prior off-system name; "Other" sets it (agent_id stays).
    const base =
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};
    if (isOther) {
      base.external_agent_name = trimmedExternal;
    } else {
      delete base.external_agent_name;
    }
    const agentId = isOther ? row.agent_id : assignTo;
    updateMutation.mutate(
      {
        id: row.id,
        agentId,
        metadata: base as CallLibraryRow["metadata"],
      },
      { onSuccess: onClose },
    );
  };

  const currentLabel =
    existingExternal ?? agentNames[row.agent_id] ?? "Unassigned";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Reassign call</DialogTitle>
          <DialogDescription className="text-[11px]">
            Currently attributed to{" "}
            <span className="font-medium text-v2-ink">{currentLabel}</span>.
            Choose who this call belongs to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-v2-ink-muted">
            Whose call is this?
          </label>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="h-8 w-full text-xs rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
          >
            {currentUserId && (
              <option value={currentUserId}>
                Me ({agentNames[currentUserId] ?? "my own calls"})
              </option>
            )}
            {agents
              .filter((a) => a.id !== currentUserId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            <option value={OTHER_AGENT}>Other agent (not listed)…</option>
          </select>
          {isOther && (
            <Input
              value={externalName}
              onChange={(e) => setExternalName(e.target.value)}
              placeholder="Type the agent's name"
              className="h-8 text-xs"
              autoFocus
            />
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            disabled={!canSave}
            onClick={save}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Check className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
