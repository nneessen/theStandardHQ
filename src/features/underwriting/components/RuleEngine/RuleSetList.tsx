// src/features/underwriting/components/RuleEngine/RuleSetList.tsx
// Table view of rule sets for a carrier

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type { RuleSetWithRules } from "@/services/underwriting/repositories/ruleService";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Types
// ============================================================================

interface RuleSetListProps {
  ruleSets: RuleSetWithRules[];
  isLoading?: boolean;
  onSelect: (ruleSet: RuleSetWithRules) => void;
  onCreate: () => void;
  onDelete: (ruleSetId: string) => void;
  onToggleActive: (ruleSetId: string, isActive: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function RuleSetList({
  ruleSets,
  isLoading,
  onSelect,
  onCreate,
  onDelete,
  onToggleActive,
}: RuleSetListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      onDelete(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          {ruleSets.length} rule set{ruleSets.length !== 1 ? "s" : ""}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onCreate}
          className="h-6 px-2 text-[10px]"
        >
          <Plus className="h-3 w-3 mr-1" />
          Create Rule Set
        </Button>
      </div>

      {/* Table */}
      {ruleSets.length === 0 ? (
        <div className="text-center py-8 text-[11px] text-v2-ink-subtle bg-v2-canvas dark:bg-v2-card/50 rounded-lg">
          No rule sets yet. Create your first rule set to define acceptance
          criteria.
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden bg-v2-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-v2-canvas dark:bg-v2-card-tinted/50 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50">
                <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted dark:text-v2-ink-subtle">
                  Name
                </TableHead>
                <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted dark:text-v2-ink-subtle">
                  Scope
                </TableHead>
                <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted dark:text-v2-ink-subtle">
                  Condition
                </TableHead>
                <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted dark:text-v2-ink-subtle">
                  Rules
                </TableHead>
                <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted dark:text-v2-ink-subtle">
                  Active
                </TableHead>
                <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted dark:text-v2-ink-subtle">
                  Updated
                </TableHead>
                <TableHead className="w-10 h-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ruleSets.map((rs) => (
                <TableRow
                  key={rs.id}
                  className="cursor-pointer hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30"
                  onClick={() => onSelect(rs)}
                >
                  <TableCell className="py-2">
                    <div className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                      {rs.name}
                    </div>
                    {rs.description && (
                      <div className="text-[10px] text-v2-ink-subtle truncate max-w-48">
                        {rs.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant={rs.scope === "global" ? "info" : "secondary"}
                      className="text-[9px] h-4"
                    >
                      {rs.scope}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    {rs.condition_code ? (
                      <span className="capitalize">
                        {rs.condition_code.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-v2-ink-subtle">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle font-mono">
                    {rs.rules?.length || 0}
                  </TableCell>
                  <TableCell
                    className="py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={rs.is_active ?? false}
                      onCheckedChange={(checked) =>
                        onToggleActive(rs.id, checked)
                      }
                      className="h-4 w-7"
                    />
                  </TableCell>
                  <TableCell className="py-2 text-[10px] text-v2-ink-subtle">
                    {rs.updated_at
                      ? formatDistanceToNow(new Date(rs.updated_at), {
                          addSuffix: true,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell
                    className="py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          onClick={() => onSelect(rs)}
                          className="text-[11px]"
                        >
                          <Pencil className="h-3 w-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm(rs.id)}
                          className="text-[11px] text-red-600"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent className="max-w-md p-3">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="text-sm font-semibold">
              Delete Rule Set
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              Are you sure you want to delete this rule set? This will also
              delete all rules within it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1">
            <AlertDialogCancel className="h-6 text-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="h-6 text-[10px] bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
