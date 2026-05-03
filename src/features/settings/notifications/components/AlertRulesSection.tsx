/**
 * Alert Rules Section
 *
 * UI for managing configurable alert rules.
 */

import { useState } from "react";
import { format } from "date-fns";
import {
  Loader2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  History,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useAlertRules,
  useToggleAlertRule,
  useDeleteAlertRule,
} from "@/hooks/alerts";
import {
  METRIC_LABELS,
  COMPARISON_SYMBOLS,
  UNIT_LABELS,
  type AlertRule,
} from "@/types/alert-rules.types";
import { AlertRuleDialog } from "./AlertRuleDialog";
import { AlertRuleHistoryDialog } from "./AlertRuleHistoryDialog";

export function AlertRulesSection() {
  const { data: rules, isLoading } = useAlertRules();
  const toggleRule = useToggleAlertRule();
  const deleteRule = useDeleteAlertRule();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [historyRule, setHistoryRule] = useState<AlertRule | null>(null);
  const [deleteConfirmRule, setDeleteConfirmRule] = useState<AlertRule | null>(
    null,
  );

  const handleToggleActive = async (rule: AlertRule) => {
    try {
      await toggleRule.mutateAsync({
        ruleId: rule.id,
        isActive: !rule.is_active,
      });
      toast.success(
        rule.is_active ? "Alert rule disabled" : "Alert rule enabled",
      );
    } catch {
      toast.error("Failed to update alert rule");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmRule) return;

    try {
      await deleteRule.mutateAsync(deleteConfirmRule.id);
      toast.success("Alert rule deleted");
      setDeleteConfirmRule(null);
    } catch {
      toast.error("Failed to delete alert rule");
    }
  };

  const formatThreshold = (rule: AlertRule) => {
    const symbol = COMPARISON_SYMBOLS[rule.comparison];
    const unit = rule.threshold_unit
      ? UNIT_LABELS[rule.threshold_unit] || rule.threshold_unit
      : "";

    if (unit === "$") {
      return `${symbol} $${rule.threshold_value.toLocaleString()}`;
    }
    if (unit === "%") {
      return `${symbol} ${rule.threshold_value}%`;
    }
    return `${symbol} ${rule.threshold_value} ${unit}`.trim();
  };

  const getScopeLabel = (rule: AlertRule) => {
    const scopes: string[] = [];
    if (rule.applies_to_self) scopes.push("Self");
    if (rule.applies_to_downlines) scopes.push("Downlines");
    if (rule.applies_to_team) scopes.push("Team");
    return scopes.join(", ");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[11px] font-semibold text-foreground">
            Custom Alert Rules
          </h4>
          <p className="text-[10px] text-muted-foreground">
            Set up alerts for business metrics that matter to you
          </p>
        </div>
        <Button
          size="sm"
          className="h-7 text-[10px] gap-1"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-3 w-3" />
          New Alert Rule
        </Button>
      </div>

      {/* Rules List */}
      {!rules || rules.length === 0 ? (
        <div className="border border-border rounded-lg p-6">
          <div className="flex flex-col items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-[11px] font-medium text-foreground">
              No alert rules configured
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">
              Create rules to get notified about important changes
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={() => setCreateDialogOpen(true)}
            >
              Create your first rule
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`border border-border rounded-lg ${!rule.is_active ? "opacity-60" : ""}`}
            >
              <div className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-foreground truncate">
                        {rule.name}
                      </span>
                      <Badge
                        variant={rule.is_active ? "default" : "secondary"}
                        className="text-[9px] h-4 px-1"
                      >
                        {rule.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {METRIC_LABELS[rule.metric]} {formatThreshold(rule)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule)}
                      disabled={toggleRule.isPending}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditingRule(rule)}
                          className="text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setHistoryRule(rule)}
                          className="text-xs"
                        >
                          <History className="h-3.5 w-3.5 mr-2" />
                          View History
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(rule)}
                          className="text-xs"
                        >
                          {rule.is_active ? (
                            <>
                              <PowerOff className="h-3.5 w-3.5 mr-2" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Power className="h-3.5 w-3.5 mr-2" />
                              Enable
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-xs text-destructive"
                          onClick={() => setDeleteConfirmRule(rule)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <div className="px-3 py-2 border-t border-border/60 bg-background rounded-b-lg">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                  <span>Scope: {getScopeLabel(rule)}</span>
                  <span>
                    Notify:{" "}
                    {[
                      rule.notify_in_app && "In-app",
                      rule.notify_email && "Email",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                  <span>Cooldown: {rule.cooldown_hours}h</span>
                  {rule.trigger_count > 0 && (
                    <span>Triggered: {rule.trigger_count} times</span>
                  )}
                  {rule.last_triggered_at && (
                    <span>
                      Last:{" "}
                      {format(
                        new Date(rule.last_triggered_at),
                        "MMM d, h:mm a",
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <AlertRuleDialog
        open={createDialogOpen || !!editingRule}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingRule(null);
          }
        }}
        editRule={editingRule}
      />

      {/* History Dialog */}
      <AlertRuleHistoryDialog
        open={!!historyRule}
        onOpenChange={(open) => !open && setHistoryRule(null)}
        rule={historyRule}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmRule}
        onOpenChange={(open) => !open && setDeleteConfirmRule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmRule?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRule.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
