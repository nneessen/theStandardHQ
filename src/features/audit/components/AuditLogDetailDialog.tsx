/**
 * Audit Log Detail Dialog
 * Phase 11: Audit Trail & Activity Logs
 * Shows full audit log details with old/new data diff
 */

import { useAuditLogDetail } from "@/hooks/audit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
// eslint-disable-next-line no-restricted-imports
import { ACTION_COLORS } from "@/services/audit";
import {
  formatActionType,
  formatTableName,
  formatAction,
  formatDateTime,
  formatPerformer,
  formatSnakeCase,
} from "../utils/auditFormatters";
import type { Json } from "@/types/database.types";

interface AuditLogDetailDialogProps {
  auditId: string | null;
  onClose: () => void;
}

/**
 * Render JSON data as formatted key-value pairs
 */
function JsonDataView({
  data,
  title,
  changedFields,
  isOld = false,
}: {
  data: Json | null;
  title: string;
  changedFields?: string[] | null;
  isOld?: boolean;
}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return (
      <div className="space-y-2">
        <h4 className="text-[11px] font-medium text-v2-ink-muted">{title}</h4>
        <p className="text-xs text-v2-ink-subtle italic">No data</p>
      </div>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>).filter(
    ([key]) =>
      // Filter out internal fields
      !["id", "created_at", "updated_at", "imo_id", "agency_id"].includes(key),
  );

  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-[11px] font-medium text-v2-ink-muted">{title}</h4>
        <p className="text-xs text-v2-ink-subtle italic">No data</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-medium text-v2-ink-muted">{title}</h4>
      <div className="space-y-1">
        {entries.map(([key, value]) => {
          const isChanged = changedFields?.includes(key);
          const highlightClass = isChanged
            ? isOld
              ? "bg-red-50 dark:bg-red-950/30"
              : "bg-green-50 dark:bg-green-950/30"
            : "";

          return (
            <div
              key={key}
              className={`flex items-start gap-2 px-2 py-1 rounded ${highlightClass}`}
            >
              <span className="text-[10px] text-v2-ink-muted font-medium min-w-[120px]">
                {formatSnakeCase(key)}:
              </span>
              <span className="text-[11px] text-v2-ink-muted break-all">
                {formatValue(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    // Format currency if it looks like money
    if (Number.isFinite(value) && Math.abs(value) >= 1) {
      return value.toLocaleString("en-US", {
        minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
        maximumFractionDigits: 2,
      });
    }
    return String(value);
  }
  if (typeof value === "string") {
    // Format dates
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return new Date(value).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return value;
      }
    }
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function AuditLogDetailDialog({
  auditId,
  onClose,
}: AuditLogDetailDialogProps) {
  const { data: log, isLoading } = useAuditLogDetail(auditId);

  return (
    <Dialog open={!!auditId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-base">Audit Log Details</DialogTitle>
          <DialogDescription className="text-xs">
            View the complete details of this audit entry
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !log ? (
          <div className="py-8 text-center">
            <p className="text-sm text-v2-ink-muted">Audit log not found</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                    Table
                  </p>
                  <p className="text-sm font-medium text-v2-ink">
                    {formatTableName(log.tableName)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                    Action
                  </p>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${ACTION_COLORS[log.action]}`}
                  >
                    {formatAction(log.action)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                    Action Type
                  </p>
                  <p className="text-sm text-v2-ink">
                    {formatActionType(log.actionType)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                    Performed By
                  </p>
                  <p className="text-sm text-v2-ink">
                    {formatPerformer(log.performedByName, log.performedByEmail)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                    Date & Time
                  </p>
                  <p className="text-sm text-v2-ink">
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                    Record ID
                  </p>
                  <p className="text-xs font-mono text-v2-ink-muted truncate">
                    {log.recordId}
                  </p>
                </div>
              </div>

              {/* Changed Fields */}
              {log.changedFields && log.changedFields.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                      Changed Fields
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {log.changedFields.map((field) => (
                        <Badge
                          key={field}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {formatSnakeCase(field)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Data Comparison */}
              {(log.oldData || log.newData) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {log.action !== "INSERT" && (
                      <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900">
                        <JsonDataView
                          data={log.oldData}
                          title="Previous Values"
                          changedFields={log.changedFields}
                          isOld
                        />
                      </div>
                    )}
                    {log.action !== "DELETE" && (
                      <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
                        <JsonDataView
                          data={log.newData}
                          title={
                            log.action === "INSERT"
                              ? "Created Values"
                              : "New Values"
                          }
                          changedFields={log.changedFields}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Description */}
              {log.description && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                      Description
                    </p>
                    <p className="text-sm text-v2-ink">{log.description}</p>
                  </div>
                </>
              )}

              {/* Source */}
              <Separator />
              <div className="flex items-center justify-between text-xs text-v2-ink-muted">
                <span>
                  Source:{" "}
                  {log.source === "trigger"
                    ? "Database Trigger"
                    : "Application"}
                </span>
                <span className="font-mono">{log.id}</span>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
