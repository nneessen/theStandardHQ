// src/features/workflows/components/WorkflowManager.tsx

import { useState } from "react";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Settings,
  Clock,
  Zap,
  Mail,
  AlertCircle,
  Shield,
  Copy,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useWorkflows,
  useWorkflowRuns,
  useUpdateWorkflowStatus,
  useDeleteWorkflow,
  useImoWorkflowTemplates,
  useSaveAsOrgTemplate,
  useCloneOrgTemplate,
  useDeleteOrgTemplate,
} from "@/hooks/workflows";
import WorkflowWizard from "./WorkflowWizard";
import TestRunDialog from "./TestRunDialog";
import EventTypeManager from "./EventTypeManager";
import { EmailTemplatesTab } from "@/features/training-hub";
import type { Workflow } from "@/types/workflow.types";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { cn } from "@/lib/utils";
import { useCurrentUserProfile, useAuthorizationStatus } from "@/hooks/admin";

export default function WorkflowManager() {
  const { user } = useAuth();
  const { data: profile } = useCurrentUserProfile();
  const { isSuperAdmin } = useAuthorizationStatus();
  const { isImoAdmin, imo } = useImo();
  const [showDialog, setShowDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null);
  const [showRecentRuns, setShowRecentRuns] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("workflows");
  const [testRunWorkflow, setTestRunWorkflow] = useState<Workflow | null>(null);
  const [cloneTemplateId, setCloneTemplateId] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const { data: workflows = [], isLoading, error } = useWorkflows();
  const { data: runs = [] } = useWorkflowRuns(undefined, 5); // Only fetch 5 most recent
  const { data: orgTemplates = [] } = useImoWorkflowTemplates({
    enabled: !!imo,
  });
  const updateStatus = useUpdateWorkflowStatus();
  const deleteWorkflow = useDeleteWorkflow();
  const saveAsOrgTemplate = useSaveAsOrgTemplate();
  const cloneOrgTemplate = useCloneOrgTemplate();
  const deleteOrgTemplate = useDeleteOrgTemplate();

  const isAdmin = profile?.is_admin === true || isSuperAdmin;

  const handleDeleteTemplateConfirm = () => {
    if (deleteTemplateId) {
      deleteOrgTemplate.mutate(deleteTemplateId);
      setDeleteTemplateId(null);
    }
  };

  const templateToDelete = deleteTemplateId
    ? orgTemplates.find((t) => t.id === deleteTemplateId) ||
      workflows.find((w) => w.id === deleteTemplateId)
    : null;

  if (!user) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Please log in to view workflows
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading workflows...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <AlertCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
        <p className="text-sm text-destructive">Error loading workflows</p>
        <p className="text-xs text-muted-foreground mt-1">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const workflowToDelete = deleteWorkflowId
    ? workflows.find((w) => w.id === deleteWorkflowId)
    : null;

  const handleDeleteConfirm = async () => {
    if (deleteWorkflowId) {
      deleteWorkflow.mutate(deleteWorkflowId);
      setDeleteWorkflowId(null);
    }
  };

  const statusColors = {
    draft:
      "bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink-muted",
    active:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    paused:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    archived:
      "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-muted",
  };

  const triggerIcons = {
    manual: <Play className="h-3 w-3" />,
    schedule: <Clock className="h-3 w-3" />,
    event: <Zap className="h-3 w-3" />,
    webhook: <Mail className="h-3 w-3" />,
  };

  const runStatusColors = {
    completed: "text-emerald-600 dark:text-emerald-400",
    failed: "text-red-600 dark:text-red-400",
    running: "text-blue-600 dark:text-blue-400",
    pending: "text-v2-ink-muted dark:text-v2-ink-subtle",
    cancelled: "text-orange-600 dark:text-orange-400",
  };

  return (
    <div className="h-full flex flex-col p-3">
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="h-full flex flex-col"
      >
        <div className="flex items-center justify-between mb-2">
          <TabsList className="h-7 bg-v2-card-tinted dark:bg-v2-card-tinted">
            <TabsTrigger
              value="workflows"
              className="text-[11px] h-6 data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card"
            >
              Workflows
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger
                  value="templates"
                  className="text-[11px] h-6 data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Email Templates
                </TabsTrigger>
                <TabsTrigger
                  value="events"
                  className="text-[11px] h-6 data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Event Types
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {activeTab === "workflows" && (
            <Button
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => {
                setEditingWorkflow(null);
                setShowDialog(true);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Workflow
            </Button>
          )}
        </div>

        {/* Workflows Tab Content */}
        <TabsContent value="workflows" className="flex-1 mt-0">
          <div className="h-full flex flex-col">
            {/* Workflow Stats Header */}
            <div className="flex items-center gap-3 mb-2 text-[11px]">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-v2-ink-subtle" />
                <span className="font-medium text-v2-ink dark:text-v2-ink">
                  {workflows.length}
                </span>
                <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                  workflow{workflows.length !== 1 ? "s" : ""}
                </span>
              </div>
              {runs.length > 0 && (
                <>
                  <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
                  <button
                    onClick={() => setShowRecentRuns(!showRecentRuns)}
                    className="flex items-center gap-1 text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-ink-subtle transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-v2-ink dark:text-v2-ink">
                      {runs.length}
                    </span>
                    <span>recent run{runs.length !== 1 ? "s" : ""}</span>
                    <span className="text-[10px]">
                      ({showRecentRuns ? "−" : "+"})
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Recent Runs - Collapsible inline view */}
            {showRecentRuns && runs.length > 0 && (
              <div className="mb-2 rounded-lg border border-v2-ring dark:border-v2-ring-strong px-2.5 py-2 bg-v2-canvas dark:bg-v2-card-tinted/50">
                <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase mb-1">
                  Recent Activity
                </div>
                <div className="space-y-0.5">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between text-[11px] py-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-medium",
                            runStatusColors[run.status],
                          )}
                        >
                          {run.status === "completed"
                            ? "✓"
                            : run.status === "failed"
                              ? "✗"
                              : "○"}
                        </span>
                        <span className="text-v2-ink-muted dark:text-v2-ink-muted">
                          {run.workflow?.name || "Unknown"}
                        </span>
                        <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                          {run.startedAt
                            ? new Date(run.startedAt).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "Pending"}
                        </span>
                      </div>
                      {run.completedAt && run.startedAt && (
                        <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                          {Math.round(
                            (new Date(run.completedAt).getTime() -
                              new Date(run.startedAt).getTime()) /
                              1000,
                          )}
                          s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workflows Table - Full width */}
            <div className="flex-1 rounded-lg border border-v2-ring dark:border-v2-ring-strong overflow-auto">
              {workflows.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="h-6 w-6 mx-auto mb-2 text-v2-ink-subtle" />
                  <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle mb-2">
                    No workflows created yet
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] border-v2-ring dark:border-v2-ring-strong"
                    onClick={() => setShowDialog(true)}
                  >
                    Create Your First Workflow
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="h-7 bg-v2-canvas dark:bg-v2-card-tinted/50 border-b border-v2-ring dark:border-v2-ring-strong">
                      <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted py-1">
                        Name
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted py-1">
                        Description
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted py-1">
                        Type
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted py-1">
                        Status
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted py-1">
                        Last Run
                      </TableHead>
                      <TableHead className="text-[10px] py-1 w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflows.map((workflow) => {
                      const lastRun = runs.find(
                        (r) => r.workflowId === workflow.id,
                      );
                      return (
                        <TableRow
                          key={workflow.id}
                          className="h-8 border-b border-v2-ring dark:border-v2-ring hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50"
                        >
                          <TableCell className="py-1">
                            <div className="flex items-center gap-1.5">
                              {workflow.isOrgTemplate && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                                >
                                  Template
                                </Badge>
                              )}
                              <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                                {workflow.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-1">
                            <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate max-w-[300px]">
                              {workflow.description || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="py-1">
                            <div className="flex items-center gap-1 text-v2-ink-muted dark:text-v2-ink-subtle">
                              {triggerIcons[workflow.triggerType]}
                              <span className="text-[10px]">
                                {workflow.triggerType}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-1">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] py-0 px-1",
                                statusColors[workflow.status],
                              )}
                            >
                              {workflow.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1">
                            {lastRun ? (
                              <div className="flex items-center gap-1">
                                <span
                                  className={cn(
                                    "text-[10px]",
                                    runStatusColors[lastRun.status],
                                  )}
                                >
                                  {lastRun.status}
                                </span>
                                <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                                  {lastRun.startedAt
                                    ? new Date(
                                        lastRun.startedAt,
                                      ).toLocaleDateString()
                                    : "—"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                                Never
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                {workflow.status === "active" && (
                                  <DropdownMenuItem
                                    onClick={() => setTestRunWorkflow(workflow)}
                                    className="text-xs"
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Run Now
                                  </DropdownMenuItem>
                                )}
                                {workflow.status === "active" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateStatus.mutate({
                                        id: workflow.id,
                                        status: "paused",
                                      })
                                    }
                                    className="text-xs"
                                  >
                                    <Pause className="h-3 w-3 mr-1" />
                                    Pause
                                  </DropdownMenuItem>
                                )}
                                {workflow.status === "paused" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateStatus.mutate({
                                        id: workflow.id,
                                        status: "active",
                                      })
                                    }
                                    className="text-xs"
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Resume
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingWorkflow(workflow);
                                    setShowDialog(true);
                                  }}
                                  className="text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </DropdownMenuItem>
                                {isImoAdmin && !workflow.isOrgTemplate && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      saveAsOrgTemplate.mutate(workflow.id)
                                    }
                                    className="text-xs"
                                    disabled={saveAsOrgTemplate.isPending}
                                  >
                                    <Share2 className="h-3 w-3 mr-1" />
                                    Save as Org Template
                                  </DropdownMenuItem>
                                )}
                                {workflow.isOrgTemplate && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setCloneTemplateId(workflow.id);
                                      setCloneName(`${workflow.name} (Copy)`);
                                    }}
                                    className="text-xs"
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Clone
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-xs text-red-600"
                                  onClick={() =>
                                    workflow.isOrgTemplate
                                      ? setDeleteTemplateId(workflow.id)
                                      : setDeleteWorkflowId(workflow.id)
                                  }
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Email Templates Tab Content (Admin Only) */}
        {isAdmin && (
          <TabsContent
            value="templates"
            className="flex-1 mt-0 h-full overflow-hidden"
          >
            <EmailTemplatesTab searchQuery="" />
          </TabsContent>
        )}

        {/* Event Types Tab Content (Admin Only) */}
        {isAdmin && (
          <TabsContent value="events" className="flex-1 mt-0">
            <EventTypeManager />
          </TabsContent>
        )}
      </Tabs>

      {/* Test Run Dialog */}
      {testRunWorkflow && (
        <TestRunDialog
          open={!!testRunWorkflow}
          onOpenChange={(open) => {
            if (!open) setTestRunWorkflow(null);
          }}
          workflow={testRunWorkflow}
        />
      )}

      {/* Dialogs */}
      <WorkflowWizard
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) {
            setEditingWorkflow(null);
          }
        }}
        workflow={editingWorkflow}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteWorkflowId}
        onOpenChange={(open) => !open && setDeleteWorkflowId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Delete Workflow
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete "{workflowToDelete?.name}"? This
              action cannot be undone. All associated runs and history will also
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clone Template Dialog */}
      <AlertDialog
        open={!!cloneTemplateId}
        onOpenChange={(open) => {
          if (!open) {
            setCloneTemplateId(null);
            setCloneName("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Clone Org Template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Create a personal copy of this org template. Enter a name for your
              new workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Workflow name"
              className="h-8 text-xs"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cloneTemplateId && cloneName.trim()) {
                  cloneOrgTemplate.mutate({
                    templateId: cloneTemplateId,
                    newName: cloneName.trim(),
                  });
                  setCloneTemplateId(null);
                  setCloneName("");
                }
              }}
              disabled={!cloneName.trim() || cloneOrgTemplate.isPending}
              className="h-7 text-xs"
            >
              {cloneOrgTemplate.isPending ? "Cloning..." : "Clone"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Org Template Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={(open) => !open && setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Delete Org Template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete "{templateToDelete?.name}"? This
              action cannot be undone. This will remove the template for all
              members of your organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplateConfirm}
              className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
