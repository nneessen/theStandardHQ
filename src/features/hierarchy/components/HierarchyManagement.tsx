// src/features/hierarchy/components/HierarchyManagement.tsx

import React, { useState, useMemo } from "react";
import { Shield, AlertCircle, Edit } from "lucide-react";
import { UserSearchCombobox } from "@/components/shared/user-search-combobox";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  useMyDownlines,
  useUpdateAgentHierarchy,
  useCurrentUserProfile,
} from "@/hooks";
import type {
  UserProfile,
  HierarchyChangeRequest,
} from "@/types/hierarchy.types";

interface HierarchyManagementProps {
  className?: string;
}

/**
 * Dialog for editing agent hierarchy assignment
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

  // Compute exclude IDs: agent itself + all downlines (to prevent circular references)
  const excludeIds = useMemo(() => {
    if (!agent) return [];
    const downlineIds = allAgents
      .filter((a) => (a.hierarchy_path || "").includes(agent.id))
      .map((a) => a.id);
    return [agent.id, ...downlineIds];
  }, [agent, allAgents]);

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
            <UserSearchCombobox
              value={selectedUplineId}
              onChange={setSelectedUplineId}
              excludeIds={excludeIds}
              approvalStatus="approved"
              placeholder="Search for upline..."
              showNoUplineOption={true}
              noUplineLabel="No Upline (Root Agent)"
              className="h-9"
            />
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
            <AlertCircle className="h-4 w-4" />
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
 * HierarchyManagement - Admin-only component for managing agent hierarchy assignments
 * Allows admins to assign agents to uplines and manage the org structure
 */
export function HierarchyManagement({ className }: HierarchyManagementProps) {
  const { data: downlines, isLoading } = useMyDownlines();
  const updateHierarchy = useUpdateAgentHierarchy();
  const { data: profile } = useCurrentUserProfile();

  const [selectedAgent, setSelectedAgent] = useState<UserProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check admin status from database profile
  const isAdmin = profile?.is_admin === true;

  const handleEditAgent = (agent: UserProfile) => {
    setSelectedAgent(agent);
    setDialogOpen(true);
  };

  const handleSaveHierarchy = async (request: HierarchyChangeRequest) => {
    await updateHierarchy.mutateAsync(request);
  };

  if (!isAdmin) {
    return (
      <div
        className={`bg-card rounded-v2-md border border-border shadow-v2-soft ${className || ""}`}
      >
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            Hierarchy Management
          </h3>
        </div>
        <div className="p-3">
          <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded border border-destructive/30">
            <Shield className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-[11px] text-destructive">
              You do not have permission to manage hierarchy. This feature is
              restricted to administrators only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Group agents by hierarchy level
  const agentsByLevel = (downlines || []).reduce(
    (acc, agent) => {
      const level = agent.hierarchy_depth ?? 0;
      if (!acc[level]) acc[level] = [];
      acc[level].push(agent);
      return acc;
    },
    {} as Record<number, UserProfile[]>,
  );

  const levels = Object.keys(agentsByLevel)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div
      className={`bg-card rounded-v2-md border border-border shadow-v2-soft ${className || ""}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-warning" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Hierarchy Management
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {downlines?.length || 0} agents across {levels.length} levels
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-[9px] h-5 border-warning/40 dark:border-warning text-warning"
        >
          Admin Only
        </Badge>
      </div>
      <div className="p-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-[11px] text-muted-foreground">
              Loading agents...
            </div>
          </div>
        ) : !downlines || downlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Shield className="h-6 w-6 text-muted-foreground mb-1" />
            <p className="text-[11px] text-muted-foreground">
              No agents in hierarchy
            </p>
            <p className="text-[10px] text-muted-foreground">
              Agents will appear here once they are added to the system
            </p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-border">
            <Table>
              <TableHeader>
                <TableRow className="h-8 bg-background border-b border-border">
                  <TableHead className="text-[10px] font-semibold text-muted-foreground">
                    Agent
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground">
                    Level
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground">
                    Reports To
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground text-right">
                    Direct
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground text-right">
                    Total Down
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {downlines.map((agent) => {
                  const directDownlines = downlines.filter(
                    (d) => d.upline_id === agent.id,
                  ).length;
                  const totalDownlines = downlines.filter(
                    (d) =>
                      (d.hierarchy_path || "").includes(agent.id) &&
                      d.id !== agent.id,
                  ).length;
                  const uplineEmail = agent.upline_id
                    ? downlines.find((d) => d.id === agent.upline_id)?.email
                    : null;

                  return (
                    <TableRow
                      key={agent.id}
                      className="h-9 border-b border-border/60 hover:bg-background"
                    >
                      <TableCell className="text-[11px] font-medium text-foreground">
                        {agent.email}
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                          L{agent.hierarchy_depth}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {uplineEmail || (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 border-border "
                          >
                            Root
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] text-right text-muted-foreground">
                        {directDownlines}
                      </TableCell>
                      <TableCell className="text-[11px] text-right text-muted-foreground">
                        {totalDownlines}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAgent(agent)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditHierarchyDialog
        agent={selectedAgent}
        allAgents={downlines || []}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveHierarchy}
      />
    </div>
  );
}
