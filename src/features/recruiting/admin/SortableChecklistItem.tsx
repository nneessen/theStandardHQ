// src/features/recruiting/admin/SortableChecklistItem.tsx

import { memo, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical,
  Edit2,
  Trash2,
  FileText,
  CheckSquare,
  BookOpen,
  UserCheck,
  Zap,
  EyeOff,
  Calendar,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  FileCheck,
  MessageSquare,
  List,
  Download,
  ExternalLink,
  ClipboardCheck,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type {
  PhaseChecklistItem,
  ChecklistItemType,
} from "@/types/recruiting.types";
import { ChecklistItemAutomationConfig } from "./ChecklistItemAutomationConfig";

const ITEM_TYPE_ICONS: Record<ChecklistItemType, LucideIcon> = {
  document_upload: FileText,
  task_completion: CheckSquare,
  training_module: BookOpen,
  manual_approval: UserCheck,
  automated_check: Zap,
  scheduling_booking: Calendar,
  video_embed: PlayCircle,
  boolean_question: HelpCircle,
  acknowledgment: FileCheck,
  text_response: MessageSquare,
  multiple_choice: List,
  file_download: Download,
  external_link: ExternalLink,
  quiz: ClipboardCheck,
  carrier_contracting: Building2,
};

const VALID_ITEM_TYPES = new Set<string>(Object.keys(ITEM_TYPE_ICONS));

/**
 * Runtime type guard for ChecklistItemType
 */
function isValidItemType(type: string): type is ChecklistItemType {
  return VALID_ITEM_TYPES.has(type);
}

function getTypeIcon(type: string): LucideIcon {
  if (isValidItemType(type)) {
    return ITEM_TYPE_ICONS[type];
  }
  // Fallback for unknown types from database
  return CheckSquare;
}

export interface SortableChecklistItemProps {
  item: PhaseChecklistItem;
  index: number;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  // Stable callbacks that receive item data
  onToggleExpand: (itemId: string) => void;
  onEdit: (item: PhaseChecklistItem) => void;
  onDelete: (itemId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  /** When true, hides edit/delete actions */
  readOnly?: boolean;
}

function SortableChecklistItemComponent({
  item,
  index,
  isExpanded,
  isFirst,
  isLast,
  onToggleExpand,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  readOnly = false,
}: SortableChecklistItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getTypeIcon(item.item_type);

  // Stable event handlers that call parent callbacks with item data
  const handleToggleExpand = useCallback(() => {
    onToggleExpand(item.id);
  }, [onToggleExpand, item.id]);

  const handleEdit = useCallback(() => {
    onEdit(item);
  }, [onEdit, item]);

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [onDelete, item.id]);

  const handleMoveUp = useCallback(() => {
    onMoveUp(item.id);
  }, [onMoveUp, item.id]);

  const handleMoveDown = useCallback(() => {
    onMoveDown(item.id);
  }, [onMoveDown, item.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card rounded-md border border-border shadow-sm"
    >
      {/* Item Row */}
      <div
        className="flex items-center gap-2 p-2 hover:bg-accent/50 cursor-pointer rounded-t-md"
        onClick={handleToggleExpand}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation();
            handleMoveUp();
          }}
        >
          <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation();
            handleMoveDown();
          }}
        >
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
        <span className="text-[10px] text-muted-foreground font-mono w-4">
          {index + 1}
        </span>
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-foreground flex-1 truncate">
          {item.item_name}
        </span>
        {item.is_required && (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 border-border"
          >
            Required
          </Badge>
        )}
        {!item.visible_to_recruit && (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 border-[hsl(var(--warning))]/50 text-[hsl(var(--warning))]"
          >
            <EyeOff className="h-2 w-2" />
          </Badge>
        )}
        {!readOnly && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
            >
              <Edit2 className="h-3 w-3 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-destructive hover:text-destructive/80"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {/* Expanded: Automations */}
      {isExpanded && (
        <div className="m-2 p-2 rounded bg-muted/30 border-t border-border/30">
          <ChecklistItemAutomationConfig checklistItemId={item.id} />
        </div>
      )}
    </div>
  );
}

export const SortableChecklistItem = memo(SortableChecklistItemComponent);
