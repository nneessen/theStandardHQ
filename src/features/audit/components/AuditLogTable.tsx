/**
 * Audit Log Table
 * Phase 11: Audit Trail & Activity Logs
 * Paginated table displaying audit log entries
 */

import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
// eslint-disable-next-line no-restricted-imports
import type { AuditLogListItem, AuditAction } from "@/services/audit";
// eslint-disable-next-line no-restricted-imports
import { ACTION_COLORS } from "@/services/audit";
import {
  formatActionType,
  formatTableName,
  formatAction,
  formatRelativeTime,
  formatChangedFields,
  formatPerformer,
} from "../utils/auditFormatters";

interface AuditLogTableProps {
  data: AuditLogListItem[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onSelectLog: (auditId: string) => void;
}

/**
 * Get icon component for action type
 */
function ActionIcon({ action }: { action: AuditAction }) {
  const iconClass = "h-3.5 w-3.5";
  switch (action) {
    case "INSERT":
      return <Plus className={iconClass} />;
    case "UPDATE":
      return <Pencil className={iconClass} />;
    case "DELETE":
      return <Trash2 className={iconClass} />;
    default:
      return null;
  }
}

/**
 * Loading skeleton for table rows
 */
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-6" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AuditLogTable({
  data,
  isLoading,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onSelectLog,
}: AuditLogTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="rounded-lg overflow-hidden border border-v2-ring">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px] text-[11px] font-medium">
                Time
              </TableHead>
              <TableHead className="w-[100px] text-[11px] font-medium">
                Table
              </TableHead>
              <TableHead className="w-[100px] text-[11px] font-medium">
                Action
              </TableHead>
              <TableHead className="text-[11px] font-medium">
                Action Type
              </TableHead>
              <TableHead className="text-[11px] font-medium">
                Changed Fields
              </TableHead>
              <TableHead className="text-[11px] font-medium">
                Performed By
              </TableHead>
              <TableHead className="w-[40px] text-[11px] font-medium"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <p className="text-sm text-v2-ink-muted">
                    No audit logs found
                  </p>
                  <p className="text-xs text-v2-ink-subtle mt-1">
                    Try adjusting your filters
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              data.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-v2-canvas border-b border-v2-ring/60"
                  onClick={() => onSelectLog(log.id)}
                >
                  <TableCell className="text-[11px] text-v2-ink-muted tabular-nums">
                    {formatRelativeTime(log.createdAt)}
                  </TableCell>
                  <TableCell className="text-[11px]">
                    {formatTableName(log.tableName)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`gap-1 text-[10px] font-normal ${ACTION_COLORS[log.action]}`}
                    >
                      <ActionIcon action={log.action} />
                      {formatAction(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px]">
                    {formatActionType(log.actionType)}
                  </TableCell>
                  <TableCell className="text-[11px] text-v2-ink-muted max-w-[200px] truncate">
                    {formatChangedFields(log.changedFields)}
                  </TableCell>
                  <TableCell className="text-[11px]">
                    {formatPerformer(log.performedByName, log.performedByEmail)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLog(log.id);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between text-xs">
          <p className="text-v2-ink-muted tabular-nums">
            Showing {startIndex}–{endIndex} of {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-v2-ink-muted dark:text-v2-ink-subtle tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
