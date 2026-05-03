// src/features/training-modules/components/admin/ModuleBuilderPage.tsx
import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Save,
  Eye,
  Plus,
  Loader2,
  GripVertical,
  Settings,
  Trash2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useTrainingModule,
  useUpdateTrainingModule,
  usePublishTrainingModule,
} from "../../hooks/useTrainingModules";
import {
  useTrainingLessons,
  useCreateTrainingLesson,
  useDeleteTrainingLesson,
  useReorderTrainingLessons,
  useDuplicateTrainingLesson,
} from "../../hooks/useTrainingLessons";
import {
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
  DIFFICULTY_LEVELS,
} from "../../types/training-module.types";
import { LessonEditor } from "./LessonEditor";
import { useDebouncedField } from "../../hooks/useDebouncedField";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

interface ModuleBuilderPageProps {
  moduleId: string;
}

export default function ModuleBuilderPage({
  moduleId,
}: ModuleBuilderPageProps) {
  const navigate = useNavigate();
  const { data: module, isLoading: moduleLoading } =
    useTrainingModule(moduleId);
  const { data: lessons = [] } = useTrainingLessons(moduleId);
  const updateModule = useUpdateTrainingModule();
  const publishModule = usePublishTrainingModule();
  const createLesson = useCreateTrainingLesson();
  const deleteLesson = useDeleteTrainingLesson();
  const duplicateLesson = useDuplicateTrainingLesson();
  const reorderLessons = useReorderTrainingLessons();

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Debounced header title input
  const saveHeaderTitle = useCallback(
    (v: string) => updateModule.mutate({ id: moduleId, input: { title: v } }),
    [updateModule, moduleId],
  );
  const [headerTitle, setHeaderTitle] = useDebouncedField(
    module?.title ?? "",
    saveHeaderTitle,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = lessons.findIndex((l) => l.id === active.id);
      const newIndex = lessons.findIndex((l) => l.id === over.id);
      const reordered = arrayMove(lessons, oldIndex, newIndex);

      reorderLessons.mutate({
        lessonIds: reordered.map((l) => l.id),
        moduleId,
      });
    },
    [lessons, reorderLessons, moduleId],
  );

  const handleAddLesson = async () => {
    try {
      const newLesson = await createLesson.mutateAsync({
        module_id: moduleId,
        title: `Lesson ${lessons.length + 1}`,
        sort_order: lessons.length,
        lesson_type: "content",
      });
      setSelectedLessonId(newLesson.id);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteLesson = (lessonId: string) => {
    if (!window.confirm("Delete this lesson?")) return;
    if (selectedLessonId === lessonId) setSelectedLessonId(null);
    deleteLesson.mutate({ id: lessonId, moduleId });
  };

  const handleDuplicateLesson = async (lessonId: string) => {
    try {
      const { data: newLesson } = await duplicateLesson.mutateAsync({
        lessonId,
        moduleId,
      });
      setSelectedLessonId(newLesson.id);
      toast.success("Lesson duplicated");
    } catch {
      // Error handled by mutation
    }
  };

  const handleSave = () => {
    toast.success("Module saved");
  };

  const handlePublish = () => {
    if (lessons.length === 0) {
      toast.error("Add at least one lesson before publishing");
      return;
    }
    publishModule.mutate(moduleId);
  };

  if (moduleLoading || !module) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-v2-card border-b border-v2-ring dark:border-v2-ring">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigate({ to: "/my-training" as string })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <Input
            value={headerTitle}
            onChange={(e) => setHeaderTitle(e.target.value)}
            className="h-7 text-sm font-semibold border-none shadow-none px-1 bg-transparent"
            placeholder="Module title"
          />
        </div>
        <Badge
          variant={module.is_published ? "default" : "secondary"}
          className="text-[10px]"
        >
          {module.is_published ? "Published" : "Draft"}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleSave}
        >
          <Save className="h-3 w-3 mr-1" />
          Save
        </Button>
        {!module.is_published && (
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handlePublish}
            disabled={publishModule.isPending}
          >
            {publishModule.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Eye className="h-3 w-3 mr-1" />
            )}
            Publish
          </Button>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Lesson list */}
        <div className="w-60 border-r border-v2-ring dark:border-v2-ring bg-v2-card flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-v2-ring dark:border-v2-ring">
            <span className="text-[11px] font-medium text-v2-ink-muted">
              Lessons ({lessons.length})
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setSelectedLessonId(null);
                  setShowSettings(true);
                }}
                title="Module settings"
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleAddLesson}
                disabled={createLesson.isPending}
                title="Add lesson"
              >
                {createLesson.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={lessons.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                {lessons.map((lesson) => (
                  <SortableLessonItem
                    key={lesson.id}
                    lesson={lesson}
                    isSelected={lesson.id === selectedLessonId}
                    onSelect={() => {
                      setSelectedLessonId(lesson.id);
                      setShowSettings(false);
                    }}
                    onDelete={() => handleDeleteLesson(lesson.id)}
                    onDuplicate={() => handleDuplicateLesson(lesson.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {lessons.length === 0 && (
              <div className="text-center py-6 text-[10px] text-v2-ink-subtle">
                No lessons yet.
                <br />
                Click + to add one.
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor or settings */}
        <div className="flex-1 overflow-y-auto p-3">
          {showSettings && !selectedLessonId ? (
            <ModuleSettings module={module} onUpdate={updateModule.mutate} />
          ) : selectedLesson ? (
            <LessonEditor lesson={selectedLesson} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-v2-ink-subtle">
              Select a lesson to edit, or click the gear icon for module
              settings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sortable lesson item component
function SortableLessonItem({
  lesson,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  lesson: {
    id: string;
    title: string;
    lesson_type: string;
    sort_order: number;
  };
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lesson.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeIcon =
    lesson.lesson_type === "quiz"
      ? "Q"
      : lesson.lesson_type === "practice"
        ? "P"
        : "C";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 px-1.5 py-1.5 rounded text-[11px] mb-0.5 group cursor-pointer transition-colors ${
        isSelected
          ? "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink dark:text-v2-ink"
          : "text-v2-ink-muted dark:text-v2-ink-subtle hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50"
      }`}
      onClick={onSelect}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab flex-shrink-0"
      >
        <GripVertical className="h-3 w-3 text-v2-ink-subtle" />
      </span>
      <span className="h-4 w-4 rounded bg-v2-ring dark:bg-v2-ring-strong flex items-center justify-center text-[8px] font-bold flex-shrink-0">
        {typeIcon}
      </span>
      <span className="truncate flex-1">{lesson.title}</span>
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        title="Duplicate lesson"
      >
        <Copy className="h-3 w-3 text-v2-ink-subtle hover:text-info" />
      </button>
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete lesson"
      >
        <Trash2 className="h-3 w-3 text-v2-ink-subtle hover:text-destructive" />
      </button>
    </div>
  );
}

// Module settings panel
function ModuleSettings({
  module,
  onUpdate,
}: {
  module: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    difficulty_level: string;
    estimated_duration_minutes: number | null;
    xp_reward: number;
    tags: string[];
  };
  onUpdate: (args: { id: string; input: Record<string, unknown> }) => void;
}) {
  const [tagInput, setTagInput] = useState("");

  const update = useCallback(
    (field: string, value: unknown) => {
      onUpdate({ id: module.id, input: { [field]: value } });
    },
    [onUpdate, module.id],
  );

  // Debounced text/number fields
  const saveTitle = useCallback((v: string) => update("title", v), [update]);
  const saveDesc = useCallback(
    (v: string) => update("description", v),
    [update],
  );
  const saveDuration = useCallback(
    (v: string) => update("estimated_duration_minutes", v ? Number(v) : null),
    [update],
  );
  const saveXp = useCallback(
    (v: string) => update("xp_reward", Number(v) || 100),
    [update],
  );

  const [localTitle, setLocalTitle] = useDebouncedField(
    module.title,
    saveTitle,
  );
  const [localDesc, setLocalDesc] = useDebouncedField(
    module.description || "",
    saveDesc,
  );
  const [localDuration, setLocalDuration] = useDebouncedField(
    module.estimated_duration_minutes?.toString() ?? "",
    saveDuration,
  );
  const [localXp, setLocalXp] = useDebouncedField(
    module.xp_reward.toString(),
    saveXp,
  );

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !module.tags.includes(tag)) {
      update("tags", [...module.tags, tag]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    update(
      "tags",
      module.tags.filter((t) => t !== tag),
    );
  };

  return (
    <div className="max-w-lg space-y-3">
      <h2 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
        Module Settings
      </h2>

      <div className="space-y-2">
        <label className="text-[11px] font-medium text-v2-ink-muted">
          Title
        </label>
        <Input
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-medium text-v2-ink-muted">
          Description
        </label>
        <textarea
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          rows={3}
          className="w-full text-xs rounded-md border border-v2-ring dark:border-v2-ring-strong bg-v2-card p-2 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-v2-ink-muted">
            Category
          </label>
          <select
            value={module.category}
            onChange={(e) => update("category", e.target.value)}
            className="w-full h-7 text-xs border border-v2-ring dark:border-v2-ring-strong rounded-md px-2 bg-v2-card"
          >
            {MODULE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {MODULE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-v2-ink-muted">
            Difficulty
          </label>
          <select
            value={module.difficulty_level}
            onChange={(e) => update("difficulty_level", e.target.value)}
            className="w-full h-7 text-xs border border-v2-ring dark:border-v2-ring-strong rounded-md px-2 bg-v2-card"
          >
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-v2-ink-muted">
            Duration (min)
          </label>
          <Input
            type="number"
            value={localDuration}
            onChange={(e) => setLocalDuration(e.target.value)}
            className="h-7 text-xs"
            placeholder="e.g. 30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-v2-ink-muted">
            XP Reward
          </label>
          <Input
            type="number"
            value={localXp}
            onChange={(e) => setLocalXp(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-v2-ink-muted">
          Tags
        </label>
        <div className="flex flex-wrap gap-1 mb-1">
          {module.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5">
              {tag}
              <button className="ml-1" onClick={() => removeTag(tag)}>
                &times;
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && (e.preventDefault(), addTag())
            }
            className="h-7 text-xs flex-1"
            placeholder="Add tag..."
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={addTag}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
