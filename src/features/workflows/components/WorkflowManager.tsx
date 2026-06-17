// src/features/workflows/components/WorkflowManager.tsx

import { useState } from "react";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Clock,
  Zap,
  Mail,
  Webhook,
  AlertCircle,
  Shield,
  Copy,
  Share2,
  MoreHorizontal,
} from "lucide-react";
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
import { tint, TRIGGER_ACCENT } from "../board";
import { useCurrentUserProfile, useAuthorizationStatus } from "@/hooks/admin";

const TRIGGER_ICON: Record<string, React.ElementType> = {
  manual: Play,
  schedule: Clock,
  event: Zap,
  webhook: Webhook,
};

function relTime(d?: string | null): string {
  if (!d) return "Never";
  const t = new Date(d).getTime();
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const tabCls =
  "rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2 pt-1 font-sans text-[13px] font-semibold text-[var(--mut)] data-[state=active]:border-[var(--blue)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--cream)] data-[state=active]:shadow-none";

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
      <div
        className="rounded-xl p-8 text-center"
        style={{ border: "1px solid var(--line)" }}
      >
        <p className="font-sans text-[14px]" style={{ color: "var(--mut)" }}>
          Please log in to view workflows
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ border: "1px solid var(--line)" }}
      >
        <p className="font-sans text-[14px]" style={{ color: "var(--mut)" }}>
          Loading workflows…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ border: "1px solid var(--line)" }}
      >
        <AlertCircle
          className="mx-auto mb-2 h-6 w-6"
          style={{ color: "var(--red)" }}
        />
        <p className="font-sans text-[14px]" style={{ color: "var(--red)" }}>
          Error loading workflows
        </p>
        <p
          className="mt-1 font-sans text-[12px]"
          style={{ color: "var(--mut)" }}
        >
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

  const activeCount = workflows.filter((w) => w.status === "active").length;

  const statusPill = (status: string) => {
    const map: Record<string, { label: string; accent: string }> = {
      active: { label: "Active", accent: "--green" },
      paused: { label: "Paused", accent: "--amber" },
      draft: { label: "Draft", accent: "--mut" },
      archived: { label: "Archived", accent: "--mut2" },
    };
    const s = map[status] || map.draft;
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-sans text-[11px] font-semibold"
        style={{ background: tint(s.accent, 14), color: `var(${s.accent})` }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: `var(${s.accent})`,
            boxShadow:
              status === "active" ? `0 0 6px var(${s.accent})` : "none",
          }}
        />
        {s.label}
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col"
      >
        {/* ── Tab bar + toolbar ─────────────────────────────────────────── */}
        <div
          className="mb-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <TabsList className="h-auto gap-1 bg-transparent p-0">
            <TabsTrigger value="workflows" className={tabCls}>
              Workflows
              <span
                className="ml-1.5 font-mono text-[11px]"
                style={{ color: "var(--mut2)" }}
              >
                {workflows.length}
              </span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="templates" className={tabCls}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Email Templates
                </TabsTrigger>
                <TabsTrigger value="events" className={tabCls}>
                  <Shield className="mr-1.5 h-3.5 w-3.5" />
                  Event Types
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {activeTab === "workflows" && (
            <button
              type="button"
              onClick={() => {
                setEditingWorkflow(null);
                setShowDialog(true);
              }}
              className="mb-1.5 flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{ background: "var(--blue)", color: "#0c1322" }}
            >
              <Plus className="h-4 w-4" />
              Create Workflow
            </button>
          )}
        </div>

        {/* ── Workflows tab ─────────────────────────────────────────────── */}
        <TabsContent value="workflows" className="mt-0 flex-1 overflow-y-auto">
          {/* Stat strip */}
          <div className="mb-4 flex items-center gap-4 font-sans text-[12.5px]">
            <span style={{ color: "var(--mut)" }}>
              <span
                className="font-mono font-bold"
                style={{ color: "var(--ink)" }}
              >
                {workflows.length}
              </span>{" "}
              workflow{workflows.length !== 1 ? "s" : ""}
            </span>
            <span
              className="h-3.5 w-px"
              style={{ background: "var(--line2)" }}
            />
            <span style={{ color: "var(--mut)" }}>
              <span
                className="font-mono font-bold"
                style={{ color: "var(--green)" }}
              >
                {activeCount}
              </span>{" "}
              active
            </span>
            {runs.length > 0 && (
              <>
                <span
                  className="h-3.5 w-px"
                  style={{ background: "var(--line2)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowRecentRuns(!showRecentRuns)}
                  className="transition-colors hover:text-[var(--ink)]"
                  style={{ color: "var(--mut)" }}
                >
                  <span
                    className="font-mono font-bold"
                    style={{ color: "var(--ink)" }}
                  >
                    {runs.length}
                  </span>{" "}
                  recent run{runs.length !== 1 ? "s" : ""}{" "}
                  <span style={{ color: "var(--mut2)" }}>
                    ({showRecentRuns ? "−" : "+"})
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Recent runs (collapsible) */}
          {showRecentRuns && runs.length > 0 && (
            <div
              className="mb-4 rounded-xl px-4 py-3"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
              }}
            >
              <p
                className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--mut2)" }}
              >
                Recent Activity
              </p>
              <div className="space-y-1">
                {runs.map((run) => {
                  const ok = run.status === "completed";
                  const bad = run.status === "failed";
                  const accent = ok ? "--green" : bad ? "--red" : "--mut";
                  return (
                    <div
                      key={run.id}
                      className="flex items-center justify-between font-sans text-[12px]"
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: `var(${accent})` }}>
                          {ok ? "✓" : bad ? "✗" : "○"}
                        </span>
                        <span style={{ color: "var(--mut)" }}>
                          {run.workflow?.name || "Unknown"}
                        </span>
                        <span
                          className="font-mono text-[11px]"
                          style={{ color: "var(--mut2)" }}
                        >
                          {relTime(run.startedAt)}
                        </span>
                      </div>
                      {run.completedAt && run.startedAt && (
                        <span
                          className="font-mono text-[11px]"
                          style={{ color: "var(--mut2)" }}
                        >
                          {Math.round(
                            (new Date(run.completedAt).getTime() -
                              new Date(run.startedAt).getTime()) /
                              1000,
                          )}
                          s
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card grid OR empty state */}
          {workflows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center"
              style={{
                border: "1px dashed var(--line2)",
                background: "var(--surface-2)",
              }}
            >
              <span
                className="flex h-20 w-20 items-center justify-center rounded-2xl"
                style={{ background: tint("--blue", 12), color: "var(--blue)" }}
              >
                <Zap className="h-9 w-9" />
              </span>
              <p
                className="font-display text-[20px] font-extrabold uppercase tracking-wide"
                style={{ color: "var(--ink)" }}
              >
                No Workflows Yet
              </p>
              <p
                className="max-w-sm font-sans text-[13.5px]"
                style={{ color: "var(--mut)" }}
              >
                Automate your agency — send a welcome email when an agent gets
                licensed, alert on a chargeback, remind on a renewal. Build your
                first one to get started.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingWorkflow(null);
                  setShowDialog(true);
                }}
                className="mt-1 flex h-10 items-center gap-1.5 rounded-lg px-5 font-sans text-[13px] font-semibold transition-opacity hover:opacity-80"
                style={{ background: "var(--blue)", color: "#0c1322" }}
              >
                <Plus className="h-4 w-4" />
                Create Your First Workflow
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {workflows.map((workflow) => {
                const lastRun = runs.find((r) => r.workflowId === workflow.id);
                const accent = TRIGGER_ACCENT[workflow.triggerType] || "--blue";
                const Icon = TRIGGER_ICON[workflow.triggerType] || Zap;
                const steps = Array.isArray(workflow.actions)
                  ? workflow.actions.length
                  : 0;
                const triggerLabel =
                  workflow.triggerType === "event" &&
                  workflow.config?.trigger?.eventName
                    ? workflow.config.trigger.eventName
                    : workflow.triggerType;
                return (
                  <div
                    key={workflow.id}
                    className="group relative overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5"
                    style={{
                      background: "var(--panelgrad)",
                      border: "1px solid var(--line)",
                      boxShadow: "var(--panelshadow)",
                    }}
                  >
                    {/* left accent bar */}
                    <span
                      className="absolute left-0 top-0 h-full w-[3px]"
                      style={{ background: `var(${accent})` }}
                    />
                    <div className="p-4 pl-5">
                      {/* top row */}
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background: tint(accent, 14),
                            color: `var(${accent})`,
                          }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p
                              className="truncate font-display text-[17px] font-extrabold"
                              style={{ color: "var(--ink)" }}
                            >
                              {workflow.name}
                            </p>
                            {workflow.isOrgTemplate && (
                              <span
                                className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase"
                                style={{
                                  background: tint("--cyan", 14),
                                  color: "var(--cyan)",
                                }}
                              >
                                Template
                              </span>
                            )}
                          </div>
                          <p
                            className="mt-0.5 truncate font-sans text-[13px]"
                            style={{ color: "var(--mut)" }}
                          >
                            {workflow.description || "No description"}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-4)]"
                              style={{ color: "var(--mut2)" }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            {workflow.status === "active" && (
                              <DropdownMenuItem
                                onClick={() => setTestRunWorkflow(workflow)}
                                className="text-xs"
                              >
                                <Play className="mr-1.5 h-3 w-3" />
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
                                <Pause className="mr-1.5 h-3 w-3" />
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
                                <Play className="mr-1.5 h-3 w-3" />
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
                              <Edit className="mr-1.5 h-3 w-3" />
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
                                <Share2 className="mr-1.5 h-3 w-3" />
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
                                <Copy className="mr-1.5 h-3 w-3" />
                                Clone
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-xs text-destructive"
                              onClick={() =>
                                workflow.isOrgTemplate
                                  ? setDeleteTemplateId(workflow.id)
                                  : setDeleteWorkflowId(workflow.id)
                              }
                            >
                              <Trash2 className="mr-1.5 h-3 w-3" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* meta pills */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {statusPill(workflow.status)}
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px]"
                          style={{
                            background: tint(accent, 12),
                            color: `var(${accent})`,
                          }}
                        >
                          <Icon className="h-3 w-3" />
                          {triggerLabel}
                        </span>
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 font-sans text-[11px]"
                          style={{
                            background: "var(--surface-4)",
                            color: "var(--mut)",
                          }}
                        >
                          {steps} step{steps !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* foot */}
                      <div
                        className="mt-3 flex items-center justify-between pt-3"
                        style={{ borderTop: "1px solid var(--line)" }}
                      >
                        <span
                          className="font-sans text-[11.5px]"
                          style={{ color: "var(--mut2)" }}
                        >
                          {lastRun ? (
                            <>
                              Last run{" "}
                              <span
                                style={{
                                  color:
                                    lastRun.status === "completed"
                                      ? "var(--green)"
                                      : lastRun.status === "failed"
                                        ? "var(--red)"
                                        : "var(--mut)",
                                }}
                              >
                                {lastRun.status}
                              </span>
                            </>
                          ) : (
                            "Never run"
                          )}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 font-mono text-[11px]"
                          style={{ color: "var(--mut2)" }}
                        >
                          <Clock className="h-3 w-3" />
                          {relTime(lastRun?.startedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Email Templates Tab (Admin Only) */}
        {isAdmin && (
          <TabsContent
            value="templates"
            className="mt-0 h-full flex-1 overflow-hidden"
          >
            <EmailTemplatesTab searchQuery="" />
          </TabsContent>
        )}

        {/* Event Types Tab (Admin Only) */}
        {isAdmin && (
          <TabsContent value="events" className="mt-0 flex-1 overflow-y-auto">
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

      {/* Create / Edit Wizard */}
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

      {/* Delete Confirmation */}
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
            <AlertDialogCancel className="h-8 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clone Template */}
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
              className="h-9 text-xs"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">
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
              className="h-8 text-xs"
            >
              {cloneOrgTemplate.isPending ? "Cloning…" : "Clone"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Org Template */}
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
            <AlertDialogCancel className="h-8 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplateConfirm}
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
