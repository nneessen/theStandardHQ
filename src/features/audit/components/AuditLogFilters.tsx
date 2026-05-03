/**
 * Audit Log Filters
 * Phase 11: Audit Trail & Activity Logs
 * Collapsible filter panel for audit logs
 */

import { useState } from "react";
import { Filter, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
// eslint-disable-next-line no-restricted-imports
import type {
  AuditFilters,
  AuditActionTypeOption,
  AuditTableOption,
  AuditPerformer,
  AuditAction,
} from "@/services/audit";
import {
  formatActionType,
  formatTableName,
  formatPerformer,
} from "../utils/auditFormatters";

interface AuditLogFiltersProps {
  filters: AuditFilters;
  onFiltersChange: (filters: AuditFilters) => void;
  actionTypes?: AuditActionTypeOption[];
  tables?: AuditTableOption[];
  performers?: AuditPerformer[];
  isLoading?: boolean;
}

export function AuditLogFilters({
  filters,
  onFiltersChange,
  actionTypes = [],
  tables = [],
  performers = [],
  isLoading = false,
}: AuditLogFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Count active filters
  const activeFilterCount = [
    filters.tableName,
    filters.action,
    filters.actionType,
    filters.performedBy,
    filters.startDate,
    filters.search,
  ].filter(Boolean).length;

  // Handle clear all filters
  const handleClearAll = () => {
    onFiltersChange({});
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            disabled={isLoading}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-[10px]"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="gap-1 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Clear All
          </Button>
        )}
      </div>

      <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="space-y-1.5 col-span-2 lg:col-span-1">
            <Label className="text-[11px] text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={filters.search || ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    search: e.target.value || undefined,
                  })
                }
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>

          {/* Table */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Table</Label>
            <Select
              value={filters.tableName || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  tableName: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All tables
                </SelectItem>
                {tables.map((t) => (
                  <SelectItem
                    key={t.tableName}
                    value={t.tableName}
                    className="text-xs"
                  >
                    {formatTableName(t.tableName)} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Action</Label>
            <Select
              value={filters.action || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  action: value === "all" ? undefined : (value as AuditAction),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All actions
                </SelectItem>
                <SelectItem value="INSERT" className="text-xs">
                  Created
                </SelectItem>
                <SelectItem value="UPDATE" className="text-xs">
                  Updated
                </SelectItem>
                <SelectItem value="DELETE" className="text-xs">
                  Deleted
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Action Type
            </Label>
            <Select
              value={filters.actionType || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  actionType: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All types
                </SelectItem>
                {actionTypes.map((at) => (
                  <SelectItem
                    key={at.actionType}
                    value={at.actionType}
                    className="text-xs"
                  >
                    {formatActionType(at.actionType)} ({at.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Performed By */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Performed By
            </Label>
            <Select
              value={filters.performedBy || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  performedBy: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All users
                </SelectItem>
                {performers.map((p) => (
                  <SelectItem
                    key={p.userId}
                    value={p.userId}
                    className="text-xs"
                  >
                    {formatPerformer(p.userName, p.userEmail)} ({p.actionCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-1.5 col-span-2 lg:col-span-1">
            <Label className="text-[11px] text-muted-foreground">
              Date Range
            </Label>
            <DateRangePicker
              value={{
                from: filters.startDate,
                to: filters.endDate,
              }}
              onChange={(range) =>
                onFiltersChange({
                  ...filters,
                  startDate: range?.from,
                  endDate: range?.to,
                })
              }
              className="h-8 text-xs"
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
