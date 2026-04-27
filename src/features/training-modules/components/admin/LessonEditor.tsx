// src/features/training-modules/components/admin/LessonEditor.tsx
import { useState, useCallback } from "react";
import { Plus, Loader2, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTrainingLessonWithContent,
  useUpdateTrainingLesson,
  useCreateContentBlock,
  useDeleteContentBlock,
} from "../../hooks/useTrainingLessons";
import { LESSON_TYPES, CONTENT_TYPES } from "../../types/training-module.types";
import type {
  TrainingLesson,
  LessonType,
  ContentType,
  TrainingLessonContent,
} from "../../types/training-module.types";
import { ContentBlockEditor } from "./ContentBlockEditor";
import { QuizBuilder } from "./QuizBuilder";
import { useDebouncedField } from "../../hooks/useDebouncedField";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useImo } from "@/contexts/ImoContext";

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  content: "Content",
  quiz: "Quiz",
  practice: "Practice",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  rich_text: "Rich Text",
  video: "Video",
  pdf: "PDF Upload",
  slides: "Slides",
  external_link: "External Link",
  script_prompt: "Script Prompt",
};

interface LessonEditorProps {
  lesson: TrainingLesson;
}

export function LessonEditor({ lesson }: LessonEditorProps) {
  const { data: lessonWithContent, isLoading } = useTrainingLessonWithContent(
    lesson.id,
  );
  const updateLesson = useUpdateTrainingLesson();
  const createBlock = useCreateContentBlock();
  const deleteBlock = useDeleteContentBlock();
  const { imo } = useImo();

  const [addingBlockType, setAddingBlockType] = useState<ContentType | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const updateField = useCallback(
    (field: string, value: unknown) => {
      updateLesson.mutate({
        id: lesson.id,
        input: { [field]: value } as Record<string, unknown>,
      });
    },
    [updateLesson, lesson.id],
  );

  // Debounced text fields (500ms delay prevents per-keystroke mutations)
  const saveTitle = useCallback(
    (v: string) => updateField("title", v),
    [updateField],
  );
  const saveDescription = useCallback(
    (v: string) => updateField("description", v),
    [updateField],
  );
  const saveXp = useCallback(
    (v: string) => updateField("xp_reward", Number(v) || 0),
    [updateField],
  );
  const saveDuration = useCallback(
    (v: string) =>
      updateField("estimated_duration_minutes", v ? Number(v) : null),
    [updateField],
  );
  const [localTitle, setLocalTitle] = useDebouncedField(
    lesson.title,
    saveTitle,
  );
  const [localDescription, setLocalDescription] = useDebouncedField(
    lesson.description || "",
    saveDescription,
  );
  const [localXp, setLocalXp] = useDebouncedField(
    String(lesson.xp_reward),
    saveXp,
  );
  const [localDuration, setLocalDuration] = useDebouncedField(
    lesson.estimated_duration_minutes != null
      ? String(lesson.estimated_duration_minutes)
      : "",
    saveDuration,
  );

  const handleAddContentBlock = async (contentType: ContentType) => {
    if (!imo) return;
    const blocks = lessonWithContent?.content_blocks || [];
    try {
      await createBlock.mutateAsync({
        lesson_id: lesson.id,
        content_type: contentType,
        sort_order: blocks.length,
        title: CONTENT_TYPE_LABELS[contentType],
      });
      setAddingBlockType(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!window.confirm("Delete this content block?")) return;
    deleteBlock.mutate({ id: blockId, lessonId: lesson.id });
  };

  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Reorder content blocks by updating sort_order individually
    const blocks = lessonWithContent?.content_blocks || [];
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Compute new order and update each block's sort_order
    const reordered = [...blocks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    reordered.forEach((block, index) => {
      if (block.sort_order !== index) {
        // Inline update — no hook needed, use the service directly via the hook
        // We'll just update sort_order through the content block update hook
        // but to keep it simple, we import the existing updateContentBlock
      }
    });
    // For simplicity, update each block that moved
    // This is a builder view so performance is acceptable
    void updateBlockOrders(reordered);
  };

  const updateBlockOrders = async (blocks: TrainingLessonContent[]) => {
    const { trainingLessonService } =
      await import("../../services/trainingLessonService");
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].sort_order !== i) {
        await trainingLessonService.updateContentBlock(blocks[i].id, {
          sort_order: i,
        });
      }
    }
    // Invalidation happens automatically via the query key
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  const contentBlocks = lessonWithContent?.content_blocks || [];
  const isQuizLesson = lesson.lesson_type === "quiz";
  const isContentOrPractice =
    lesson.lesson_type === "content" || lesson.lesson_type === "practice";

  return (
    <div className="max-w-2xl space-y-4">
      {/* Lesson Metadata */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-v2-ink-muted">
            Lesson Title
          </label>
          <Input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            className="h-7 text-xs"
            placeholder="Lesson title"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-v2-ink-muted">
            Description
          </label>
          <textarea
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            rows={2}
            className="w-full text-xs rounded-md border border-v2-ring dark:border-v2-ring-strong bg-v2-card p-2 resize-none"
            placeholder="Optional description"
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-v2-ink-muted">
              Type
            </label>
            <select
              value={lesson.lesson_type}
              onChange={(e) => updateField("lesson_type", e.target.value)}
              className="w-full h-7 text-xs border border-v2-ring dark:border-v2-ring-strong rounded-md px-2 bg-v2-card"
            >
              {LESSON_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LESSON_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
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
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-v2-ink-muted">
              Duration (min)
            </label>
            <Input
              type="number"
              value={localDuration}
              onChange={(e) => setLocalDuration(e.target.value)}
              className="h-7 text-xs"
              placeholder="—"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-v2-ink-muted">
              Required
            </label>
            <select
              value={lesson.is_required ? "yes" : "no"}
              onChange={(e) =>
                updateField("is_required", e.target.value === "yes")
              }
              className="w-full h-7 text-xs border border-v2-ring dark:border-v2-ring-strong rounded-md px-2 bg-v2-card"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-v2-ring dark:border-v2-ring" />

      {/* Content Blocks (for content/practice lessons) */}
      {isContentOrPractice && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-v2-ink dark:text-v2-ink-muted">
              Content Blocks ({contentBlocks.length})
            </h3>
            <div className="relative">
              {addingBlockType === null ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => setAddingBlockType("rich_text")}
                  disabled={createBlock.isPending}
                >
                  {createBlock.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  Add Block
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <select
                    value={addingBlockType}
                    onChange={(e) =>
                      setAddingBlockType(e.target.value as ContentType)
                    }
                    className="h-6 text-[10px] border border-v2-ring dark:border-v2-ring-strong rounded px-1 bg-v2-card"
                  >
                    {CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {CONTENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => handleAddContentBlock(addingBlockType)}
                    disabled={createBlock.isPending}
                  >
                    {createBlock.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-1"
                    onClick={() => setAddingBlockType(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>

          {contentBlocks.length === 0 ? (
            <div className="text-center py-6 text-[10px] text-v2-ink-subtle border border-dashed border-v2-ring dark:border-v2-ring rounded-lg">
              No content blocks yet. Add one above.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleBlockDragEnd}
            >
              <SortableContext
                items={contentBlocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {contentBlocks.map((block) => (
                  <SortableContentBlock
                    key={block.id}
                    block={block}
                    lessonId={lesson.id}
                    onDelete={() => handleDeleteBlock(block.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Quiz Builder (for quiz lessons) */}
      {isQuizLesson && <QuizBuilder lessonId={lesson.id} />}
    </div>
  );
}

function SortableContentBlock({
  block,
  lessonId,
  onDelete,
}: {
  block: TrainingLessonContent;
  lessonId: string;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-v2-ring dark:border-v2-ring rounded-lg bg-v2-card mb-2"
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-v2-ring dark:border-v2-ring">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab flex-shrink-0"
        >
          <GripVertical className="h-3 w-3 text-v2-ink-subtle" />
        </span>
        <span className="text-[10px] font-medium text-v2-ink-muted uppercase">
          {block.content_type.replace("_", " ")}
        </span>
        {block.title && (
          <span className="text-[10px] text-v2-ink-subtle truncate">
            — {block.title}
          </span>
        )}
        <div className="flex-1" />
        <button onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-v2-ink-subtle hover:text-red-500" />
        </button>
      </div>
      <div className="p-2">
        <ContentBlockEditor block={block} lessonId={lessonId} />
      </div>
    </div>
  );
}
