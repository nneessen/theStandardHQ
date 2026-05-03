// src/features/messages/components/instagram/templates/CategoryManager.tsx
// Sidebar component for managing custom template categories

import { useState, type ReactNode } from "react";
import { Plus, Edit2, Trash2, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  useInstagramTemplateCategories,
  useCreateTemplateCategory,
  useUpdateTemplateCategory,
  useDeleteTemplateCategory,
} from "@/hooks";
import {
  PROSPECT_TYPE_LABELS,
  BUILT_IN_PROSPECT_TYPES,
  createCustomCategoryValue,
} from "@/types/instagram.types";
import type { InstagramTemplateCategory } from "@/types/instagram.types";

interface CategoryManagerProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  canEdit: boolean;
}

export function CategoryManager({
  selectedCategory,
  onSelectCategory,
  canEdit,
}: CategoryManagerProps): ReactNode {
  const [builtInOpen, setBuiltInOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<InstagramTemplateCategory | null>(null);
  const [deleteCategory, setDeleteCategory] =
    useState<InstagramTemplateCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const { data: customCategories = [], isLoading } =
    useInstagramTemplateCategories();
  const createMutation = useCreateTemplateCategory();
  const updateMutation = useUpdateTemplateCategory();
  const deleteMutation = useDeleteTemplateCategory();

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setCategoryName("");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (category: InstagramTemplateCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setCategoryName("");
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({
          categoryId: editingCategory.id,
          updates: { name: categoryName.trim() },
        });
        toast.success("Category updated");
      } else {
        await createMutation.mutateAsync({
          name: categoryName.trim(),
          display_order: customCategories.length,
        });
        toast.success("Category created");
      }
      handleCloseForm();
    } catch (_error) {
      toast.error(
        editingCategory
          ? "Failed to update category"
          : "Failed to create category",
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteCategory) return;

    try {
      await deleteMutation.mutateAsync(deleteCategory.id);
      toast.success("Category deleted");
      setDeleteCategory(null);
    } catch (_error) {
      toast.error("Failed to delete category");
    }
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-border">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Categories
        </h3>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-2">
        {/* All Categories - Filter Reset */}
        <button
          type="button"
          onClick={() => onSelectCategory("all")}
          className={cn(
            "w-full px-2 py-1.5 text-[11px] text-left rounded-sm transition-colors",
            selectedCategory === "all"
              ? "bg-info/20 dark:bg-info/15 text-info font-medium"
              : "text-muted-foreground dark:text-muted-foreground hover:bg-background",
          )}
        >
          All Categories
        </button>

        {/* Built-in Categories */}
        <Collapsible open={builtInOpen} onOpenChange={setBuiltInOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 w-full px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground">
            <span className="flex-1 text-left">Built-in</span>
            <Lock className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-0.5">
            {BUILT_IN_PROSPECT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onSelectCategory(type)}
                className={cn(
                  "w-full px-2 py-1.5 text-[11px] text-left rounded-sm transition-colors",
                  selectedCategory === type
                    ? "bg-info/20 dark:bg-info/15 text-info font-medium"
                    : "text-muted-foreground dark:text-muted-foreground hover:bg-background",
                )}
              >
                {PROSPECT_TYPE_LABELS[type]}
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Custom Categories */}
        <Collapsible open={customOpen} onOpenChange={setCustomOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 w-full px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground">
            <span className="flex-1 text-left">Custom</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-0.5">
            {customCategories.length === 0 && !isLoading && (
              <p className="px-2 py-1 text-[10px] text-muted-foreground italic">
                No custom categories
              </p>
            )}
            {customCategories.map((category) => {
              const categoryValue = createCustomCategoryValue(category.id);
              return (
                <div
                  key={category.id}
                  className={cn(
                    "group flex items-center px-2 py-1.5 text-[11px] rounded-sm transition-colors",
                    selectedCategory === categoryValue
                      ? "bg-info/20 dark:bg-info/15 text-info font-medium"
                      : "text-muted-foreground dark:text-muted-foreground hover:bg-background",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectCategory(categoryValue)}
                    className="flex-1 truncate text-left"
                  >
                    {category.name}
                  </button>
                  {canEdit && (
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(category);
                        }}
                        title="Edit category"
                      >
                        <Edit2 className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteCategory(category);
                        }}
                        title="Delete category"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add New Button - Super Admin Only */}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-7 text-[11px] text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-muted-foreground"
                onClick={handleOpenCreate}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Category
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Category Form Sheet */}
      <Sheet open={isFormOpen} onOpenChange={handleCloseForm}>
        <SheetContent className="w-[320px]">
          <SheetHeader>
            <SheetTitle className="text-[13px]">
              {editingCategory ? "Edit Category" : "New Category"}
            </SheetTitle>
            <SheetDescription className="text-[11px]">
              {editingCategory
                ? "Update your custom category"
                : "Create a new custom prospect type category"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-medium">Category Name</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., Real Estate Agent"
                className="h-8 text-[11px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseForm}
              disabled={isPending}
              className="h-8 text-[11px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !categoryName.trim()}
              className="h-8 text-[11px]"
            >
              {isPending && (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              )}
              {editingCategory ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteCategory}
        onOpenChange={() => setDeleteCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[13px]">
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              Are you sure you want to delete &quot;{deleteCategory?.name}
              &quot;? Templates using this category will be updated to
              &quot;Uncategorized&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteCategory(null)}
              disabled={deleteMutation.isPending}
              className="h-8 text-[11px]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="h-8 text-[11px] bg-destructive hover:bg-destructive focus:ring-destructive"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
