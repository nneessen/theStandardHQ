// src/features/reports/components/ScheduledReportsManager.tsx
// Panel for viewing and managing scheduled report deliveries
// Phase 9: Report Export Enhancement

import React, { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { cn } from "../../../lib/utils";
import {
  Calendar,
  Clock,
  MoreVertical,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  useMyScheduledReports,
  useToggleScheduleActive,
  useDeleteScheduledReport,
  useScheduleDeliveryHistory,
} from "../../../hooks/reports/scheduled";
import {
  ScheduledReportWithStats,
  ScheduleDelivery,
  SCHEDULABLE_REPORT_TYPES,
  getScheduleDescription,
} from "../../../types/scheduled-reports.types";
import { ReportScheduleDialog } from "./ReportScheduleDialog";

interface ScheduledReportsManagerProps {
  className?: string;
}

export function ScheduledReportsManager({
  className,
}: ScheduledReportsManagerProps) {
  const { data: schedules = [], isLoading, refetch } = useMyScheduledReports();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editSchedule, setEditSchedule] =
    useState<ScheduledReportWithStats | null>(null);
  const [deleteSchedule, setDeleteSchedule] =
    useState<ScheduledReportWithStats | null>(null);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);

  const toggleActive = useToggleScheduleActive();
  const deleteScheduleMutation = useDeleteScheduledReport();

  const handleDelete = async () => {
    if (deleteSchedule) {
      await deleteScheduleMutation.mutateAsync(deleteSchedule.id);
      setDeleteSchedule(null);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Scheduled Reports</h3>
          <p className="text-xs text-muted-foreground">
            Automated report delivery to your team
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center">
          <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No scheduled reports
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a schedule to automatically deliver reports to your team
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Create First Schedule
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              isExpanded={expandedSchedule === schedule.id}
              onToggleExpand={() =>
                setExpandedSchedule(
                  expandedSchedule === schedule.id ? null : schedule.id,
                )
              }
              onEdit={() => setEditSchedule(schedule)}
              onDelete={() => setDeleteSchedule(schedule)}
              onToggleActive={(active) =>
                toggleActive.mutate({
                  scheduleId: schedule.id,
                  isActive: active,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ReportScheduleDialog
        open={createDialogOpen || !!editSchedule}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditSchedule(null);
          }
        }}
        editSchedule={editSchedule}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteSchedule}
        onOpenChange={() => setDeleteSchedule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {deleteSchedule?.schedule_name}&quot;? This will stop all future
              deliveries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteScheduleMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Schedule Card Component
interface ScheduleCardProps {
  schedule: ScheduledReportWithStats;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
}

function ScheduleCard({
  schedule,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleActive,
}: ScheduleCardProps) {
  const reportType = SCHEDULABLE_REPORT_TYPES.find(
    (rt) => rt.type === schedule.report_type,
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div
        className={cn(
          "border rounded-lg transition-colors",
          schedule.is_active ? "bg-card" : "bg-muted/30",
        )}
      >
        {/* Main Row */}
        <div className="flex items-center gap-3 p-3">
          <CollapsibleTrigger asChild>
            <button className="p-1 hover:bg-muted rounded">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{reportType?.icon || "📊"}</span>
              <span className="font-medium text-sm truncate">
                {schedule.schedule_name}
              </span>
              {!schedule.is_active && (
                <Badge variant="secondary" className="text-[10px]">
                  Paused
                </Badge>
              )}
              {schedule.consecutive_failures > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {schedule.consecutive_failures} failures
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>{reportType?.name}</span>
              <span>•</span>
              <span>{getScheduleDescription(schedule)}</span>
              <span>•</span>
              <span>{schedule.recipients.length} recipients</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {schedule.is_active && (
              <div className="text-right text-xs">
                <div className="text-muted-foreground">Next delivery</div>
                <div className="font-medium">
                  {formatDistanceToNow(new Date(schedule.next_delivery), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onToggleActive(!schedule.is_active)}
                >
                  {schedule.is_active ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="border-t px-3 py-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {schedule.total_deliveries}
                </div>
                <div className="text-xs text-muted-foreground">Total Sent</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-success">
                  {schedule.successful_deliveries}
                </div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-destructive">
                  {schedule.failed_deliveries}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Recipients */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Recipients
              </div>
              <div className="flex flex-wrap gap-1">
                {schedule.recipients.map((r) => (
                  <span
                    key={r.user_id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                  >
                    <Mail className="w-3 h-3" />
                    {r.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Delivery History */}
            <DeliveryHistory scheduleId={schedule.id} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Delivery History Component
function DeliveryHistory({ scheduleId }: { scheduleId: string }) {
  const { data: deliveries = [], isLoading } = useScheduleDeliveryHistory(
    scheduleId,
    5,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center p-4 text-sm text-muted-foreground">
        No deliveries yet
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        Recent Deliveries
      </div>
      <div className="space-y-1">
        {deliveries.map((delivery) => (
          <DeliveryRow key={delivery.id} delivery={delivery} />
        ))}
      </div>
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: ScheduleDelivery }) {
  const statusIcon = {
    sent: <CheckCircle className="w-4 h-4 text-success" />,
    failed: <XCircle className="w-4 h-4 text-destructive" />,
    processing: <Loader2 className="w-4 h-4 text-warning animate-spin" />,
    pending: <Clock className="w-4 h-4 text-muted-foreground" />,
  }[delivery.status];

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              delivery.status === "sent"
                ? "default"
                : delivery.status === "failed"
                  ? "destructive"
                  : "secondary"
            }
            className="text-[10px] capitalize"
          >
            {delivery.status}
          </Badge>
          <span className="text-muted-foreground">
            {delivery.report_period_start} to {delivery.report_period_end}
          </span>
        </div>
        {delivery.error_message && (
          <div className="text-destructive mt-0.5 truncate">
            {delivery.error_message}
          </div>
        )}
      </div>
      <div className="text-muted-foreground">
        {delivery.delivered_at
          ? format(new Date(delivery.delivered_at), "MMM d, h:mm a")
          : format(new Date(delivery.created_at), "MMM d, h:mm a")}
      </div>
    </div>
  );
}
