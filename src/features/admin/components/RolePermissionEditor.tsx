// src/features/admin/components/RolePermissionEditor.tsx
// Full-width permission management panel with grouped, searchable permissions

import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Shield,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
} from "lucide-react";
import type { Role, Permission } from "@/types/permissions.types";

// Category display configuration
const CATEGORY_CONFIG: Record<string, { label: string; description: string }> =
  {
    nav: { label: "Navigation", description: "Access to pages and features" },
    policies: {
      label: "Policies",
      description: "Policy management operations",
    },
    clients: { label: "Clients", description: "Client management operations" },
    commissions: {
      label: "Commissions",
      description: "Commission viewing and management",
    },
    commission_overrides: {
      label: "Commission Overrides",
      description: "Override commission rates",
    },
    expenses: { label: "Expenses", description: "Expense tracking operations" },
    recruiting: {
      label: "Recruiting",
      description: "Recruiting pipeline management",
    },
    carriers: {
      label: "Carriers",
      description: "Carrier and product management",
    },
    contracts: { label: "Contracts", description: "User contract management" },
    documents: { label: "Documents", description: "Document management" },
    roles: { label: "Roles", description: "Role assignment operations" },
    users: { label: "Users", description: "User management operations" },
  };

interface PermissionCategory {
  key: string;
  label: string;
  description: string;
  permissions: Permission[];
  selectedCount: number;
}

interface RolePermissionEditorProps {
  role: Role | null;
  allPermissions: Permission[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTogglePermission: (permission: Permission) => Promise<void>;
  isLoading?: boolean;
}

export function RolePermissionEditor({
  role,
  allPermissions,
  open,
  onOpenChange,
  onTogglePermission,
  isLoading = false,
}: RolePermissionEditorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [pendingPermissions, setPendingPermissions] = useState<Set<string>>(
    new Set(),
  );

  // Get current role's permission IDs
  const rolePermissionIds = useMemo(() => {
    return new Set(role?.permissions?.map((p) => p.id) || []);
  }, [role?.permissions]);

  // Group permissions by category prefix
  const categories = useMemo((): PermissionCategory[] => {
    const groups: Record<string, Permission[]> = {};

    allPermissions.forEach((permission) => {
      // Extract category from permission code (e.g., "nav.dashboard" -> "nav")
      const categoryKey = permission.code.split(".")[0];
      if (!groups[categoryKey]) {
        groups[categoryKey] = [];
      }
      groups[categoryKey].push(permission);
    });

    // Convert to array with metadata
    return Object.entries(groups)
      .map(([key, permissions]) => {
        const config = CATEGORY_CONFIG[key] || {
          label: key.charAt(0).toUpperCase() + key.slice(1),
          description: `${key} related permissions`,
        };
        return {
          key,
          label: config.label,
          description: config.description,
          permissions: permissions.sort((a, b) => a.code.localeCompare(b.code)),
          selectedCount: permissions.filter((p) => rolePermissionIds.has(p.id))
            .length,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allPermissions, rolePermissionIds]);

  // Filter categories and permissions by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();
    return categories
      .map((category) => ({
        ...category,
        permissions: category.permissions.filter(
          (p) =>
            p.code.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.permissions.length > 0);
  }, [categories, searchQuery]);

  // Total counts
  const totalPermissions = allPermissions.length;
  const selectedPermissions = rolePermissionIds.size;

  // Toggle category expansion
  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  };

  // Expand all categories (useful when searching)
  const expandAll = () => {
    setExpandedCategories(new Set(categories.map((c) => c.key)));
  };

  // Collapse all categories
  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Handle permission toggle with loading state
  const handleToggle = async (permission: Permission) => {
    if (pendingPermissions.has(permission.id)) return;

    setPendingPermissions((prev) => new Set(prev).add(permission.id));
    try {
      await onTogglePermission(permission);
    } finally {
      setPendingPermissions((prev) => {
        const next = new Set(prev);
        next.delete(permission.id);
        return next;
      });
    }
  };

  // Select/deselect all in category
  const handleCategoryToggle = async (
    category: PermissionCategory,
    select: boolean,
  ) => {
    const permissionsToToggle = category.permissions.filter((p) => {
      const isSelected = rolePermissionIds.has(p.id);
      return select ? !isSelected : isSelected;
    });

    for (const permission of permissionsToToggle) {
      await handleToggle(permission);
    }
  };

  // Auto-expand when searching
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      expandAll();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="xl"
        className="flex flex-col p-0 w-full sm:max-w-2xl"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-foreground" />
            <SheetTitle className="text-base">
              Manage Permissions: {role?.display_name}
            </SheetTitle>
          </div>
          <SheetDescription className="text-[11px]">
            {role?.is_system_role
              ? "This is a system role. You can modify its permissions."
              : "Configure which permissions this role has."}
          </SheetDescription>

          {/* Role stats */}
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Role:</span>
              <code className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                {role?.name}
              </code>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Permissions:</span>
              <Badge variant="secondary" className="h-5 text-[10px]">
                {selectedPermissions} / {totalPermissions}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        {/* Search and controls */}
        <div className="px-6 py-3 border-b border-border bg-background dark:bg-card-dark/50">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search permissions..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 h-8 text-[11px] bg-card"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px]"
                onClick={expandAll}
              >
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px]"
                onClick={collapseAll}
              >
                Collapse All
              </Button>
            </div>
          </div>
        </div>

        {/* Permission categories */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="space-y-2">
            {filteredCategories.map((category) => {
              const isExpanded = expandedCategories.has(category.key);
              const allSelected = category.permissions.every((p) =>
                rolePermissionIds.has(p.id),
              );
              const someSelected = category.permissions.some((p) =>
                rolePermissionIds.has(p.id),
              );

              return (
                <Collapsible
                  key={category.key}
                  open={isExpanded}
                  onOpenChange={() => toggleCategory(category.key)}
                >
                  <div className="border border-border rounded-lg overflow-hidden">
                    {/* Category header */}
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between px-3 py-2 bg-background cursor-pointer hover:bg-muted dark:hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium text-foreground">
                                {category.label}
                              </span>
                              <Badge
                                variant={
                                  allSelected
                                    ? "default"
                                    : someSelected
                                      ? "secondary"
                                      : "outline"
                                }
                                className="h-4 text-[9px] px-1.5"
                              >
                                {category.selectedCount}/
                                {category.permissions.length}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {category.description}
                            </p>
                          </div>
                        </div>

                        {/* Quick select/deselect buttons */}
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-success hover:text-success hover:bg-success/10 dark:hover:bg-success/20"
                            onClick={() => handleCategoryToggle(category, true)}
                            disabled={allSelected || isLoading}
                            title="Select all in category"
                          >
                            <Check className="h-3 w-3 mr-0.5" />
                            All
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              handleCategoryToggle(category, false)
                            }
                            disabled={!someSelected || isLoading}
                            title="Deselect all in category"
                          >
                            <X className="h-3 w-3 mr-0.5" />
                            None
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    {/* Permission list */}
                    <CollapsibleContent>
                      <div className="divide-y divide-border/60">
                        {category.permissions.map((permission) => {
                          const isChecked = rolePermissionIds.has(
                            permission.id,
                          );
                          const isPending = pendingPermissions.has(
                            permission.id,
                          );

                          return (
                            <div
                              key={permission.id}
                              className="flex items-start gap-3 px-3 py-2 hover:bg-background/30"
                            >
                              <div className="pt-0.5">
                                {isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                  <Checkbox
                                    id={permission.id}
                                    checked={isChecked}
                                    onCheckedChange={() =>
                                      handleToggle(permission)
                                    }
                                    disabled={isLoading}
                                  />
                                )}
                              </div>
                              <label
                                htmlFor={permission.id}
                                className="flex-1 cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <code className="text-[11px] font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {permission.code}
                                  </code>
                                  {isChecked && (
                                    <Check className="h-3 w-3 text-success" />
                                  )}
                                </div>
                                {permission.description && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {permission.description}
                                  </p>
                                )}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}

            {filteredCategories.length === 0 && (
              <div className="text-center py-8 text-[11px] text-muted-foreground">
                {searchQuery
                  ? `No permissions found matching "${searchQuery}"`
                  : "No permissions available"}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background dark:bg-card-dark/50">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground">
              {pendingPermissions.size > 0 ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving changes...
                </span>
              ) : (
                "Changes are saved automatically"
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
