// src/features/messages/components/instagram/templates/CategoryManager.tsx
// Sidebar component for managing custom template categories

import { useState, type ReactNode } from "react";
import { Plus, Edit2, Trash2, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { T } from "@/components/board/tokens";

const MUT3 = "rgba(255,255,255,0.28)";

interface CategoryManagerProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  canEdit: boolean;
}

function GroupHeader({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "14px 10px 7px",
        font: `700 10px ${T.mono}`,
        letterSpacing: "0.18em",
        color: MUT3,
        textTransform: "uppercase",
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {icon}
    </div>
  );
}

function CategoryItem({
  label,
  active,
  onClick,
  actions,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  actions?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: 34,
        padding: "0 10px",
        borderRadius: 9,
        background: active
          ? "rgba(182,155,255,0.14)"
          : hover
            ? "rgba(255,255,255,0.05)"
            : "transparent",
        border: `1px solid ${active ? "rgba(182,155,255,0.30)" : "transparent"}`,
        cursor: "pointer",
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1,
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          font: `600 13px ${T.data}`,
          color: active ? T.ink : T.mut,
          cursor: "pointer",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {label}
      </button>
      {hover && actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexShrink: 0,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  onClick,
  title,
  color,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 22,
        height: 22,
        borderRadius: 5,
        background: "transparent",
        border: "none",
        color: color ?? T.mut2,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 12px 10px",
          borderBottom: `1px solid ${T.line}`,
        }}
      >
        <span
          style={{
            font: `700 10px ${T.mono}`,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MUT3,
          }}
        >
          Categories
        </span>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* All */}
        <CategoryItem
          label="All Categories"
          active={selectedCategory === "all"}
          onClick={() => onSelectCategory("all")}
        />

        {/* Built-in */}
        <Collapsible open={builtInOpen} onOpenChange={setBuiltInOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              style={{
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <GroupHeader
                label="Built-in"
                icon={<Lock style={{ width: 10, height: 10, color: MUT3 }} />}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {BUILT_IN_PROSPECT_TYPES.map((type) => (
                <CategoryItem
                  key={type}
                  label={PROSPECT_TYPE_LABELS[type]}
                  active={selectedCategory === type}
                  onClick={() => onSelectCategory(type)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Custom */}
        <Collapsible open={customOpen} onOpenChange={setCustomOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              style={{
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <GroupHeader
                label="Custom"
                icon={
                  isLoading ? (
                    <Loader2
                      style={{
                        width: 10,
                        height: 10,
                        color: MUT3,
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  ) : undefined
                }
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {customCategories.length === 0 && !isLoading && (
                <span
                  style={{
                    padding: "4px 10px",
                    font: `500 11px ${T.data}`,
                    color: T.mut2,
                    fontStyle: "italic",
                  }}
                >
                  No custom categories
                </span>
              )}
              {customCategories.map((category) => {
                const categoryValue = createCustomCategoryValue(category.id);
                return (
                  <CategoryItem
                    key={category.id}
                    label={category.name}
                    active={selectedCategory === categoryValue}
                    onClick={() => onSelectCategory(categoryValue)}
                    actions={
                      canEdit ? (
                        <>
                          <IconBtn
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(category);
                            }}
                            title="Edit category"
                          >
                            <Edit2 style={{ width: 10, height: 10 }} />
                          </IconBtn>
                          <IconBtn
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteCategory(category);
                            }}
                            title="Delete category"
                            color={T.red}
                          >
                            <Trash2 style={{ width: 10, height: 10 }} />
                          </IconBtn>
                        </>
                      ) : undefined
                    }
                  />
                );
              })}

              {canEdit && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    height: 30,
                    padding: "0 10px",
                    borderRadius: 8,
                    background: "transparent",
                    border: `1px dashed ${T.line2}`,
                    color: T.mut2,
                    font: `600 11px ${T.data}`,
                    cursor: "pointer",
                    width: "100%",
                    marginTop: 4,
                  }}
                >
                  <Plus style={{ width: 12, height: 12 }} />
                  Add Category
                </button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Category Form Sheet */}
      <Sheet open={isFormOpen} onOpenChange={handleCloseForm}>
        <SheetContent
          style={{
            width: 320,
            background: T.surface7,
            border: `1px solid ${T.line2}`,
            borderLeft: `1px solid ${T.line2}`,
            fontFamily: T.data,
            color: T.ink,
            padding: "24px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <SheetHeader>
            <SheetTitle
              style={{
                font: `800 15px ${T.disp}`,
                color: T.cream,
              }}
            >
              {editingCategory ? "Edit Category" : "New Category"}
            </SheetTitle>
            <SheetDescription
              style={{
                font: `500 12px/1.4 ${T.data}`,
                color: T.mut2,
                marginTop: 4,
              }}
            >
              {editingCategory
                ? "Update your custom category"
                : "Create a new custom prospect type category"}
            </SheetDescription>
          </SheetHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label
              style={{
                font: `700 10px ${T.mono}`,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: T.mut2,
              }}
            >
              Category Name
            </label>
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g., Real Estate Agent"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              style={{
                width: "100%",
                background: T.surface3,
                border: `1px solid ${T.line2}`,
                borderRadius: 8,
                padding: "0 12px",
                height: 36,
                font: `500 13px ${T.data}`,
                color: T.ink,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: "auto",
            }}
          >
            <button
              type="button"
              onClick={handleCloseForm}
              disabled={isPending}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 8,
                background: "transparent",
                border: `1px solid ${T.line2}`,
                color: T.mut,
                font: `600 12px ${T.data}`,
                cursor: "pointer",
                opacity: isPending ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !categoryName.trim()}
              style={{
                height: 34,
                padding: "0 16px",
                borderRadius: 8,
                background: T.violet,
                border: "none",
                color: "#1a0f33",
                font: `700 12px ${T.data}`,
                cursor:
                  isPending || !categoryName.trim() ? "not-allowed" : "pointer",
                opacity: isPending || !categoryName.trim() ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {isPending && (
                <Loader2
                  style={{
                    width: 13,
                    height: 13,
                    animation: "spin 1s linear infinite",
                  }}
                />
              )}
              {editingCategory ? "Save" : "Create"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteCategory}
        onOpenChange={() => setDeleteCategory(null)}
      >
        <AlertDialogContent
          style={{
            background: T.surface7,
            border: `1px solid ${T.line2}`,
            borderRadius: 14,
            fontFamily: T.data,
            color: T.ink,
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              style={{
                font: `800 15px ${T.disp}`,
                color: T.cream,
              }}
            >
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription
              style={{
                font: `500 13px/1.5 ${T.data}`,
                color: T.mut,
              }}
            >
              Are you sure you want to delete &quot;{deleteCategory?.name}
              &quot;? Templates using this category will be updated to
              &quot;Uncategorized&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteCategory(null)}
              disabled={deleteMutation.isPending}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                background: "transparent",
                border: `1px solid ${T.line2}`,
                color: T.mut,
                font: `600 12px ${T.data}`,
                cursor: "pointer",
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                background: T.red,
                border: "none",
                color: "#fff",
                font: `700 12px ${T.data}`,
                cursor: deleteMutation.isPending ? "not-allowed" : "pointer",
                opacity: deleteMutation.isPending ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {deleteMutation.isPending && (
                <Loader2
                  style={{
                    width: 13,
                    height: 13,
                    animation: "spin 1s linear infinite",
                  }}
                />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
