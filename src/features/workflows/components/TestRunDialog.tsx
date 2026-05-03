// src/features/workflows/components/TestRunDialog.tsx

import { useState, useCallback } from "react";
import {
  Play,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  SkipForward,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useTriggerWorkflow,
  useTestWorkflow,
  useWorkflowRun,
} from "@/hooks/workflows";
import { useAuth } from "@/contexts/AuthContext";
import type { Workflow, WorkflowRun } from "@/types/workflow.types";

interface TestRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: Workflow;
}

type DialogPhase = "config" | "running" | "results";

/** Map action type to a human-readable label */
function actionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    send_email: "Send Email",
    create_notification: "Create Notification",
    update_field: "Update Field",
    create_task: "Create Task",
    webhook: "Webhook",
    wait: "Wait",
    branch: "Branch",
    assignuser: "Assign User",
    ai_decision: "AI Decision",
  };
  return labels[type] || type;
}

/** Format milliseconds to a readable duration */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export default function TestRunDialog({
  open,
  onOpenChange,
  workflow,
}: TestRunDialogProps) {
  const { user } = useAuth();
  const triggerWorkflow = useTriggerWorkflow();
  const testWorkflow = useTestWorkflow();

  const [recipientEmail, setRecipientEmail] = useState(user?.email || "");
  const [isDryRun, setIsDryRun] = useState(false);
  const [phase, setPhase] = useState<DialogPhase>("config");
  const [activeRunId, setActiveRunId] = useState<string>("");
  const [mutationError, setMutationError] = useState<string>("");

  // Poll the run while it's in progress
  const isActivePhase = phase === "running";
  const { data: runData } = useWorkflowRun(activeRunId, {
    refetchInterval: isActivePhase && activeRunId ? 2000 : false,
  });

  // Transition to results once the run completes
  if (
    phase === "running" &&
    runData &&
    (runData.status === "completed" ||
      runData.status === "failed" ||
      runData.status === "cancelled")
  ) {
    setPhase("results");
  }

  const handleRun = useCallback(async () => {
    setMutationError("");

    try {
      const userName = [user?.first_name, user?.last_name]
        .filter(Boolean)
        .join(" ");
      const context: Record<string, unknown> = {
        recipientEmail,
        recipientId: user?.id,
        recipientName: userName || user?.email,
        workflowId: workflow.id,
      };

      let run: WorkflowRun;

      if (isDryRun) {
        run = await testWorkflow.mutateAsync({
          workflowId: workflow.id,
          testContext: {
            ...context,
            isTest: true,
            testMode: true,
          },
        });
      } else {
        run = await triggerWorkflow.mutateAsync({
          workflowId: workflow.id,
          context,
          skipLimits: true,
        });
      }

      setActiveRunId(run.id);
      setPhase("running");
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "Failed to run workflow",
      );
    }
  }, [
    user,
    recipientEmail,
    isDryRun,
    workflow.id,
    testWorkflow,
    triggerWorkflow,
  ]);

  const handleClose = () => {
    setPhase("config");
    setActiveRunId("");
    setMutationError("");
    onOpenChange(false);
  };

  /** Render the action status icon */
  const renderActionStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-3 w-3 text-success shrink-0" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-destructive shrink-0" />;
      case "skipped":
        return (
          <SkipForward className="h-3 w-3 text-muted-foreground dark:text-muted-foreground shrink-0" />
        );
      default:
        return (
          <Clock className="h-3 w-3 text-muted-foreground dark:text-muted-foreground shrink-0" />
        );
    }
  };

  /** Render the results panel showing run outcome */
  const renderResults = (run: WorkflowRun) => {
    const isComplete = run.status === "completed";
    const isFailed = run.status === "failed";

    return (
      <div className="space-y-2">
        {/* Run Status Header */}
        <div
          className={`rounded-md p-2 flex items-center gap-1.5 text-[11px] ${
            isComplete
              ? "bg-success/10 text-success"
              : isFailed
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/10 text-warning"
          }`}
        >
          {isComplete ? (
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          ) : isFailed ? (
            <XCircle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="font-medium">
            {isComplete
              ? isDryRun
                ? "Dry run completed"
                : "Workflow completed"
              : isFailed
                ? "Workflow failed"
                : "Workflow cancelled"}
          </span>
          {run.durationMs != null && (
            <span className="ml-auto text-[10px] opacity-75">
              {formatDuration(run.durationMs)}
            </span>
          )}
        </div>

        {/* Error Message */}
        {run.errorMessage && (
          <div className="rounded-md p-2 bg-destructive/10 text-[10px] text-destructive">
            {run.errorMessage}
          </div>
        )}

        {/* Actions Executed */}
        {run.actionsExecuted && run.actionsExecuted.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wide">
              Actions
            </p>
            <div className="rounded-md border border-border dark:border-border divide-y divide-border dark:divide-border">
              {run.actionsExecuted.map((action, idx) => {
                // Match the executed action to the workflow definition for context
                const workflowAction = workflow.actions[idx];
                const actionType = workflowAction?.type || "unknown";

                return (
                  <div
                    key={action.actionId || idx}
                    className="p-1.5 flex items-start gap-1.5"
                  >
                    {renderActionStatusIcon(action.status)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium text-foreground dark:text-muted-foreground">
                          {actionTypeLabel(actionType)}
                        </span>
                        <span
                          className={`text-[9px] px-1 rounded ${
                            action.status === "success"
                              ? "bg-success/20 dark:bg-success/30 text-success"
                              : action.status === "failed"
                                ? "bg-destructive/20 dark:bg-destructive/30 text-destructive"
                                : "bg-card-tinted dark:bg-card-tinted text-muted-foreground dark:text-muted-foreground"
                          }`}
                        >
                          {action.status}
                        </span>
                      </div>

                      {/* Email-specific details */}
                      {actionType === "send_email" && action.result && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground dark:text-muted-foreground">
                          <Mail className="h-2.5 w-2.5" />
                          <span>
                            {action.result.recipientEmail ||
                              action.result.to ||
                              "Email sent"}
                          </span>
                        </div>
                      )}

                      {/* Error details */}
                      {action.error && (
                        <p className="text-[10px] text-destructive mt-0.5">
                          {action.error}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="rounded-md bg-background dark:bg-card-tinted/50 p-2 grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Completed
            </p>
            <p className="text-xs font-medium text-foreground dark:text-muted-foreground">
              {run.actionsCompleted ?? 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Failed
            </p>
            <p className="text-xs font-medium text-foreground dark:text-muted-foreground">
              {run.actionsFailed ?? 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Emails
            </p>
            <p className="text-xs font-medium text-foreground dark:text-muted-foreground">
              {run.emailsSent ?? 0}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-3 bg-card border-border dark:border-border">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
            <TestTube className="h-3.5 w-3.5" />
            Run Workflow: {workflow.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Phase: Config — show form inputs */}
          {phase === "config" && (
            <>
              {/* Recipient Email */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                  Recipient Email
                </Label>
                <Input
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="h-7 text-xs"
                  type="email"
                />
                <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                  Who should receive emails from this workflow run
                </p>
              </div>

              {/* Dry Run Toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    Dry Run (Test Mode)
                  </Label>
                  <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                    Simulate without sending real emails
                  </p>
                </div>
                <Switch
                  checked={isDryRun}
                  onCheckedChange={setIsDryRun}
                  className="scale-75"
                />
              </div>

              {/* Workflow Info */}
              <div className="rounded-md bg-background dark:bg-card-tinted/50 p-2 space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground dark:text-muted-foreground">
                    Trigger
                  </span>
                  <span className="text-foreground dark:text-muted-foreground">
                    {workflow.triggerType}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground dark:text-muted-foreground">
                    Actions
                  </span>
                  <span className="text-foreground dark:text-muted-foreground">
                    {workflow.actions.length}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground dark:text-muted-foreground">
                    Status
                  </span>
                  <span className="text-foreground dark:text-muted-foreground">
                    {workflow.status}
                  </span>
                </div>
              </div>

              {/* Mutation Error */}
              {mutationError && (
                <div className="rounded-md p-2 text-[11px] flex items-start gap-1.5 bg-destructive/10 text-destructive">
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{mutationError}</span>
                </div>
              )}
            </>
          )}

          {/* Phase: Running — show spinner */}
          {phase === "running" && (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                {isDryRun
                  ? "Running dry run simulation..."
                  : "Executing workflow..."}
              </p>
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Waiting for results
              </p>
            </div>
          )}

          {/* Phase: Results — show outcomes */}
          {phase === "results" && runData && renderResults(runData)}
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px]"
            onClick={handleClose}
          >
            {phase === "results" ? "Close" : "Cancel"}
          </Button>
          {phase === "config" && (
            <Button
              size="sm"
              className="h-6 text-[10px]"
              onClick={handleRun}
              disabled={
                triggerWorkflow.isPending ||
                testWorkflow.isPending ||
                !recipientEmail.trim()
              }
            >
              {triggerWorkflow.isPending || testWorkflow.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  {isDryRun ? "Dry Run" : "Run Now"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
