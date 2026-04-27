// src/features/training-modules/components/admin/BadgesManagementTab.tsx
import { useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useTrainingBadges,
  useCreateBadge,
  useUpdateBadge,
  useDeleteBadge,
} from "../../hooks/useTrainingGamification";
import {
  BADGE_TYPES,
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
} from "../../types/training-module.types";
import type {
  TrainingBadge,
  BadgeType,
  BadgeCriteria,
  CreateBadgeInput,
} from "../../types/training-module.types";

const BADGE_TYPE_LABELS: Record<BadgeType, string> = {
  category_mastery: "Category Mastery",
  milestone: "Milestone",
  streak: "Streak",
  special: "Special",
};

const CRITERIA_TYPE_OPTIONS: {
  value: BadgeCriteria["type"];
  label: string;
  badgeType: BadgeType;
}[] = [
  {
    value: "category_modules_complete",
    label: "Category Modules Complete",
    badgeType: "category_mastery",
  },
  {
    value: "quiz_avg_score",
    label: "Quiz Average Score",
    badgeType: "milestone",
  },
  { value: "total_xp", label: "Total XP", badgeType: "milestone" },
  {
    value: "module_complete",
    label: "Module Complete",
    badgeType: "milestone",
  },
  {
    value: "modules_completed_in_period",
    label: "Modules in Period",
    badgeType: "milestone",
  },
  {
    value: "lessons_completed",
    label: "Lessons Completed",
    badgeType: "milestone",
  },
  { value: "quizzes_passed", label: "Quizzes Passed", badgeType: "milestone" },
  { value: "streak_days", label: "Streak Days", badgeType: "streak" },
];

function getDefaultCriteria(
  criteriaType: BadgeCriteria["type"],
): BadgeCriteria {
  switch (criteriaType) {
    case "category_modules_complete":
      return {
        type: "category_modules_complete",
        category: "custom",
        min_count: 1,
      };
    case "quiz_avg_score":
      return { type: "quiz_avg_score", min_score: 80, min_attempts: 3 };
    case "streak_days":
      return { type: "streak_days", min_days: 7 };
    case "total_xp":
      return { type: "total_xp", min_xp: 1000 };
    case "module_complete":
      return { type: "module_complete", module_id: "" };
    case "modules_completed_in_period":
      return { type: "modules_completed_in_period", count: 3, period_days: 30 };
    case "lessons_completed":
      return { type: "lessons_completed", min_count: 10 };
    case "quizzes_passed":
      return { type: "quizzes_passed", min_count: 5 };
  }
}

interface BadgeFormState {
  name: string;
  description: string;
  icon: string;
  color: string;
  badge_type: BadgeType;
  criteria: BadgeCriteria;
  xp_reward: number;
  is_active: boolean;
  sort_order: number;
}

const DEFAULT_FORM: BadgeFormState = {
  name: "",
  description: "",
  icon: "trophy",
  color: "#71717a",
  badge_type: "milestone",
  criteria: { type: "total_xp", min_xp: 1000 },
  xp_reward: 0,
  is_active: true,
  sort_order: 0,
};

export function BadgesManagementTab() {
  const [search, setSearch] = useState("");
  const { data: badges = [], isLoading } = useTrainingBadges(true);
  const createBadge = useCreateBadge();
  const updateBadge = useUpdateBadge();
  const deleteBadge = useDeleteBadge();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<TrainingBadge | null>(null);
  const [form, setForm] = useState<BadgeFormState>(DEFAULT_FORM);

  const filteredBadges = search
    ? badges.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : badges;

  const openCreateDialog = () => {
    setEditingBadge(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (badge: TrainingBadge) => {
    setEditingBadge(badge);
    setForm({
      name: badge.name,
      description: badge.description || "",
      icon: badge.icon,
      color: badge.color,
      badge_type: badge.badge_type,
      criteria: badge.criteria,
      xp_reward: badge.xp_reward,
      is_active: badge.is_active,
      sort_order: badge.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const input: CreateBadgeInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      icon: form.icon,
      color: form.color,
      badge_type: form.badge_type,
      criteria: form.criteria,
      xp_reward: form.xp_reward,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    try {
      if (editingBadge) {
        await updateBadge.mutateAsync({ id: editingBadge.id, input });
      } else {
        await createBadge.mutateAsync(input);
      }
      setDialogOpen(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleToggleActive = (badge: TrainingBadge) => {
    updateBadge.mutate({
      id: badge.id,
      input: { is_active: !badge.is_active },
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this badge? This cannot be undone.")) {
      deleteBadge.mutate(id);
    }
  };

  const updateCriteriaField = (field: string, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      criteria: { ...prev.criteria, [field]: value } as BadgeCriteria,
    }));
  };

  const handleCriteriaTypeChange = (criteriaType: BadgeCriteria["type"]) => {
    setForm((prev) => ({
      ...prev,
      criteria: getDefaultCriteria(criteriaType),
    }));
  };

  const isPending = createBadge.isPending || updateBadge.isPending;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
          <Input
            placeholder="Search badges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={openCreateDialog}>
          <Plus className="h-3 w-3 mr-1" />
          Create Badge
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
        </div>
      ) : (
        <div className="border border-v2-ring dark:border-v2-ring rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-v2-canvas dark:bg-v2-card-tinted/50 border-b border-v2-ring dark:border-v2-ring">
                <th className="text-left px-3 py-2 font-medium text-v2-ink-muted">
                  Badge
                </th>
                <th className="text-left px-3 py-2 font-medium text-v2-ink-muted">
                  Type
                </th>
                <th className="text-center px-3 py-2 font-medium text-v2-ink-muted">
                  XP
                </th>
                <th className="text-center px-3 py-2 font-medium text-v2-ink-muted">
                  Status
                </th>
                <th className="text-center px-3 py-2 font-medium text-v2-ink-muted">
                  Order
                </th>
                <th className="text-right px-3 py-2 font-medium text-v2-ink-muted w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-v2-ring dark:divide-v2-ring">
              {filteredBadges.map((badge) => (
                <tr
                  key={badge.id}
                  className="hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: badge.color }}
                      >
                        {badge.icon.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <span className="font-medium text-v2-ink dark:text-v2-ink">
                          {badge.name}
                        </span>
                        {badge.description && (
                          <p className="text-[10px] text-v2-ink-subtle truncate max-w-xs">
                            {badge.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {BADGE_TYPE_LABELS[badge.badge_type]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center text-v2-ink-muted">
                    {badge.xp_reward}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge
                      variant={badge.is_active ? "default" : "secondary"}
                      className="text-[10px] px-1.5"
                    >
                      {badge.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center text-v2-ink-subtle">
                    {badge.sort_order}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => openEditDialog(badge)}>
                          <Pencil className="h-3 w-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(badge)}
                        >
                          {badge.is_active ? (
                            <>
                              <EyeOff className="h-3 w-3 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={() => handleDelete(badge.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filteredBadges.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-v2-ink-subtle"
                  >
                    {search
                      ? "No badges match your search"
                      : "No badges yet. Create your first badge."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingBadge ? "Edit Badge" : "Create Badge"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-v2-ink-muted">
                Name *
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Sales Guru"
                className="h-8 text-xs"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-v2-ink-muted">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
                className="w-full text-xs rounded-md border border-v2-ring dark:border-v2-ring-strong bg-v2-card p-2 resize-none"
                placeholder="Badge description..."
              />
            </div>

            {/* Badge Type + Criteria Type */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-v2-ink-muted">
                  Badge Type
                </label>
                <select
                  value={form.badge_type}
                  onChange={(e) => {
                    const bt = e.target.value as BadgeType;
                    setForm((f) => ({ ...f, badge_type: bt }));
                  }}
                  className="w-full h-8 text-xs border border-v2-ring dark:border-v2-ring-strong rounded-md px-2 bg-v2-card"
                >
                  {BADGE_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {BADGE_TYPE_LABELS[bt]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-v2-ink-muted">
                  Criteria Type
                </label>
                <select
                  value={form.criteria.type}
                  onChange={(e) =>
                    handleCriteriaTypeChange(
                      e.target.value as BadgeCriteria["type"],
                    )
                  }
                  className="w-full h-8 text-xs border border-v2-ring dark:border-v2-ring-strong rounded-md px-2 bg-v2-card"
                >
                  {CRITERIA_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Criteria Fields */}
            <CriteriaEditor
              criteria={form.criteria}
              onChange={(field, value) => updateCriteriaField(field, value)}
            />

            {/* Icon + Color */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-v2-ink-muted">
                  Icon Name
                </label>
                <Input
                  value={form.icon}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, icon: e.target.value }))
                  }
                  className="h-8 text-xs"
                  placeholder="e.g. trophy, star, award"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-v2-ink-muted">
                  Color
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, color: e.target.value }))
                    }
                    className="h-8 w-8 rounded border border-v2-ring dark:border-v2-ring-strong cursor-pointer"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, color: e.target.value }))
                    }
                    className="h-8 text-xs flex-1"
                    placeholder="#71717a"
                  />
                </div>
              </div>
            </div>

            {/* XP + Sort Order */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-v2-ink-muted">
                  XP Reward
                </label>
                <Input
                  type="number"
                  value={form.xp_reward}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      xp_reward: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-v2-ink-muted">
                  Sort Order
                </label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sort_order: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-v2-ink-muted">
                Active
              </label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_active: checked }))
                }
              />
            </div>

            {/* Preview */}
            <div className="border border-v2-ring dark:border-v2-ring-strong rounded-md p-2">
              <span className="text-[10px] text-v2-ink-subtle block mb-1">
                Preview
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: form.color }}
                >
                  {form.icon.charAt(0).toUpperCase()}
                </span>
                <div>
                  <span className="text-xs font-medium text-v2-ink dark:text-v2-ink">
                    {form.name || "Badge Name"}
                  </span>
                  {form.description && (
                    <p className="text-[10px] text-v2-ink-subtle">
                      {form.description}
                    </p>
                  )}
                </div>
                {form.xp_reward > 0 && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    +{form.xp_reward} XP
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={isPending || !form.name.trim()}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              {editingBadge ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Dynamic criteria editor based on criteria type
 */
function CriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: BadgeCriteria;
  onChange: (field: string, value: unknown) => void;
}) {
  switch (criteria.type) {
    case "category_modules_complete":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-v2-ink-muted">
              Category
            </label>
            <select
              value={criteria.category}
              onChange={(e) => onChange("category", e.target.value)}
              className="w-full h-8 text-xs border border-v2-ring dark:border-v2-ring-strong rounded-md px-2 bg-v2-card"
            >
              {MODULE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {MODULE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-v2-ink-muted">
              Min Modules
            </label>
            <Input
              type="number"
              min={1}
              value={criteria.min_count}
              onChange={(e) =>
                onChange("min_count", Number(e.target.value) || 1)
              }
              className="h-8 text-xs"
            />
          </div>
        </div>
      );
    case "quiz_avg_score":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-v2-ink-muted">
              Min Score (%)
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              value={criteria.min_score}
              onChange={(e) =>
                onChange("min_score", Number(e.target.value) || 0)
              }
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-v2-ink-muted">
              Min Attempts
            </label>
            <Input
              type="number"
              min={1}
              value={criteria.min_attempts}
              onChange={(e) =>
                onChange("min_attempts", Number(e.target.value) || 1)
              }
              className="h-8 text-xs"
            />
          </div>
        </div>
      );
    case "streak_days":
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-v2-ink-muted">
            Min Days
          </label>
          <Input
            type="number"
            min={1}
            value={criteria.min_days}
            onChange={(e) => onChange("min_days", Number(e.target.value) || 1)}
            className="h-8 text-xs w-32"
          />
        </div>
      );
    case "total_xp":
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-v2-ink-muted">
            Min XP
          </label>
          <Input
            type="number"
            min={1}
            value={criteria.min_xp}
            onChange={(e) => onChange("min_xp", Number(e.target.value) || 1)}
            className="h-8 text-xs w-32"
          />
        </div>
      );
    case "module_complete":
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-v2-ink-muted">
            Module ID
          </label>
          <Input
            value={criteria.module_id}
            onChange={(e) => onChange("module_id", e.target.value)}
            className="h-8 text-xs"
            placeholder="UUID of the module"
          />
        </div>
      );
    case "modules_completed_in_period":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-v2-ink-muted">
              Count
            </label>
            <Input
              type="number"
              min={1}
              value={criteria.count}
              onChange={(e) => onChange("count", Number(e.target.value) || 1)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-v2-ink-muted">
              Period (days)
            </label>
            <Input
              type="number"
              min={1}
              value={criteria.period_days}
              onChange={(e) =>
                onChange("period_days", Number(e.target.value) || 1)
              }
              className="h-8 text-xs"
            />
          </div>
        </div>
      );
    case "lessons_completed":
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-v2-ink-muted">
            Min Lessons
          </label>
          <Input
            type="number"
            min={1}
            value={criteria.min_count}
            onChange={(e) => onChange("min_count", Number(e.target.value) || 1)}
            className="h-8 text-xs w-32"
          />
        </div>
      );
    case "quizzes_passed":
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-v2-ink-muted">
            Min Quizzes
          </label>
          <Input
            type="number"
            min={1}
            value={criteria.min_count}
            onChange={(e) => onChange("min_count", Number(e.target.value) || 1)}
            className="h-8 text-xs w-32"
          />
        </div>
      );
    default:
      return null;
  }
}
